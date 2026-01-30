## 2024-10-24 - Batch DOM Insertions in wiki_rabbithole
**Learning:** Appending elements to the DOM in a loop (e.g., `feedContainer.appendChild(item)`) causes unnecessary reflows/repaints. Using `DocumentFragment` allows batching these updates into a single reflow, improving rendering performance for lists.
**Action:** When implementing list rendering, always use `DocumentFragment` to build the list in memory before appending it to the DOM. Refactor functions like `createItem` to return the element instead of appending it directly.

## 2024-10-24 - O(N^2) Tree Rendering Bottleneck in wiki_rabbithole
**Learning:** The `renderTree` function was performing an O(N) search (`find`) inside an O(N) loop (`forEach`) to identify root nodes, resulting in O(N^2) complexity. As the user's history grows, this causes noticeable lag.
**Action:** Use a `Set` or `Map` for O(1) lookups when checking for existence of items in a collection during iteration. Replace `find` or `includes` inside loops with hash-based lookups.
