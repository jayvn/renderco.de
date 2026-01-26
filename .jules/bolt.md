## 2024-05-22 - Layout Thrashing in Feed Loading
**Learning:** The `loadArticles` function in `wiki_rabbithole` was appending items to the DOM one by one inside a loop. Since the feed container is in the document flow, this caused multiple reflows (layout thrashing) for each batch of fetched articles.
**Action:** Always use `DocumentFragment` when appending multiple elements to the DOM in vanilla JavaScript loops. This reduces N reflows to 1.
