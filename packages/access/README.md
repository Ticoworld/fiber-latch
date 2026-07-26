# FiberLatch Access

FiberLatch Access is a Node package under implementation. This step establishes the package boundary and distribution compatibility only.

- `@fiberlatch/access` is a provisional package name.
- `private: true` prevents accidental publication.
- The package may still be packed locally for verification.
- No stable public receipt API is available yet.
- Minimum Node version: `>=22.12.0`.
- Implementation format: native ESM.
- Supported CommonJS hosts use Node's `require(esm)` behavior.
- Browser support is not included.
- Package publication has not occurred.
- The backend remains the reference implementation.

The committed consumer fixtures are distribution smoke tests for the package boundary. They will be updated to exercise the real public operations as those APIs are implemented.
