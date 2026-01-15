# Bolt's Journal

## 2024-05-22 - [Infinite Scroll Throttling]
**Learning:** Infinite scroll implementations using raw `scroll` events can cause performance bottlenecks due to frequent layout thrashing (calculating `scrollTop`, `scrollHeight`, etc.) on every pixel scrolled.
**Action:** Always wrap scroll event handlers with a throttle function (ideally with trailing edge execution) to limit the frequency of these expensive checks.
