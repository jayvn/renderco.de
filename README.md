# Browser App Gallery

A simple platform for hosting and sharing browser-based web apps as PWAs using free hosting on github pages.

Live at: [renderco.de](https://renderco.de)

## Concept

This app gallery is designed for effortlessly sharing AI-generated web apps with friends. Perfect for apps created with:
- **Claude Artifacts**
- **ChatGPT Canvas**
- **Google Gemini**

Simply paste your generated app code, and it becomes a Progressive Web App (PWA) that works offline and can be installed on any device. No build tools, no complex setup - just paste and share.

**Features:**
- Zero-config app deployment - paste HTML/JS and go
- PWA support - works offline, installable on phones/desktop
- Shared navigation system (optional)
- Mobile-responsive dark theme
- Easy sharing via URL
## Philosophy
 
Avoid unnecessary exception/error handling and comments. For apps, errors should not be handled and should propagate to the console. Avoid React and use vanilla JavaScript. Code should be self-documenting and errors should be propagated unhandled for ease of understanding. Reduce code by using emojis instead of icons which are imported or drawn. Use default styles instead of too custom CSS. Use other refactoring methods while keeping functionality the same. Go for minimalism.


## Example Apps

- **ChoreoMarker** - Dance choreography marker ([docs](choreo/README.md))
- **Anil's Library** - Plasma Physics Calculator
- **Secret Santa** - Gift exchange organizer with real-time sync
- **Trip Planner** - Collaborative trip planning with expense tracking and voting
- **Group Expenses** - Expense tracker for groups
- **Matrix Code Gen** - Pixel art editor for LED matrix displays

## Quick Start

```bash
# Start local server
python3 -m http.server 8000
# Visit http://localhost:8000
```

## Adding Your AI-Generated App

### Method 1: Paste Claude Artifact / ChatGPT Canvas HTML

1. **Create folder:**
   ```bash
   mkdir my-app
   ```

2. **Paste your code:**
   - Copy the complete HTML from Claude/ChatGPT/Gemini
   - Save as `my-app/index.html`

3. **Add to gallery:**
   - Edit `index.html` and add a card in the `#apps` section

### Method 2: Use Templates

Templates include navigation and PWA setup:
```bash
cp _templates/html-app-template.html my-app/index.html
# or for React apps
cp _templates/react-app-template.html my-app/index.html
```

📖 **Detailed guide:** [_templates/README.md](_templates/README.md)

### Optional: Add Navigation

Include shared navigation in your app:
```html
<!-- In <head> -->
<link rel="stylesheet" href="/shared/nav.css">

<!-- Before </body> -->
<script src="/shared/nav.js"></script>
```

## Deployment

GitHub Actions auto-deploys on push to main branch. No build step needed - pure static files.

## File Structure

```
├── index.html              # Landing page with app gallery
├── style.css               # Main site styles
├── shared/                 # Shared navigation components
│   ├── nav.js
│   └── nav.css
├── _templates/             # App templates for quick start
├── your-app/               # Your apps go here
│   └── index.html
└── choreo/, shopping/, etc # Example apps
```

## How It Works

- **Self-contained apps**: Each app lives in its own folder
- **No build required**: Pure HTML/CSS/JS - paste and deploy
- **Optional navigation**: Use shared nav or go standalone
- **PWA-ready**: Add service worker for offline support
- **CDN-based React**: Single-file React apps via Babel CDN

## Tips

- Apps are standalone - test without navigation first
- Use absolute paths for shared resources (`/shared/`, `/images/`)
- See `_templates/` for quick-start templates
- PWA support: add manifest.json + service worker (sw.js)

---

📖 **Documentation:** [_templates/README.md](_templates/README.md)
