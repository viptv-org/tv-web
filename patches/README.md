The pinned Canvas renderer patch retains loaded text pixels until a replacement
texture is ready. It bounds each label to one pending replacement, cancels
superseded/destroyed work and clears empty text. Source and distributed JavaScript
are patched together. `patch-package` applies it after installation; Canvas
browser tests exercise visible updates and resource cleanup.
