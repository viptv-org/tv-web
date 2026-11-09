/** @jsxImportSource @solidtv/solid */
import { TvView } from "../runtime";
import { welcomeWallSource } from "./tv-artwork.generated";

/** One precomposed texture: no runtime poster fanout, canvas readback or drift. */
export function PosterWall() {
  return <TvView w={1920} h={1080} src={welcomeWallSource()} fit="cover" />;
}
