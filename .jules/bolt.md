## 2024-05-23 - Batch DOM and Randomization
**Learning:** Using `DocumentFragment` for batched DOM insertions significantly reduces reflows in list rendering (feed, bookmarks, search).
**Action:** Always prefer `DocumentFragment` when appending multiple elements in a loop.
**Learning:** `.sort(() => Math.random() - 0.5)` is biased and O(N log N). Fisher-Yates shuffle is O(N) and unbiased.
**Action:** Use a dedicated shuffle utility for randomization.
