/** SceneGraph's JavaScript engine has no Intl/Date locale formatting. Keep
 * every clock, guide time and calendar time on the same manual path. */
export function clockTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function timeOfDay(at: number): string {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return "--";
  const hour = date.getHours();
  return `${hour % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}
