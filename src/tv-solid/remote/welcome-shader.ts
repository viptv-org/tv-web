import type { WebGlShaderType } from "@solidtv/renderer/webgl";

/** Combine the drifting artwork and fixed radial vignette in one screen pass. */
export const welcomeShader: WebGlShaderType = {
  props: {},
  vertex: `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    attribute vec2 a_position;
    attribute vec2 a_nodeCoords;
    uniform vec2 u_resolution;
    uniform float u_pixelRatio;
    uniform float u_time;
    uniform float u_startedAt;
    varying vec2 v_nodeCoords;
    varying float v_wallOffset;
    void main() {
      v_nodeCoords=a_nodeCoords;
      v_wallOffset=60.0+500.0*(1.0-abs(mod((u_time-u_startedAt)/60000.0,2.0)-1.0));
      gl_Position=vec4(a_position*u_pixelRatio*vec2(2.0/u_resolution.x,-2.0/u_resolution.y)+vec2(-1.0,1.0),0.0,1.0);
    }`,
  fragment: `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform sampler2D u_texture;
    uniform float u_wallOffset;
    varying vec2 v_nodeCoords;
    void main() {
      vec2 pixel=v_nodeCoords*vec2(1920.0,1080.0);
      vec4 art=texture2D(u_texture,(pixel+vec2(u_wallOffset,100.0))/vec2(2520.0,1500.0));
      float t=min(1.0,length((pixel-vec2(960.0,540.0))/vec2(1152.0,756.0)));
      float vignette=t<=0.55?mix(0.92,0.75,t/0.55):mix(0.75,0.45,(t-0.55)/0.45);
      float amount=0.32*(1.0-vignette);
      vec3 bg=vec3(11.0,11.0,12.0)/255.0;
      gl_FragColor=vec4(art.rgb*amount+bg*(1.0-art.a*amount),1.0);
    }`,
};
