The pinned Canvas renderer patch retains loaded text pixels until a replacement
texture is ready. It bounds each label to one pending replacement, cancels
superseded/destroyed work and clears empty text. Source and distributed JavaScript
are patched together. `patch-package` applies it after installation; Canvas
browser tests exercise visible updates and resource cleanup.

Property-animation replacement also stops the retired controller. This keeps a
recycled card rail's zero-duration reset from being overwritten on later frames.

The pinned WebGL renderer 2.0.7 patch bounds each image-bitmap capability probe
and bitmap decoding at two seconds. Timed-out decodes release
late bitmap results. Blob decoding retains the image-element fallback, SVG
conversion retains its pixel fallback, and local image-element loads have a
bounded wait with object URL cleanup. The browser's global API remains intact.
Source, distributed JavaScript and internal decoder declarations are patched
together; focused tests exercise source and distribution, including the serialized
image-worker decoder.
