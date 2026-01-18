# Bolt's Journal

## 2024-05-22 - [Infinite Scroll Throttling]
**Learning:** Infinite scroll implementations using raw `scroll` events can cause performance bottlenecks due to frequent layout thrashing (calculating `scrollTop`, `scrollHeight`, etc.) on every pixel scrolled.
**Action:** Always wrap scroll event handlers with a throttle function (ideally with trailing edge execution) to limit the frequency of these expensive checks.

## 2024-05-23 - [Lazy Loading Feed Images]
**Learning:** Pre-fetching batches of items (e.g., 5 items of 100vh height) with high-resolution background images causes immediate massive network and memory spikes, even for off-screen items.
**Action:** Use `IntersectionObserver` with a `rootMargin` (e.g., `600px`) to lazy-load background images only when they approach the viewport, significantly reducing initial load weight.
