/** Provider live titles sometimes carry a raw ISO kickoff timestamp. */
export const liveTitle = (value?: string | null) => {
  if (!value) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return value
    .replace(
      /@\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/g,
      (_, iso: string) => {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return "";
        const hour = date.getHours();
        return `@ ${months[date.getMonth()]} ${date.getDate()}, ${hour % 12 || 12}:${String(
          date.getMinutes(),
        ).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
      },
    )
    .replace(/\s+/g, " ")
    .trim();
};
