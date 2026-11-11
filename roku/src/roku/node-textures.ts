import { Events } from './events';
import { finiteNumber as num } from './node-values';

const SHEET_SIZES: Record<string, [number, number]> = {
  'pkg:/assets/icons_white.png': [375, 100],
  'pkg:/assets/icons.png': [375, 100]
};
export function sheetSize(src: string): [number, number] | null {
  return SHEET_SIZES[normalizeUri(src)] || null;
}
export function normalizeUri(src: string): string {
  if (!src) return '';
  if (src.indexOf('file:///app/') === 0) return 'pkg:/' + src.slice(13);
  if (src.indexOf('pkg:/') === 0) return src;
  if (src.charAt(0) === '/') return 'pkg:' + src;
  if (src.indexOf('./') === 0) return 'pkg:/' + src.slice(2);
  if (/^https?:\/\//.test(src)) return src;
  return 'pkg:/' + src;
}
export class RokuTexture extends Events {
  textureType: string;
  props: any;
  src: string;
  state: string = 'freed';
  destroyed = false;
  constructor(type: string, props: any) {
    super();
    this.textureType = type;
    this.props = props || {};
    if (type === 'SubTexture' && this.props.texture) this.src = this.props.texture.src;
    else this.src = normalizeUri(this.props.src || '');
  }
  get w() {
    return num(this.props.w, 0);
  }
  get h() {
    return num(this.props.h, 0);
  }
  destroy() {
    this.destroyed = true;
    this.removeAllListeners();
  }
}
