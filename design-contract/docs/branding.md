# VIPTV branding asset source

`assets/roku/roku/images/viptv-wordmark.png` is the checked-in master for the VIPTV V mark. Its SHA-256 is `4d6d473c5ba0f9ab6cf7b26a36f8fa85da3abeb543817480a2af6512b47c8f7b`. The derived mark, splash, and Roku channel poster are listed in [the asset manifest](../assets/ASSET_MANIFEST.md).

To regenerate derived Roku branding, run `npm install --prefix assets/roku --no-audit --no-fund`, then `node assets/roku/roku/tools/make_brand_assets.cjs`. This operation reads the preserved wordmark and rewrites only `viptv-mark.png`, `splash-hd.jpg`, and `channel-poster-hd.jpg` in the Roku design asset copy. Verify the three SHA-256 values against an updated manifest before publishing an asset sync.

The script's `--extract` path is retained as historical provenance only: it required the pre-extraction original image, which is not an authoritative design input. Do not extract from a generated splash. The baseline process and restriction are recorded in the [Roku source and build instructions](https://github.com/viptv-org/roku/blob/a047d9ca5fc80898013eefb66120d20fab5048c0/roku/README.md).
