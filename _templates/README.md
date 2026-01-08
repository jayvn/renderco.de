# App Templates

Quick-start templates for adding new apps to the Karayogam website.

## 🚀 Quick Start

### Option 1: HTML App (Vanilla JS)

1. **Copy the template:**
   ```bash
   cp _templates/html-app-template.html my-app/index.html
   ```

2. **Edit your app:**
   - Replace "My App Name" with your actual app name
   - Add your HTML content
   - Add your CSS styles
   - Add your JavaScript logic

3. **Optional - Add navigation:**
   - Uncomment the navigation lines in the template
   - This adds the Karayogam nav bar to your app
   - **Smart detection**: Nav auto-hides when app is installed as PWA

4. **Add to homepage:**
   - Edit `/index.html`
   - Add a new app card in the `#apps` section:
   ```html
   <div class="app-card">
       <div class="app-icon">🎯</div>
       <h3>My App</h3>
       <p>Description of what your app does</p>
       <a href="/my-app/" class="app-link">Open App →</a>
   </div>
   ```

5. **Update navigation dropdown** (optional):
   - Edit `/shared/nav.js`
   - Add your app to the `apps` array:
   ```javascript
   { name: 'My App', path: '/my-app/', icon: '🎯' }
   ```

### Option 2: React App (Single File)

1. **Copy the template:**
   ```bash
   cp _templates/react-app-template.html my-react-app/index.html
   ```

2. **Edit your app:**
   - Replace component code with your React components
   - Add your styles
   - Import additional libraries if needed (from CDN)

3. **Follow steps 3-5 from Option 1** to integrate with the site

## 📁 Recommended File Structure

```
karayogam-site/
├── my-app/                 # Your new app
│   ├── index.html          # Main app file
│   ├── sw.js              # Optional: Service worker for PWA
│   └── manifest.json      # Optional: PWA manifest
├── shared/                 # Shared components (nav, etc.)
├── _templates/            # This folder - templates
└── index.html             # Main site homepage
```

## 🎨 Styling Guidelines

### If using navigation:
```css
body {
    margin: 0; /* Remove default margin */
}

.main-content {
    padding: 20px; /* Content wrapper */
}
```

### Standalone (no navigation):
```css
body {
    margin: 20px; /* Your choice */
}
```

## 🔧 Advanced: Making it a PWA

1. **Create a service worker** (`sw.js`):
```javascript
const CACHE_NAME = 'my-app-v1';
const urlsToCache = ['./index.html', './'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
```

2. **Create a manifest** (`manifest.json`):
```json
{
    "name": "My App",
    "short_name": "MyApp",
    "start_url": "/my-app/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#0077cc",
    "icons": [
        {
            "src": "/images/logo.png",
            "sizes": "192x192",
            "type": "image/png"
        }
    ]
}
```

3. **Register in your HTML:**
```html
<link rel="manifest" href="manifest.json">
<script>
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
</script>
```

## 📝 Examples

Check out existing apps for reference:
- `/shopping/` - Simple vanilla JS PWA with localStorage
- `/choreo/` - Vanilla JS PWA with complex state management
- `/anils-library/` - Scientific calculator with visualizations

## 🎯 Best Practices

1. **Keep apps modular** - Each app in its own folder
2. **Use relative paths** - For assets within your app
3. **Use absolute paths** - For shared resources (`/shared/`, `/images/`)
4. **Make navigation optional** - App should work standalone
5. **Add metadata** - Title, description, icons
6. **Test standalone** - Make sure app works without navigation
7. **Keep it simple** - Single file apps are easiest to maintain

## 🔗 Adding External Libraries

### Via CDN (Recommended for single-file apps):
```html
<!-- React -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>

<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

### Via npm (For build-based apps):
```bash
cd my-app
npm init -y
npm install react react-dom
# ... then use a bundler like Vite or Webpack
```

## 💡 Tips

- **Test locally:** `python3 -m http.server 8000`
- **Check navigation:** Apps in dropdown should match homepage gallery
- **Mobile first:** Test on mobile - navigation is responsive
- **Keep it fast:** Minimize dependencies, lazy load when possible
- **Use localStorage:** For simple data persistence
- **Add PWA support:** Makes app installable and offline-capable

## 🆘 Common Issues

**Navigation not showing?**
- Check if nav.js script is included
- Check if nav.css stylesheet is linked
- Open console for errors

**App not in dropdown?**
- Update `/shared/nav.js` apps array
- Clear cache and refresh

**Styling conflicts?**
- Check CSS specificity
- Use scoped classes for your app
- Nav styles are prefixed with `.karayogam-nav`

---

Happy building! 🚀
