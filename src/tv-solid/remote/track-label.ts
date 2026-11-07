import type { ServerTrack } from "./types";

// Display-only ISO 639 names; selection continues to use server input indices.
// https://www.loc.gov/standards/iso639-2/php/code_list.php
const languages: Record<string, string> = Object.create(null);
for (const [codes, name] of [
  ["en eng", "English"], ["hi hin", "Hindi"], ["es spa", "Spanish"],
  ["fr fra fre", "French"], ["de deu ger", "German"], ["it ita", "Italian"],
  ["ja jpn", "Japanese"], ["ko kor", "Korean"], ["zh zho chi", "Chinese"],
  ["pt por", "Portuguese"], ["ru rus", "Russian"], ["ar ara", "Arabic"],
  ["ta tam", "Tamil"], ["te tel", "Telugu"], ["ml mal", "Malayalam"],
  ["bn ben", "Bengali"], ["ur urd", "Urdu"], ["pa pan", "Punjabi"],
  ["cs ces cze", "Czech"], ["nl nld dut", "Dutch"], ["pl pol", "Polish"],
  ["sv swe", "Swedish"], ["da dan", "Danish"], ["el ell gre", "Greek"],
  ["tr tur", "Turkish"], ["uk ukr", "Ukrainian"], ["fi fin", "Finnish"],
  ["th tha", "Thai"], ["vi vie", "Vietnamese"], ["he heb", "Hebrew"],
]) for (const code of codes.split(" ")) languages[code] = name;

export function trackLabel(track: ServerTrack, fallback: string): string {
  const code = track.language?.trim().toLowerCase();
  const title = track.title?.trim();
  if (!code || code === "und") return title || fallback;
  const language = languages[code] ?? code.toUpperCase();
  if (!title || /^(audio|subtitle) track \d+$/i.test(title)) return language;
  if (title.toLowerCase().includes(language.toLowerCase())) return title;
  const channels = /\b([1-9]\.\d)\b/.exec(title)?.[1];
  if (channels && /^(Dolby|AAC\b|AC3\b|EAC3\b|DTS\b|FLAC\b|Opus\b|MPEG\b)/i.test(title))
    return `${language} · ${channels}`;
  return `${language} · ${title}`;
}
