/** Pre-render the two reference glass regions at eight zoom positions. Each
 * small canvas task yields, and only the current/previous image owns an atlas.
 * Interpolation moves at most ~5px between samples, below the 24px blur radius.
 */
export async function billboardBlur(
  image: HTMLImageElement,
  cancelled: () => boolean,
): Promise<ImageData | undefined> {
  const source = document.createElement("canvas"),
    blurred = document.createElement("canvas"),
    atlas = document.createElement("canvas");
  source.width = blurred.width = 308;
  source.height = blurred.height = 216;
  atlas.width = 576;
  atlas.height = 144;
  const input = source.getContext("2d")!,
    output = blurred.getContext("2d")!,
    packed = atlas.getContext("2d")!;
  if (!("filter" in output)) {
    source.width = blurred.width = atlas.width = 0;
    return undefined;
  }
  const scale = Math.max(1920 / image.naturalWidth, 1080 / image.naturalHeight);
  const width = image.naturalWidth * scale,
    height = image.naturalHeight * scale;
  try {
    for (let frame = 0; frame < 8; frame++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (cancelled()) return undefined;
      const zoom = 1 + (0.06 * frame) / 7;
      input.fillStyle = "#0B0B0C";
      input.fillRect(0, 0, 308, 216);
      input.drawImage(
        image,
        960 + ((1920 - width) * 0.5 - 960) * zoom - 264,
        540 + ((1080 - height) * 0.3 - 540) * zoom - 576,
        width * zoom,
        height * zoom,
      );
      const left = input.createLinearGradient(-264, 0, 1920 - 264, 0);
      left.addColorStop(0, "rgba(11,11,12,.85)");
      left.addColorStop(0.34, "rgba(11,11,12,.55)");
      left.addColorStop(0.62, "rgba(11,11,12,0)");
      left.addColorStop(1, "rgba(11,11,12,0)");
      input.fillStyle = left;
      input.fillRect(0, 0, 308, 216);
      const bottom = input.createLinearGradient(0, 560 - 576, 0, 1080 - 576);
      bottom.addColorStop(0, "rgba(11,11,12,0)");
      bottom.addColorStop(0.55, "rgba(11,11,12,.92)");
      bottom.addColorStop(1, "#0B0B0C");
      input.fillStyle = bottom;
      input.fillRect(0, 0, 308, 216);
      output.clearRect(0, 0, 308, 216);
      output.filter = "blur(24px)";
      output.drawImage(source, 0, 0);
      packed.drawImage(blurred, 72, 72, 72, 72, frame * 72, 0, 72, 72);
      packed.drawImage(blurred, 164, 72, 72, 72, frame * 72, 72, 72, 72);
    }
    return packed.getImageData(0, 0, 576, 144);
  } finally {
    source.width = blurred.width = atlas.width = 0;
  }
}
