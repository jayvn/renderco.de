## 2024-10-24 - Batch DOM Insertions in wiki_rabbithole
**Learning:** Appending elements to the DOM in a loop (e.g., `feedContainer.appendChild(item)`) causes unnecessary reflows/repaints. Using `DocumentFragment` allows batching these updates into a single reflow, improving rendering performance for lists.
**Action:** When implementing list rendering, always use `DocumentFragment` to build the list in memory before appending it to the DOM. Refactor functions like `createItem` to return the element instead of appending it directly.

## 2024-10-24 - O(1) Lookup in Tree Rendering
**Learning:** Iterating through an array with `find()` inside another loop (e.g., finding a parent node by property) creates an O(N²) bottleneck. For the `wiki_rabbithole` tree, this caused significant slowdowns with >100 nodes.
**Action:** Use a `Set` or `Map` to pre-calculate lookups (e.g., a set of existing titles) before the loop. This reduces complexity to O(N) and makes rendering nearly instant even for large datasets.
