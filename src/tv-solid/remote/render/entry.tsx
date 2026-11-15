/** @jsxImportSource @solidtv/solid */
import { Show } from "solid-js";
import { EntryScreen } from "../EntryScreens";
import { PairingScreen } from "../PairingScreen";
import { SignedIn } from "../SignedIn";
import type { Bootstrap, Pairing } from "../types";
import type { Screen } from "../app-types";

type EntryProps = Parameters<typeof EntryScreen>[0];
type PairingProps = Parameters<typeof PairingScreen>[0];
type SignedInProps = Parameters<typeof SignedIn>[0];

/** The three screens that stand between a cold TV and a profile: welcome,
 * pairing, and the signed-in confirmation. None of them belongs to the app's
 * own chrome — they fill the frame on their own. */
export function EntryScreensView(props: {
  screen: Screen;
  entry: EntryProps;
  pairing: Pairing | undefined;
  pairingQr: PairingProps["qr"];
  pairingDeadline: PairingProps["deadline"];
  pairingFocused: PairingProps["focused"];
  signedIn: Bootstrap | undefined;
  onSignedIn: SignedInProps["onComplete"];
}) {
  return <>
    <Show when={props.screen === "welcome"}>
      <EntryScreen loading={props.entry.loading} focused={props.entry.focused} />
    </Show>
    <Show when={props.screen === "pairing"}>
      <PairingScreen
        pairing={props.pairing}
        qr={props.pairingQr}
        deadline={props.pairingDeadline}
        focused={props.pairingFocused}
      />
    </Show>
    <Show when={props.screen === "signed-in" && props.signedIn}>
      {(value) => <SignedIn bootstrap={value()} onComplete={props.onSignedIn} />}
    </Show>
  </>;
}
