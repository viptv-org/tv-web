type FocusRow<T> = { id: string; cards: readonly T[] };

/** Remember identity as well as position so refreshed rows can reorder safely. */
export class RowFocus<T> {
  private rows = new Map<string, { index: number; key: string }>();
  constructor(private keyOf: (card: T) => string) {}
  remember(row: FocusRow<T> | undefined, column: number) {
    if (!row?.cards.length) return;
    const index = Math.max(0, Math.min(row.cards.length - 1, column));
    this.rows.set(row.id, { index, key: this.keyOf(row.cards[index]) });
  }
  resolve(row?: FocusRow<T>): number {
    if (!row?.cards.length) return 0;
    const saved = this.rows.get(row.id);
    if (!saved) return 0;
    if (row.cards[saved.index] && this.keyOf(row.cards[saved.index]) === saved.key) return saved.index;
    const index = row.cards.findIndex(card => this.keyOf(card) === saved.key);
    return index >= 0 ? index : Math.max(0, Math.min(saved.index, row.cards.length - 1));
  }
  retain(rows: readonly { id: string }[]) {
    const ids = new Set(rows.map(row => row.id));
    for (const id of this.rows.keys()) if (!ids.has(id)) this.rows.delete(id);
  }
  clear() { this.rows.clear(); }
}
