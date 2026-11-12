import { cardKey, type SearchRow } from "../types";

export function searchRowFocus(rows: readonly SearchRow[], previous: SearchRow | undefined, column: number) {
  const row = Math.max(0, rows.findIndex(value => value.id === previous?.id));
  const cards = rows[row]?.cards ?? [];
  const key = previous?.cards[column] && cardKey(previous.cards[column]);
  const index = key ? cards.findIndex(card => cardKey(card) === key) : -1;
  return {row, column: index >= 0 ? index : Math.max(0, Math.min(column, cards.length - 1))};
}
