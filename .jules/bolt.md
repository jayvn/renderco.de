## 2024-10-24 - Batch DOM Insertions in wiki_rabbithole
**Learning:** Appending elements to the DOM in a loop (e.g., `feedContainer.appendChild(item)`) causes unnecessary reflows/repaints. Using `DocumentFragment` allows batching these updates into a single reflow, improving rendering performance for lists.
**Action:** When implementing list rendering, always use `DocumentFragment` to build the list in memory before appending it to the DOM. Refactor functions like `createItem` to return the element instead of appending it directly.

## 2026-02-04 - Optimize Tree Rendering to O(N)
**Learning:** In `wiki_rabbithole/app.js`, `renderTree` had an O(N^2) bottleneck due to a nested search using `Object.keys().find()`. For checking existence in a large dataset (like a history tree), always use a `Set` for O(1) lookups.
**Action:** Replaced linear search with `Set.has()`. Always verify algorithmic complexity on potential large datasets.
