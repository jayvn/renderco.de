## 2026-01-27 - Batch DOM Updates
**Learning:** Vanilla JS list rendering functions (`createFeedItem`, `createBookmarkItem`) were returning `void` and appending directly to the container, causing layout thrashing in loops.
**Action:** Always return the DOM element from factory functions and use `DocumentFragment` to batch appends in the calling loop.
