/**
 * WebGL 1 port of Android's HeroGlRenderer for the TV-042 hero backdrop.
 *
 *  1. The active transition (or, at rest, `fade` at progress 1 with the slow
 *     drift) renders into a power-of-two scene texture with generated mipmaps,
 *     which WebGL 1 requires for the shaders' biased (blurred) samples.
 *     Transitions draw at the art size first, so their pixel-cell effects keep
 *     the contract's `gl_FragCoord`/`uRes` relationship, then resample into it.
 *  2. The ambient pass fills the whole backdrop with the blurred scene at 0.6
 *     over the page ground.
 *  3. The edge pass dissolves the scene into that fill inside the art box; a
 *     changing style is wiped over the outgoing one with `uMorph`.
 *
 * Changes that arrive during a transition wait; only the latest plays. Rest
 * frames render every second display frame. Nothing renders while inactive.
 * Any context, program or frame failure reports once and stops the renderer.
 */
import { ambientSource, edgeSource, HERO_VERTEX, transitionSource } from "./heroShaderLibrary";
export { heroEdgeIds, heroShaderIndex } from "./heroShaderLibrary";
import { BASELINE_EDGE, type HeroTransitionSpec } from "./heroMotionPolicy";
import { ART_HEIGHT, ART_WIDTH, BACKDROP_HEIGHT, BACKDROP_WIDTH, sceneTextureSize } from "./heroBackdropModel";

export interface HeroArt {
  readonly source: TexImageSource;
  readonly width: number;
  readonly height: number;
}

/** Chooses styles when a change actually plays, so superseded changes draw nothing. */
export interface HeroPick {
  transition(current: string | undefined): HeroTransitionSpec;
  edge(current: string | undefined): string;
}

export interface HeroRendererOptions {
  /** Output pixels per logical pixel (≤ 1). */
  readonly scale: number;
  readonly ground: readonly [number, number, number];
  /** Played when a drawn transition fails to compile. */
  readonly crossfade: HeroTransitionSpec;
  readonly onFailure: (reason: string) => void;
  /** Called after the first frame is presented. */
  readonly onFirstFrame?: () => void;
}

interface Slide {
  readonly tex: WebGLTexture;
  readonly w: number;
  readonly h: number;
  readonly start: number;
  readonly driftX: number;
  readonly driftY: number;
}

interface Anim {
  readonly from: Slide;
  readonly to: Slide;
  readonly spec: HeroTransitionSpec;
  readonly start: number;
  readonly duration: number;
}

interface Program {
  readonly id: WebGLProgram;
  readonly aPos: number;
  readonly uFrom: WebGLUniformLocation | null;
  readonly uTo: WebGLUniformLocation | null;
  readonly uGlyphs: WebGLUniformLocation | null;
  readonly uScene: WebGLUniformLocation | null;
  readonly uSrc: WebGLUniformLocation | null;
  readonly uRes: WebGLUniformLocation | null;
  readonly uFromSize: WebGLUniformLocation | null;
  readonly uToSize: WebGLUniformLocation | null;
  readonly uFromDrift: WebGLUniformLocation | null;
  readonly uToDrift: WebGLUniformLocation | null;
  readonly uFocus: WebGLUniformLocation | null;
  readonly uProgress: WebGLUniformLocation | null;
  readonly uTime: WebGLUniformLocation | null;
  readonly uFromT: WebGLUniformLocation | null;
  readonly uToT: WebGLUniformLocation | null;
  readonly uDpr: WebGLUniformLocation | null;
  readonly uMorph: WebGLUniformLocation | null;
  readonly uGround: WebGLUniformLocation | null;
  readonly uView: WebGLUniformLocation | null;
  readonly uOrigin: WebGLUniformLocation | null;
}

const FOCUS_X = 0.62;
const FOCUS_Y = 0.55;
const AMBIENT = "ambient";
const BLIT = "blit";
const BLIT_SOURCE =
  "precision mediump float;\nvarying vec2 vUv;\nuniform sampler2D uSrc;\n" +
  "void main() { gl_FragColor = texture2D(uSrc, vUv); }";
const CONTEXT: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  powerPreference: "low-power",
  // A software-rendered context would starve focus motion on a TV.
  failIfMajorPerformanceCaveat: true,
};
const GLYPHS = " .`:-=+*%#&@";
const GLYPH_W = 28;
const GLYPH_H = 48;
const MAX_WARM = 4;

/** Returns a WebGL 1 context for the backdrop, or null when unavailable. */
export function createHeroContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  try {
    return (canvas.getContext("webgl", CONTEXT) ??
      canvas.getContext("experimental-webgl", CONTEXT)) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
}

export class HeroGlRenderer {
  readonly viewW: number;
  readonly viewH: number;
  readonly artW: number;
  readonly artH: number;
  readonly sceneW: number;
  readonly sceneH: number;
  private readonly dpr: number;
  private readonly t0 = performance.now();
  private readonly programs = new Map<string, Program | null>();
  private readonly warmQueue: string[] = [];
  private quad: WebGLBuffer | null = null;
  private sceneFbo: WebGLFramebuffer | null = null;
  private scene: WebGLTexture | null = null;
  private stageFbo: WebGLFramebuffer | null = null;
  private stage: WebGLTexture | null = null;
  private glyphs: WebGLTexture | null = null;
  private current?: Slide;
  private anim?: Anim;
  private pending?: { art: HeroArt; pick: HeroPick };
  private startPending = false;
  private edgeA = BASELINE_EDGE;
  private edgeB = BASELINE_EDGE;
  private edgeStart = 0;
  private edgeDuration = 0;
  private shownTransition?: string;
  private active = false;
  private raf = 0;
  private frameCount = 0;
  private presented = false;
  private failed = false;
  private released = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGLRenderingContext,
    private readonly options: HeroRendererOptions,
  ) {
    const scale = options.scale > 0 ? Math.min(1, options.scale) : 1;
    this.viewW = Math.round(BACKDROP_WIDTH * scale);
    this.viewH = Math.round(BACKDROP_HEIGHT * scale);
    this.artW = Math.round(ART_WIDTH * scale);
    this.artH = Math.round(ART_HEIGHT * scale);
    this.dpr = this.artW / ART_WIDTH;
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const scene = sceneTextureSize(this.artW, this.artH, max || 1024);
    this.sceneW = scene.width;
    this.sceneH = scene.height;
    canvas.width = this.viewW;
    canvas.height = this.viewH;
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.setup();
  }

  /** The edge style currently targeted, so a draw avoids repeating it. */
  get edge(): string {
    return this.edgeB;
  }

  get transition(): string | undefined {
    return this.shownTransition;
  }

  get hasArt(): boolean {
    return !!this.current;
  }

  /**
   * Show new art. The first art appears without a transition; a change during
   * a transition (or while inactive) replaces any waiting change.
   */
  show(art: HeroArt, pick: HeroPick): void {
    if (this.failed || this.released) return;
    if (!this.current) {
      const slide = this.upload(art);
      if (!slide) return;
      this.current = slide;
      this.edgeA = this.edgeB = this.resolveEdge(pick.edge(undefined));
      this.edgeDuration = 0;
      this.schedule();
      return;
    }
    if (this.anim || !this.active) {
      this.pending = { art, pick };
      return;
    }
    this.begin(art, pick, performance.now());
  }

  /** Compile likely-next programs on idle rest frames. */
  prepare(transitionId: string | undefined, edgeId: string | undefined): void {
    for (const key of [transitionId && `fx:${transitionId}`, edgeId && `edge:${edgeId}`])
      if (key && !this.programs.has(key) && !this.warmQueue.includes(key) && this.warmQueue.length < MAX_WARM)
        this.warmQueue.push(key);
  }

  /** Pause while hidden; resuming shows the latest art without a transition. */
  setActive(active: boolean): void {
    if (this.failed || this.released || active === this.active) return;
    this.active = active;
    if (!active) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    this.collapse();
    this.schedule();
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    const gl = this.gl;
    if (!gl.isContextLost()) {
      for (const program of this.programs.values()) if (program) gl.deleteProgram(program.id);
      for (const tex of [this.current?.tex, this.anim?.from.tex, this.anim?.to.tex, this.scene, this.stage, this.glyphs])
        if (tex) gl.deleteTexture(tex);
      gl.deleteFramebuffer(this.sceneFbo);
      gl.deleteFramebuffer(this.stageFbo);
      gl.deleteBuffer(this.quad);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.programs.clear();
    this.current = this.anim = this.pending = undefined;
    this.scene = this.stage = this.glyphs = this.sceneFbo = this.stageFbo = this.quad = null;
    this.canvas.width = this.canvas.height = 1;
  }

  // ---- setup ----

  private setup() {
    const gl = this.gl;
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.scene = this.target(this.sceneW, this.sceneH, true);
    this.sceneFbo = this.framebuffer(this.scene);
    this.glyphs = this.glyphTexture();
    // The resting programs; any failure here leaves the static compositor.
    for (const key of ["fx:fade", AMBIENT, `edge:${BASELINE_EDGE}`])
      if (!this.program(key)) throw new Error(`Hero program ${key} unavailable`);
  }

  private target(width: number, height: number, mips: boolean): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error("Hero texture unavailable");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.params(mips);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }

  private framebuffer(tex: WebGLTexture): WebGLFramebuffer {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!fbo || status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Hero framebuffer incomplete (${status})`);
    return fbo;
  }

  private params(mips: boolean) {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** The contract's glyph strip, drawn upside down to match GL's v axis. */
  private glyphTexture(): WebGLTexture {
    const strip = document.createElement("canvas");
    strip.width = GLYPH_W * GLYPHS.length;
    strip.height = GLYPH_H;
    const paint = strip.getContext("2d");
    if (!paint) throw new Error("Hero glyph strip unavailable");
    paint.fillStyle = "#000";
    paint.fillRect(0, 0, strip.width, strip.height);
    paint.translate(0, GLYPH_H);
    paint.scale(1, -1);
    paint.fillStyle = "#fff";
    paint.font = `bold ${GLYPH_H * 0.82}px monospace`;
    paint.textAlign = "center";
    paint.textBaseline = "middle";
    for (let index = 0; index < GLYPHS.length; index++)
      paint.fillText(GLYPHS[index], index * GLYPH_W + GLYPH_W / 2, GLYPH_H / 2);
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error("Hero glyph texture unavailable");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, strip);
    this.params(false);
    strip.width = strip.height = 0;
    return tex;
  }

  // ---- programs ----

  private program(key: string): Program | null {
    const cached = this.programs.get(key);
    if (cached !== undefined) return cached;
    let program: Program | null = null;
    try {
      const fragment =
        key === AMBIENT ? ambientSource()
        : key === BLIT ? BLIT_SOURCE
        : key.startsWith("fx:") ? transitionSource(key.slice(3))
        : edgeSource(key.slice(5));
      program = this.link(fragment);
    } catch (cause) {
      console.warn(`Hero shader ${key} unavailable`, cause);
    }
    this.programs.set(key, program);
    return program;
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("createShader failed");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(log || "compile failed");
    }
    return shader;
  }

  private link(fragment: string): Program {
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, HERO_VERTEX);
    let fs: WebGLShader;
    try {
      fs = this.compile(gl.FRAGMENT_SHADER, fragment);
    } catch (cause) {
      gl.deleteShader(vs);
      throw cause;
    }
    const id = gl.createProgram();
    if (!id) throw new Error("createProgram failed");
    gl.attachShader(id, vs);
    gl.attachShader(id, fs);
    gl.bindAttribLocation(id, 0, "aPos");
    gl.linkProgram(id);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(id, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(id);
      gl.deleteProgram(id);
      throw new Error(log || "link failed");
    }
    const u = (name: string) => gl.getUniformLocation(id, name);
    return {
      id, aPos: gl.getAttribLocation(id, "aPos"),
      uFrom: u("uFrom"), uTo: u("uTo"), uGlyphs: u("uGlyphs"), uScene: u("uScene"), uSrc: u("uSrc"),
      uRes: u("uRes"), uFromSize: u("uFromSize"), uToSize: u("uToSize"), uFromDrift: u("uFromDrift"),
      uToDrift: u("uToDrift"), uFocus: u("uFocus"), uProgress: u("uProgress"), uTime: u("uTime"),
      uFromT: u("uFromT"), uToT: u("uToT"), uDpr: u("uDpr"), uMorph: u("uMorph"), uGround: u("uGround"),
      uView: u("uView"), uOrigin: u("uOrigin"),
    };
  }

  private resolveEdge(id: string): string {
    return id && this.program(`edge:${id}`) ? id : BASELINE_EDGE;
  }

  private resolveTransition(spec: HeroTransitionSpec): HeroTransitionSpec {
    return this.program(`fx:${spec.id}`) ? spec : this.options.crossfade;
  }

  // ---- changes ----

  private upload(art: HeroArt): Slide | undefined {
    const gl = this.gl;
    if (!(art.width > 0 && art.height > 0)) return undefined;
    const tex = gl.createTexture();
    if (!tex) return undefined;
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art.source);
      this.params(false);
    } catch (cause) {
      // A tainted or undecodable image keeps the current art.
      gl.deleteTexture(tex);
      console.warn("Hero art upload failed", cause);
      return undefined;
    }
    const angle = Math.random() * Math.PI * 2;
    return { tex, w: art.width, h: art.height, start: performance.now(), driftX: Math.cos(angle), driftY: Math.sin(angle) };
  }

  private begin(art: HeroArt, pick: HeroPick, now: number) {
    const from = this.current;
    if (!from) return;
    const slide = this.upload(art);
    if (!slide) return;
    const drawn = pick.transition(this.shownTransition);
    const spec = this.resolveTransition(drawn);
    const duration = Math.max(1, spec.duration * 1000);
    this.shownTransition = drawn.id;
    this.setEdge(this.resolveEdge(pick.edge(this.edgeB)), duration, now);
    this.anim = { from, to: slide, spec, start: now, duration };
    if (!this.stage) {
      this.stage = this.target(this.artW, this.artH, false);
      this.stageFbo = this.framebuffer(this.stage);
    }
  }

  private setEdge(id: string, duration: number, now: number) {
    if (this.edgeDuration > 0 && now - this.edgeStart < this.edgeDuration) this.edgeA = this.edgeB;
    this.edgeB = id;
    this.edgeStart = now;
    this.edgeDuration = id === this.edgeA ? 0 : duration;
  }

  /** Jump to the latest state: finish any transition, apply any waiting art. */
  private collapse() {
    const gl = this.gl;
    if (this.anim) {
      gl.deleteTexture(this.anim.from.tex);
      this.current = this.anim.to;
      this.anim = undefined;
    }
    const waiting = this.pending;
    this.pending = undefined;
    this.startPending = false;
    if (waiting && this.current) {
      const slide = this.upload(waiting.art);
      if (slide) {
        gl.deleteTexture(this.current.tex);
        this.current = slide;
        this.edgeB = this.resolveEdge(waiting.pick.edge(this.edgeB));
      }
    }
    this.edgeA = this.edgeB;
    this.edgeDuration = 0;
  }

  // ---- frames ----

  private schedule() {
    if (this.active && !this.raf && !this.failed && !this.released && this.current)
      this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = () => {
    this.raf = 0;
    if (!this.active || this.failed || this.released) return;
    this.raf = requestAnimationFrame(this.frame);
    const now = performance.now();
    if (this.startPending && !this.anim) {
      this.startPending = false;
      const waiting = this.pending;
      this.pending = undefined;
      if (waiting) this.begin(waiting.art, waiting.pick, now);
    }
    const busy = !!this.anim || (this.edgeDuration > 0 && now - this.edgeStart < this.edgeDuration);
    // At rest, drift and animated edges render at half rate for focus headroom.
    if (!busy && this.presented && (++this.frameCount & 1)) {
      const key = this.warmQueue.shift();
      if (key) this.program(key);
      return;
    }
    try {
      this.render(now);
    } catch (cause) {
      this.fail(`frame: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };

  private render(now: number) {
    const gl = this.gl;
    let slide = this.current;
    if (!slide || !this.scene) return;
    let from = slide;
    let progress = 1;
    let spec: HeroTransitionSpec | undefined;
    const anim = this.anim;
    if (anim) {
      progress = (now - anim.start) / anim.duration;
      if (progress >= 1) {
        gl.deleteTexture(anim.from.tex);
        slide = from = this.current = anim.to;
        this.anim = undefined;
        this.startPending = !!this.pending;
        progress = 1;
      } else {
        from = anim.from;
        slide = anim.to;
        spec = anim.spec;
      }
    }
    const t = (now - this.t0) / 1000;

    // Pass 1: transition → scene.
    if (spec && this.stage && this.stageFbo) {
      const fx = this.program(`fx:${spec.id}`) ?? this.program("fx:fade");
      if (!fx) throw new Error("no transition program");
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.stageFbo);
      gl.viewport(0, 0, this.artW, this.artH);
      this.transitionUniforms(fx, from, slide, progress, now, t, this.artW, this.artH, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const blit = this.program(BLIT);
      if (!blit) throw new Error("no blit program");
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
      gl.viewport(0, 0, this.sceneW, this.sceneH);
      this.use(blit);
      this.bind(0, this.stage, blit.uSrc);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      // At rest the crossfade at progress 1 samples only the drifting art, so it
      // draws straight into the scene; the size correction keeps the 16:9 cover.
      const fade = this.program("fx:fade");
      if (!fade) throw new Error("no fade program");
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
      gl.viewport(0, 0, this.sceneW, this.sceneH);
      const correction = (this.artW / this.artH) / (this.sceneW / this.sceneH);
      this.transitionUniforms(fade, slide, slide, 1, now, t, this.sceneW, this.sceneH, correction);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene);
    gl.generateMipmap(gl.TEXTURE_2D);

    // Pass 2: ambient fill over the whole backdrop.
    gl.viewport(0, 0, this.viewW, this.viewH);
    const ambient = this.program(AMBIENT);
    if (!ambient) throw new Error("no ambient program");
    this.edgeUniforms(ambient, t, -1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Pass 3: edge fade(s) inside the art box (top-right).
    let morph = -1;
    if (this.edgeDuration > 0) {
      morph = (now - this.edgeStart) / this.edgeDuration;
      if (morph >= 1) {
        this.edgeA = this.edgeB;
        this.edgeDuration = 0;
        morph = -1;
      }
    }
    gl.viewport(this.viewW - this.artW, this.viewH - this.artH, this.artW, this.artH);
    const outgoing = this.program(`edge:${this.edgeA}`) ?? this.program(`edge:${BASELINE_EDGE}`);
    if (!outgoing) throw new Error("no edge program");
    this.edgeUniforms(outgoing, t, -1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (morph >= 0) {
      const incoming = this.program(`edge:${this.edgeB}`);
      if (incoming) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this.edgeUniforms(incoming, t, morph);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disable(gl.BLEND);
      }
    }
    if (!this.presented) {
      this.presented = true;
      this.options.onFirstFrame?.();
    }
  }

  private transitionUniforms(p: Program, from: Slide, to: Slide, progress: number, now: number, t: number, resW: number, resH: number, correction: number) {
    const gl = this.gl;
    this.use(p);
    this.bind(0, from.tex, p.uFrom);
    this.bind(1, to.tex, p.uTo);
    this.bind(2, this.glyphs, p.uGlyphs);
    gl.uniform2f(p.uRes, resW, resH);
    gl.uniform2f(p.uFromSize, from.w, from.h * correction);
    gl.uniform2f(p.uToSize, to.w, to.h * correction);
    gl.uniform2f(p.uFromDrift, from.driftX, from.driftY);
    gl.uniform2f(p.uToDrift, to.driftX, to.driftY);
    gl.uniform2f(p.uFocus, FOCUS_X, FOCUS_Y);
    gl.uniform1f(p.uProgress, progress);
    gl.uniform1f(p.uTime, t);
    gl.uniform1f(p.uFromT, (now - from.start) / 1000);
    gl.uniform1f(p.uToT, (now - to.start) / 1000);
    gl.uniform1f(p.uDpr, this.dpr);
  }

  private edgeUniforms(p: Program, t: number, morph: number) {
    const gl = this.gl;
    const ground = this.options.ground;
    this.use(p);
    this.bind(0, this.scene, p.uScene);
    this.bind(1, this.glyphs, p.uGlyphs);
    gl.uniform2f(p.uRes, this.artW, this.artH);
    gl.uniform2f(p.uFocus, FOCUS_X, FOCUS_Y);
    gl.uniform1f(p.uTime, t);
    gl.uniform1f(p.uDpr, this.dpr);
    gl.uniform1f(p.uMorph, morph);
    gl.uniform3f(p.uGround, ground[0], ground[1], ground[2]);
    gl.uniform2f(p.uView, this.viewW, this.viewH);
    gl.uniform2f(p.uOrigin, this.viewW - this.artW, this.viewH - this.artH);
  }

  private use(p: Program) {
    const gl = this.gl;
    gl.useProgram(p.id);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(p.aPos);
    gl.vertexAttribPointer(p.aPos, 2, gl.FLOAT, false, 0, 0);
  }

  private bind(unit: number, tex: WebGLTexture | null, location: WebGLUniformLocation | null) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(location, unit);
  }

  private fail(reason: string) {
    if (this.failed || this.released) return;
    this.failed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    console.warn(`Hero shader backdrop unavailable: ${reason}`);
    this.options.onFailure(reason);
  }

  private readonly onContextLost = () => this.fail("context lost");
}
