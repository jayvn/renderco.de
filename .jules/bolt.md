## 2024-10-24 - Batch DOM Insertions in wiki_rabbithole
**Learning:** Appending elements to the DOM in a loop (e.g., `feedContainer.appendChild(item)`) causes unnecessary reflows/repaints. Using `DocumentFragment` allows batching these updates into a single reflow, improving rendering performance for lists.
**Action:** When implementing list rendering, always use `DocumentFragment` to build the list in memory before appending it to the DOM. Refactor functions like `createItem` to return the element instead of appending it directly.

## 2026-02-03 - Optimize Tree Root Lookup in wiki_rabbithole
**Learning:** The `renderTree` function used an O(N^2) nested loop to identify root nodes by searching `nodesMap` keys for every node. This creates a significant bottleneck as history grows.
**Action:** Use a `Set` to store article titles for O(1) existence checks. Always verify complexity of `find` or `filter` inside loops.
