export type Easing = (t: number) => number;
export type AnimationControllerState = 'scheduled' | 'running' | 'paused' | 'stopped';

export interface AnimationSettings {
  duration?: number;
  delay?: number;
  easing?: string | Easing;
  timingFunction?: string | Easing;
  loop?: boolean;
  repeat?: number;
  repeatDelay?: number;
  stopMethod?: 'reverse' | false;
  adaptiveDuration?: boolean;
  remove?: boolean;
}

export interface AnimationInit {
  value: number;
  target: number;
  duration?: number;
  delay?: number;
  easing?: string | Easing;
  loop?: boolean;
  repeat?: number;
  repeatDelay?: number;
  onUpdate?: (value: number) => void;
  onWake?: () => void;
  /** Optional eased-progress -> value map (color interpolation). */
  map?: (progress: number) => number;
}
