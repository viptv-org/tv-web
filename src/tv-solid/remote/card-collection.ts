import { cardKey, type Card } from "./types";

export const uniqueCards = (cards: readonly Card[]) =>
  cards.filter(
    (card, index, all) =>
      all.findIndex((other) => cardKey(other) === cardKey(card)) === index,
  );


