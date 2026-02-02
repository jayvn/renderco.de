## 2024-10-24 - Batch DOM Insertions in wiki_rabbithole
**Learning:** Appending elements to the DOM in a loop (e.g., `feedContainer.appendChild(item)`) causes unnecessary reflows/repaints. Using `DocumentFragment` allows batching these updates into a single reflow, improving rendering performance for lists.
**Action:** When implementing list rendering, always use `DocumentFragment` to build the list in memory before appending it to the DOM. Refactor functions like `createItem` to return the element instead of appending it directly.

## 2024-10-25 - Optimize History Tree Rendering
**Learning:** Nested lookups using `Object.keys().find()` inside a loop create O(N^2) complexity, causing significant lag (~4s for 5k nodes).
**Action:** Use a `Set` to cache keys/titles for O(1) existence checks, reducing complexity to O(N) (~16ms).
