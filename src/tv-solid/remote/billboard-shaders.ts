import type { WebGlShaderType } from "@solidtv/renderer/webgl";
const vertex = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
attribute vec2 a_position;
attribute vec2 a_nodeCoords;
attribute vec4 a_color;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_time;
uniform float u_startedAt;
uniform float u_animate;
uniform float u_zoom;
uniform vec2 u_origin;
uniform vec2 u_size;
uniform vec2 u_uvOrigin;
uniform vec2 u_uvSize;
varying vec2 v_pixel;
varying vec2 v_uv;
varying vec2 v_local;
varying float v_zoom;
varying vec4 v_color;
void main(){
 float zoom=u_zoom;
 if(u_animate>0.5){
  float x=clamp((u_time-u_startedAt)/14000.0,0.0,1.0);
  float low=0.0;float high=1.0;float t=x;
  for(int i=0;i<14;i++){t=(low+high)*0.5;float value=3.0*(1.0-t)*t*t*0.58+t*t*t;if(value<x)low=t;else high=t;}
  zoom=1.0+0.06*(3.0*(1.0-t)*t*t+t*t*t);
 }
 v_zoom=zoom;v_pixel=u_origin+a_nodeCoords*u_size;v_local=a_nodeCoords;v_color=a_color;
 v_uv=u_uvOrigin+(vec2(0.5)+(v_pixel/vec2(1920.0,1080.0)-0.5)/zoom)*u_uvSize;
 gl_Position=vec4(a_position*u_pixelRatio*vec2(2.0/u_resolution.x,-2.0/u_resolution.y)+vec2(-1.0,1.0),0.0,1.0);
}`;
const paint = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_texture;
uniform float u_pixelRatio;
uniform vec2 u_uvSize;
varying vec2 v_pixel;
varying vec2 v_uv;
varying vec2 v_local;
varying float v_zoom;
varying vec4 v_color;
vec3 shade(vec2 pixel,vec4 sampleColor){
 vec3 art=sampleColor.rgb+vec3(11.0,11.0,12.0)/255.0*(1.0-sampleColor.a);
 float left=pixel.x<652.8?mix(0.85,0.55,pixel.x/652.8):0.55*(1.0-clamp((pixel.x-652.8)/537.6,0.0,1.0));
 float bottom=pixel.y<846.0?0.92*clamp((pixel.y-560.0)/286.0,0.0,1.0):mix(0.92,1.0,clamp((pixel.y-846.0)/234.0,0.0,1.0));
 float top=0.7*(1.0-clamp(pixel.y/200.0,0.0,1.0));
 float visible=(1.0-left)*(1.0-bottom)*(1.0-top);
 return mix(vec3(11.0,11.0,12.0)/255.0,art,visible);
}
vec3 paint(vec2 pixel){return shade(pixel,texture2D(u_texture,v_uv+(pixel-v_pixel)/vec2(1920.0,1080.0)/v_zoom*u_uvSize));}`;
export const billboardShader: WebGlShaderType = {
  props: {},
  canBatch: (node, op) => node.props.shader === op.shader,
  vertex,
  fragment:
    paint +
    `
void main(){gl_FragColor=vec4(shade(v_pixel,texture2D(u_texture,v_uv)),1.0)*v_color;}`,
};
// The 7×7 Gaussian samples cover three standard deviations of the reference
// 24px backdrop blur. Only the two 72px controls use this fragment program.
export const billboardGlassShader: WebGlShaderType = {
  props: {},
  canBatch: (node, op) => node.props.shader === op.shader,
  vertex,
  fragment:
    paint +
    `
float weight(float x){return exp(-0.5*x*x);}
void main(){
 vec3 sum=vec3(0.0);float total=0.0;
 for(int y=-3;y<=3;y++){for(int x=-3;x<=3;x++){
  float w=weight(float(x))*weight(float(y));sum+=paint(v_pixel+vec2(float(x),float(y))*24.0)*w;total+=w;
 }}
 vec3 color=mix(sum/total,vec3(1.0),0.16);
 float edge=1.0-smoothstep(-0.5/u_pixelRatio,0.5/u_pixelRatio,length((v_local-0.5)*72.0)-36.0);
 gl_FragColor=vec4(color*edge,edge)*v_color;
}`,
};
export const billboardGlassAtlasShader: WebGlShaderType = {
  props: {},
  canBatch: (node, op) => node.props.shader === op.shader,
  vertex,
  fragment: `
precision highp float;
uniform sampler2D u_texture;uniform float u_row;uniform float u_pixelRatio;
varying vec2 v_local;varying float v_zoom;varying vec4 v_color;
void main(){
 float frame=clamp((v_zoom-1.0)/0.06*7.0,0.0,7.0);float first=floor(frame);float next=min(first+1.0,7.0);
 vec2 local=clamp(v_local*72.0,vec2(0.5),vec2(71.5));
 vec3 a=texture2D(u_texture,(local+vec2(first*72.0,u_row*72.0))/vec2(576.0,144.0)).rgb;
 vec3 b=texture2D(u_texture,(local+vec2(next*72.0,u_row*72.0))/vec2(576.0,144.0)).rgb;
 vec3 color=mix(mix(a,b,fract(frame)),vec3(1.0),0.16);
 float edge=1.0-smoothstep(-0.5/u_pixelRatio,0.5/u_pixelRatio,length((v_local-0.5)*72.0)-36.0);
 gl_FragColor=vec4(color*edge,edge)*v_color;
}`,
};
export const heroProgressShader: WebGlShaderType = {
  props: {},
  time: true,
  canBatch: (node, op) => node.props.shader === op.shader,
  vertex: `
precision highp float;
attribute vec2 a_position;attribute vec2 a_nodeCoords;attribute vec4 a_color;
uniform vec2 u_resolution;uniform float u_pixelRatio;
uniform float u_time;uniform float u_startedAt;
varying vec2 v_local;varying float v_progress;varying vec4 v_color;
void main(){v_local=a_nodeCoords;v_color=a_color;v_progress=clamp((u_time-u_startedAt)/9000.0,0.0,1.0);gl_Position=vec4(a_position*u_pixelRatio*vec2(2.0/u_resolution.x,-2.0/u_resolution.y)+vec2(-1.0,1.0),0.0,1.0);}`,
  fragment: `
precision highp float;
uniform float u_pixelRatio;
varying vec2 v_local;varying float v_progress;varying vec4 v_color;
void main(){vec2 p=v_local*vec2(48.0,4.0);float d=length(vec2(max(abs(p.x-24.0)-22.0,0.0),p.y-2.0))-2.0;float edge=1.0-smoothstep(-0.5/u_pixelRatio,0.5/u_pixelRatio,d);float fill=1.0-step(v_progress,v_local.x);vec4 c=mix(vec4(0.3),vec4(244.0/255.0,242.0/255.0,238.0/255.0,1.0),fill);gl_FragColor=c*edge*v_color;}`,
};
