import { createMemo, createSignal } from "solid-js";

const letters = "abcdefghijklmnopqrstuvwxyz1234567890@./:_-".split("");
const symbols = [
  "@",
  ".",
  "/",
  ":",
  "_",
  "-",
  "?",
  "=",
  "&",
  "%",
  "+",
  "#",
  "[",
  "]",
  "!",
  "$",
  "(",
  ")",
  "*",
  "~",
  ",",
  ";",
  "\\",
  "'",
  '"',
  "|",
  "^",
  "{",
  "}",
  "<",
  ">",
  "`",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
];

export function createTextKeyboard() {
  const [text, setText] = createSignal("");
  const [key, setKey] = createSignal(0);
  const [upper, setUpper] = createSignal(false);
  const [symbolsOn, setSymbols] = createSignal(false);
  const characters = createMemo(() => symbolsOn() ? symbols : letters.map(letter => upper() ? letter.toUpperCase() : letter));
  return { text, setText, key, setKey, upper, setUpper, symbols: symbolsOn, setSymbols, characters };
}
