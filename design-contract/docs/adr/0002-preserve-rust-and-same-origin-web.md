# Preserve Rust policy and pin the independent web build

Keep the existing Rust backend and extract React web into its own repository, pinned as the backend dashboard submodule. This permits independent UI delivery while retaining the established same-origin cookie/CSRF contract and one deployable image. Shared TypeScript/Kotlin contract generation is a future step; speculative Rust FFI and a backend rewrite are not prerequisites for splitting working code.

GitHub repository policy disables deploy keys. Backend therefore vendors the checksummed compiled web bundle tied to that source gitlink, so CI needs no broad account credential. The web source stays independently owned; promotion is an explicit tested update.
