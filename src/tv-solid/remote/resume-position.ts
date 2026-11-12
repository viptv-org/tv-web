import { clockTime } from './time';
import type { Card, TitleAction } from './types';

export function savedPosition(milliseconds: unknown): number | undefined {
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds) || milliseconds < 0 ||
      milliseconds > 9007199254740991 || Math.floor(milliseconds) !== milliseconds) return;
  return milliseconds / 1000;
}
export function hasSavedPosition(card: Card): boolean {
  const exact = card.view?.preview?.resume_position_millis;
  if (exact !== undefined) return (savedPosition(exact) ?? 0) > 0;
  const progress = card.progress ?? card.view?.progress ?? 0;
  return progress > 0 && progress < 1;
}
export function savedPositionLabel(card: Card): string {
  const position = savedPosition(card.view?.preview?.resume_position_millis);
  return position !== undefined && position > 0 ? `Resume at ${clockTime(position)}` : 'Resume';
}
function initialPosition(card: Card): number {
  const exact = card.view?.preview?.resume_position_millis;
  if (exact !== undefined) return savedPosition(exact) ?? 0;
  // Older servers expose only progress; this compatibility estimate never supplies display copy.
  const progress = card.progress ?? card.view?.progress ?? 0;
  const runtime = card.metadata?.runtime_minutes ?? 0;
  const position = progress > 0 && progress < 1 && runtime > 0 ? progress * runtime * 60 : 0;
  return Number.isFinite(position) ? position : 0;
}
export function createSourceStartPosition() {
  let position = 0, pinned = false;
  return {
    current: () => position,
    begin(card: Card, restart: boolean, explicit?: number) {
      pinned = restart || explicit !== undefined;
      position = restart ? 0 : explicit === undefined ? initialPosition(card) : Number.isFinite(explicit) ? Math.max(0, explicit) : 0;
    },
    adopt(action: TitleAction) {
      if (pinned) return;
      if (!action.resume) position = 0;
      else if (action.resume_position_millis !== undefined) position = savedPosition(action.resume_position_millis) ?? 0;
    },
  };
}
