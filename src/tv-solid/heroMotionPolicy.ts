/** TV-042 motion selection, mirroring Android's HeroMotionPolicy. Core owns the
 * category and edge pool (`heroEdgePool`); this module owns only the shuffle
 * bags that keep each hero change from repeating a style. */

export interface HeroTransitionSpec {
  readonly id: string;
  readonly name: string;
  /** Seconds. */
  readonly duration: number;
}

/** Core's `HeroEdgePool` shape, kept structural so tests need no bridge. */
export interface HeroEdgeChoice {
  readonly category: string | null;
  readonly edges: readonly string[];
}

/** The design's straight ramp: never drawn into rotation, used when a pool is empty. */
export const BASELINE_EDGE = "linear";
/** The crossfade: never drawn into rotation, used when a transition fails to compile. */
export const BASELINE_TRANSITION = "fade";
/** Bag key for titles Core assigns no category (every edge except the baseline). */
export const UNCATEGORIZED_BAG = "*";
const TRANSITION_BAG = "\u0000transitions";

export type Random = () => number;

/**
 * Transitions use one bag and edges one bag per category. A bag holds each pool
 * member once in random order and refills only when empty; a draw never
 * returns the style currently shown while another pool member exists.
 */
export class HeroMotionPolicy {
  private readonly transitions: readonly HeroTransitionSpec[];
  private readonly bags = new Map<string, string[]>();
  /** The catalog's crossfade, played when a drawn transition fails to compile. */
  readonly crossfade: HeroTransitionSpec | undefined;

  constructor(catalog: readonly HeroTransitionSpec[], private readonly random: Random = Math.random) {
    const rotation = catalog.filter(spec => spec.id !== BASELINE_TRANSITION);
    this.transitions = rotation.length ? rotation : catalog;
    this.crossfade = catalog.find(spec => spec.id === BASELINE_TRANSITION);
  }

  nextTransition(current?: string): HeroTransitionSpec {
    const id = this.draw(TRANSITION_BAG, this.transitions.map(spec => spec.id), current);
    return this.transitions.find(spec => spec.id === id)!;
  }

  /** The bag key for a Core pool: its category, or the uncategorized bag. */
  static bagKey(choice: HeroEdgeChoice): string {
    return choice.category ?? UNCATEGORIZED_BAG;
  }

  nextEdge(choice: HeroEdgeChoice, current?: string): string {
    if (!choice.edges.length) return BASELINE_EDGE;
    return this.draw(HeroMotionPolicy.bagKey(choice), choice.edges, current);
  }

  /** The next member a bag would yield, for warming its program ahead of use. */
  peekTransition(): string | undefined {
    const bag = this.bags.get(TRANSITION_BAG);
    return bag?.[bag.length - 1];
  }

  peekEdge(choice: HeroEdgeChoice): string | undefined {
    const bag = this.bags.get(HeroMotionPolicy.bagKey(choice));
    return bag?.[bag.length - 1];
  }

  private draw(key: string, pool: readonly string[], current: string | undefined): string {
    let bag = this.bags.get(key);
    if (!bag) this.bags.set(key, (bag = []));
    // TV-042: a refilled bag holds every pool member once; the swap below keeps
    // the shown style from being drawn first. (Android drops it from the refill.)
    if (!bag.length) bag.push(...this.shuffled(pool));
    let pick = bag.pop()!;
    if (pick === current && bag.length) {
      const swap = bag.pop()!;
      bag.unshift(pick);
      pick = swap;
    } else if (pick === current && pool.length > 1) {
      // The bag's last member is on screen (e.g. it was drawn by another
      // category): start the next bag now, with that member drawn last.
      bag.push(pick, ...this.shuffled(pool.filter(id => id !== pick)));
      pick = bag.pop()!;
    }
    return pick;
  }

  private shuffled(values: readonly string[]): string[] {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(this.random() * (index + 1));
      const value = result[index];
      result[index] = result[other];
      result[other] = value;
    }
    return result;
  }
}
