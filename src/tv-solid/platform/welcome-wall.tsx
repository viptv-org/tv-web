/** @jsxImportSource @solidtv/solid */
import { For } from "solid-js";
import { TvView } from "../runtime";
import { entryArt } from "../remote/entry-art";


/** Vite emits imported artwork as { uri, dimensions }; Roku needs the URI. */
function uriOf(value: any): string {
  if (typeof value === "string") return value;
  if (value && typeof value.uri === "string") return value.uri;
  return "pkg:/assets/fallback.png";
}

const SCALE = 1920 / 2520;
const TILE_W = 236 * SCALE;
const TILE_H = 354 * SCALE;
const STEP_X = 252 * SCALE;
const STEP_Y = 372 * SCALE;

/** The Roku poster wall: the same 10x4 design grid, but every tile is a real
 * SceneGraph Poster and the scrim is a packaged native image. */
export function NativeWelcomeWall() {
  return (
    <>
      <For each={entryArt}>
        {(src, index) => (
          <TvView
            x={(index() % 10) * STEP_X}
            y={Math.floor(index() / 10) * STEP_Y}
            w={TILE_W + 1}
            h={TILE_H + 1}
            src={uriOf(src)}
            fit="cover"
          />
        )}
      </For>
      <TvView w={1920} h={1080} src="pkg:/assets/welcome-scrim.png" />
      <TvView w={1920} h={1080} src="pkg:/assets/welcome-vignette.png" />
    </>
  );
}
