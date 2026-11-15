import { timeOfDay } from "../time";

/** The programme's slot, plus how long it has left.
 *
 * A guide row is read at a glance: minutes under the hour, an end time above
 * it. A server that sends a marker far outside the schedule must not turn into
 * "136753587 min left", so anything past a day is reported as empty rather
 * than printed. */
export const PROGRAM_MAX_REMAINING_MS = 24 * 60 * 60 * 1000;

export function programLine(startMs: number, endMs: number, now = Date.now()): string {
  const slot = `${timeOfDay(startMs)} – ${timeOfDay(endMs)}`;
  const remaining = endMs - now;
  if (!(remaining > 0) || remaining > PROGRAM_MAX_REMAINING_MS) return slot;
  const minutes = Math.max(1, Math.round(remaining / 60000));
  if (minutes >= 60) return `${slot} · until ${timeOfDay(endMs)}`;
  return `${slot} · ${minutes} min left`;
}
