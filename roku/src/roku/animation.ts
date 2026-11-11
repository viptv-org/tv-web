/**
 * Animation value + controller semantics matching the renderer contract used
 * by Solid's transitions: controllers are explicit, start on demand, retarget
 * while running, and resolve `waitUntilStopped()` exactly once per run.
 */

import { Events } from './events';
import type { CompositorAnimation } from './compositor-animation';
import { resolveEasing } from './animation-easing';
import { isColorKey, lerpColor } from './animation-color';
import type { Easing, AnimationControllerState, AnimationSettings, AnimationInit } from './animation-types';
export { resolveEasing } from './animation-easing';
export { isColorKey, lerpColor } from './animation-color';
export type { Easing, AnimationControllerState, AnimationSettings, AnimationInit } from './animation-types';

type AnimationEntry = Animation | CompositorAnimation;

export class Animation extends Events {
  value: number;
  startValue: number;
  initialValue: number;
  target: number;
  duration: number;
  delay: number;
  easing: Easing;
  repeat: number;
  loop: boolean;
  repeatDelay: number;
  private onUpdate: ((value: number) => void) | undefined;
  private onWake: (() => void) | undefined;
  private map: ((progress: number) => number) | undefined;
  private t = 0;
  private started = false;
  private active = false;
  private paused = false;
  private finished = false;
  private removed = false;
  private wait = 0;

  constructor(init: AnimationInit) {
    super();
    this.value = init.value;
    this.startValue = init.value;
    this.initialValue = init.value;
    this.target = init.target;
    this.duration = Math.max(0, init.duration || 0);
    this.delay = Math.max(0, init.delay || 0);
    this.easing = resolveEasing(init.easing);
    this.repeat = Math.max(0, init.repeat || 0);
    this.loop = !!init.loop;
    this.repeatDelay = Math.max(0, init.repeatDelay || 0);
    this.onUpdate = init.onUpdate;
    this.onWake = init.onWake;
    this.map = init.map;
    this.wait = this.delay;
  }

  start(): this {
    if (this.finished) return this;
    this.active = true;
    if (this.onWake) this.onWake();
    return this;
  }
  pause(): this {
    this.paused = true;
    return this;
  }
  resume(): this {
    this.paused = false;
    if (this.onWake) this.onWake();
    return this;
  }
  stop(): this {
    if (this.finished) return this;
    this.finished = true;
    this.active = false;
    this.emit('stop');
    return this;
  }
  /** Reverse toward the run's initial value over the elapsed progress. */
  reverse(): this {
    if (this.finished) return this;
    const elapsed = this.duration * this.t;
    this.startValue = this.value;
    this.target = this.initialValue;
    this.duration = Math.max(0, elapsed);
    this.t = 0;
    this.wait = 0;
    this.finished = false;
    this.active = true;
    if (this.onWake) this.onWake();
    return this;
  }
  /** Return to the initial value immediately. */
  restore(): this {
    this.value = this.initialValue;
    this.startValue = this.initialValue;
    this.target = this.initialValue;
    this.t = 0;
    this.finished = false;
    this.active = true;
    if (this.onUpdate) this.onUpdate(this.value);
    if (this.onWake) this.onWake();
    return this;
  }
  retarget(target: number): this {
    this.startValue = this.value;
    this.target = target;
    this.t = 0;
    this.wait = 0;
    this.finished = false;
    this.active = true;
    if (this.onWake) this.onWake();
    return this;
  }

  tick(delta: number): boolean {
    if (this.removed) return false;
    if (!this.active) return !this.finished;
    if (this.paused) return true;
    if (!this.started) {
      this.started = true;
      this.wait = this.delay;
      this.emit('start');
      if (this.wait > 0) return true;
    }
    if (this.wait > 0) {
      this.wait -= delta;
      if (this.wait > 0) return true;
      delta = -this.wait;
      this.wait = 0;
    }
    if (this.duration <= 0) {
      this.t = 1;
    } else {
      this.t = Math.min(1, this.t + delta / this.duration);
    }
    const p = this.easing(this.t);
    this.value = this.map
      ? this.map(p)
      : this.startValue + (this.target - this.startValue) * p;
    if (this.onUpdate) this.onUpdate(this.value);
    if (this.t >= 1) {
      if (this.loop || this.repeat > 0) {
        if (!this.loop) this.repeat--;
        this.t = 0;
        this.wait = this.repeatDelay;
        // A loop/repeat starts over from the animation's initial value, not
        // from the value it just reached (which would leave it pinned at the
        // target forever). Reset immediately so the repeat delay does not
        // hold the final frame.
        this.startValue = this.initialValue;
        this.value = this.initialValue;
        if (this.onUpdate) this.onUpdate(this.value);
        this.emit('loop');
        return true;
      }
      this.finished = true;
      this.active = false;
      this.emit('finish');
      return false;
    }
    return true;
  }

  remove() {
    this.removed = true;
    this.active = false;
  }
  get running() { return this.active && !this.finished; }
  get done() { return this.finished || this.removed; }
}

export class AnimationController extends Events {
  state: AnimationControllerState = 'scheduled';
  private entries: AnimationEntry[];
  private settings: AnimationSettings;
  private stopPromise: Promise<void> | null = null;
  private resolveStop: (() => void) | null = null;

  constructor(entries: AnimationEntry[], settings: AnimationSettings = {}) {
    super();
    this.entries = entries;
    this.settings = settings;
    for (let i = 0; i < entries.length; i++) {
      entries[i].on('finish', () => this.maybeDone());
      entries[i].on('stop', () => this.maybeDone());
    }
    if (entries.length === 0) this.finish();
  }

  start(): this {
    if (this.state === 'stopped') return this;
    const paused = this.state === 'paused';
    this.state = 'running';
    for (let i = 0; i < this.entries.length; i++) { if (paused) this.entries[i].resume();else this.entries[i].start(); }
    if (this.entries.length === 0 || this.entries.every((entry) => entry.done)) this.finish();
    return this;
  }
  stop(): this {
    if (this.state === 'stopped') return this;
    if (this.settings.stopMethod === 'reverse') {
      for (let i = 0; i < this.entries.length; i++) this.entries[i].reverse();
      this.state = 'running';
      return this;
    }
    for (let i = 0; i < this.entries.length; i++) this.entries[i].stop();
    this.finish();
    return this;
  }
  pause(): this {
    if (this.state === 'stopped') return this;
    this.state = 'paused';
    for (let i = 0; i < this.entries.length; i++) this.entries[i].pause();
    return this;
  }
  restore(): this {
    if (this.state === 'stopped') return this;
    this.state = 'running';
    for (let i = 0; i < this.entries.length; i++) this.entries[i].restore();
    return this;
  }
  retarget(value: number): this {
    this.state = 'running';
    for (let i = 0; i < this.entries.length; i++) this.entries[i].retarget(value);
    return this;
  }
  waitUntilStopped(): Promise<void> {
    if (this.state === 'stopped') return Promise.resolve();
    if (this.stopPromise === null) {
      this.stopPromise = new Promise<void>((resolve) => {
        this.resolveStop = resolve;
      });
    }
    return this.stopPromise;
  }
  get nativeClock(): boolean { return this.entries.some(entry => !!(entry as CompositorAnimation).nativeClock); }
  get progress(): number {
    return this.entries.length > 0 ? 1 : 0;
  }
  private maybeDone() {
    if (this.entries.every((entry) => entry.done)) this.finish();
  }
  private finish() {
    if (this.state === 'stopped') return;
    this.state = 'stopped';
    const resolve = this.resolveStop;
    this.resolveStop = null;
    this.stopPromise = null;
    if (resolve) resolve();
    this.emit('stopped');
  }
}

interface Track {
  animation: AnimationEntry;
  remove: boolean;
}

export class Animator {
  private tracks = new Map<any, Map<string, Track>>();
  private _paused = false;
  private pausedNative = new Set<CompositorAnimation>();
  get paused() { return this._paused; }
  set paused(value: boolean) {
    if (value === this._paused) return;
    this._paused = value;
    if (value) this.tracks.forEach(map => map.forEach(track => {
      const animation = track.animation as CompositorAnimation;
      if (animation.nativeClock && animation.running) { this.pausedNative.add(animation);animation.pause(); }
    }));
    else {
      this.pausedNative.forEach(animation => { if (!animation.done) animation.resume(); });
      this.pausedNative.clear();
    }
  }

  private registerNativePause(animation: CompositorAnimation) {
    animation.on('start', () => {
      if (this.paused && animation.running) { this.pausedNative.add(animation);animation.pause(); }
    });
  }

  create(node: any, props: any, settings: AnimationSettings, wake: () => void): AnimationController {
    const map = this.tracks.get(node) || new Map<string, Track>();
    this.tracks.set(node, map);
    const entries: AnimationEntry[] = [];
    for (const key in props) {
      const target = props[key];
      if (typeof target !== 'number') continue;
      const existing = map.get(key);
      if (existing) {
        existing.animation.stop();
        if ((existing.animation as CompositorAnimation).nativeClock) existing.animation.remove();
      }
      const current = typeof node[key] === 'number' ? node[key] : 0;
      const isColor = isColorKey(key);
      const animation = (globalThis as any).__viptvCreateNativeAnimation?.(node, key, target, settings) as CompositorAnimation | undefined ?? new Animation({
        // Colours are interpolated channel-by-channel. Treating a packed
        // 0xRRGGBBAA value as one number produced random low bytes on the Roku
        // JS engine (large-number arithmetic), so the intermediate fills
        // flickered through unrelated colours.
        value: isColor ? 0 : current,
        target: isColor ? 1 : target,
        duration: settings.duration,
        delay: settings.delay,
        easing: settings.easing ?? settings.timingFunction,
        loop: settings.loop,
        repeat: settings.repeat,
        repeatDelay: settings.repeatDelay,
        onWake: wake,
        map: isColor ? (p: number) => lerpColor(current, target, p) : undefined,
        onUpdate: (value) => {
          node[key] = value;
          node.requestRender();
        },
      });
      if ((animation as CompositorAnimation).nativeClock) this.registerNativePause(animation as CompositorAnimation);
      map.set(key, { animation, remove: !!settings.remove });
      entries.push(animation);
    }
    if (Object.keys(props).every((key) => typeof props[key] !== 'number')) {
      // Non-numeric props (shaderProps, textureOptions) still need a completion
      // signal; the visual values were already written by the caller.
      const animation = new Animation({
        value: 0,
        target: 0,
        duration: settings.duration,
        delay: settings.delay,
        easing: settings.easing ?? settings.timingFunction,
        onWake: wake,
      });
      const key = '__wait__' + Math.random();
      map.set(key, { animation, remove: true });
      entries.push(animation);
    }
    return new AnimationController(entries, settings);
  }

  tick(delta: number) {
    if (this.paused) return;
    this.tracks.forEach((map, node) => {
      map.forEach((track, key) => {
        if (track.animation.done || (track.animation as CompositorAnimation).nativeClock) return;
        const alive = track.animation.tick(delta);
        if (!alive) {
          if (track.remove) {
            map.delete(key);
            if (map.size === 0) this.tracks.delete(node);
            if (key === 'alpha' && track.animation.target === 0) node.destroy();
          }
        }
      });
    });
  }

  removeFor(node: any) {
    const map = this.tracks.get(node);
    if (map) {
      map.forEach((track) => { this.pausedNative.delete(track.animation as CompositorAnimation);track.animation.remove(); });
      this.tracks.delete(node);
    }
  }

  get running(): boolean {
    for (const map of this.tracks.values()) {
      for (const track of map.values()) {
        if (track.animation.running && !(track.animation as CompositorAnimation).nativeClock) return true;
      }
    }
    return false;
  }

  clear() {
    this.tracks.forEach(map => map.forEach(track => track.animation.remove()));
    this.tracks.clear();this.pausedNative.clear();
  }
}
