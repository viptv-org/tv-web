import { Events } from './events';
import type { AnimationSettings } from './animation';

let nextMotionSerial = 0;

export type MotionKey = 'x' | 'y' | 'alpha';
export type MotionAction = 'start' | 'pause' | 'resume' | 'stop';
export type MotionFeedback = { serial: number; state: string; value: number };
export interface MotionSink {
  prepare?(): void;
  send(action: MotionAction, serial: number, target: number, duration: number, easing: string, reply: (feedback: MotionFeedback) => void): void;
  dispose(): void;
}
const nativeEasings: Record<string, string> = {
  linear: 'linear', ease: 'inOutQuad', 'ease-in': 'inQuad', 'ease-out': 'outQuad', 'ease-in-out': 'inOutQuad',
  easeIn: 'inQuad', easeOut: 'outQuad', easeInOut: 'inOutQuad', quadIn: 'inQuad', quadOut: 'outQuad',
  quadInOut: 'inOutQuad', cubicIn: 'inCubic', cubicOut: 'outCubic', cubicInOut: 'inOutCubic',
};
export function compositorEasing(settings: AnimationSettings): string | undefined {
  if (settings.delay || settings.loop || settings.repeat || settings.repeatDelay || settings.stopMethod || settings.remove) return;
  const easing = settings.easing ?? settings.timingFunction ?? 'linear';
  return typeof easing === 'string' ? nativeEasings[easing] : undefined;
}

export class CompositorAnimation extends Events {
  readonly nativeClock = true;
  value: number;
  target: number;
  private initial: number;
  private serial = 0;
  private state: 'scheduled' | 'running' | 'paused' | 'stopped' = 'scheduled';
  private removed = false;

  constructor(value: number, target: number, private duration: number, private easing: string,
    private publish: (value: number) => void, private sink: MotionSink) {
    super();this.value = value;this.initial = value;this.target = target;
  }
  get running() { return this.state === 'running'; }
  get done() { return this.state === 'stopped' || this.removed; }
  start(): this {
    if (this.removed || this.state === 'stopped') return this;
    if (this.state === 'paused') return this.resume();
    if (this.state === 'running') return this;
    return this.begin(this.target, this.duration);
  }
  private begin(target: number, duration: number): this {
    this.target = target;this.state = 'running';this.sink.prepare?.();
    this.value = target;this.publish(target);
    this.send('start', duration);this.emit('start');
    return this;
  }
  private send(action: MotionAction, duration = this.duration) {
    const serial = ++nextMotionSerial;this.serial = serial;
    this.sink.send(action, serial, this.target, duration, this.easing, feedback => {
      if (this.removed || feedback.serial !== this.serial || serial !== this.serial) return;
      if (feedback.state === 'paused' || feedback.state === 'stopped') {
        this.value = feedback.value;this.publish(feedback.value);
      }
      if (feedback.state === 'stopped' && this.state !== 'stopped') {
        this.state = 'stopped';this.emit('finish');
      }
    });
  }
  pause(): this { if (this.running) { this.state = 'paused';this.send('pause'); } return this; }
  resume(): this { if (!this.removed && this.state === 'paused') { this.state = 'running';this.publish(this.target);this.send('resume'); } return this; }
  stop(): this {
    if (this.done) return this;
    this.state = 'stopped';this.send('stop');this.emit('stop');return this;
  }
  restore(): this { if (!this.removed) this.begin(this.initial, 0);return this; }
  reverse(): this { if (!this.removed) this.begin(this.initial, this.duration);return this; }
  retarget(target: number): this { if (!this.removed) this.begin(target, this.duration);return this; }
  tick(_delta: number): boolean { return !this.done; }
  remove() { if (this.removed) return;this.removed = true;this.state = 'stopped';this.serial++;this.sink.dispose();this.emit('stop'); }
}
