## 2024-05-22 - [DOM Batching in Vanilla JS Apps]
**Learning:** The "Browser App Gallery" architecture relies heavily on vanilla JS `appendChild` in loops for list rendering (e.g., feeds, search results). This creates N+1 reflows, which is a significant bottleneck on mobile devices despite the simplicity of the code.
**Action:** Always refactor iterative DOM creation (like `createFeedItem`) to return elements and use `DocumentFragment` for batch insertion in parent functions. This is a consistent, low-risk optimization for this specific codebase structure.
