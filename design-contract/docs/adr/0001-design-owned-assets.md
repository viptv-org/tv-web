# Keep shared assets in the design repository

Design owns the authoritative app assets and generators alongside the specifications that use them. Apps retain pinned packaged copies rather than a recursive asset submodule: Roku remains byte-identical and builds remain self-contained, while explicit hash-reviewed sync commits make design changes visible. A separate asset repository can be introduced if size or release cadence later warrants it.
