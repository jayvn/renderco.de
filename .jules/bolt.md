## 2026-01-25 - Batch DOM Insertions
**Learning:** `wiki_rabbithole` rendered lists (feed, bookmarks, search) by appending elements individually within loops, causing unnecessary reflows.
**Action:** When working with vanilla JS list rendering in this repo, always use `DocumentFragment` to batch insertions into a single reflow.
