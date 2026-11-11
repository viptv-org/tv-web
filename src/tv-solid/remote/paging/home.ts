import type { Accessor, Setter } from "solid-js";
import type { RemoteTvApi } from "../api";
import type { Home, Row } from "../types";
import type { PageRequestOwner } from "./owner";

export function createHomePager(options: {
  owner: PageRequestOwner; rows: Accessor<Row[]>; row: Accessor<number>; column: Accessor<number>;
  adopt: Setter<Home | undefined>; request: RemoteTvApi["discover"];
}) {
  const {owner, adopt: setHome} = options;
  async function loadHomePage() {
    const generation = owner.generation();
    const current = options.rows()[options.row()];
    if (
      !current?.next_cursor ||
      !current.browse ||
      current.browse.target !== "Discover" ||
      owner.busy() ||
      options.column() < current.cards.length - 5
    )
      return;
    owner.setBusy(true);
    const identityFields = new Set([
      "type",
      "catalog",
      "connection_id",
      "addon_id",
    ]);
    const values = {
      ...Object.fromEntries(
        current.browse.query
          .filter((field) => identityFields.has(field.id))
          .map((field) => [field.id, field.values[0]]),
      ),
      values: current.browse.query.filter(
        (field) => !identityFields.has(field.id),
      ),
    };
    try {
      const result = await options.request(
        { ...values, skip: current.next_cursor },
        owner.signal(),
      );
      if (generation !== owner.generation()) return;
      setHome((old) =>
        old
          ? {
              ...old,
              rows: old.rows.map((r) =>
                r.id === current.id
                  ? {
                      ...r,
                      cards: [...r.cards, ...result.cards],
                      next_cursor: result.next_cursor,
                    }
                  : r,
              ),
            }
          : old,
      );
    } catch (e) {
      if (generation === owner.generation()) {
        owner.cancelFocus();
        owner.fail(e);
      }
    } finally {
      if (generation === owner.generation()) {
        owner.setBusy(false);
        owner.settleFocus();
      }
    }
  }
  return loadHomePage;
}
