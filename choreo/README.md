# ChoreoMarker

ChoreoMarker is a choreography marking tool for dance rehearsals, designed to help dancers and choreographers mark timings and sections during practice sessions.

## Features

- **Audio Playback** - Waveform visualization with timeline scrubbing
- **Dancer Positioning** - Drag-and-drop dancers on a virtual stage
- **Timeline Marking** - Mark movements and notes at specific timestamps
- **Data Persistence** - Auto-saves to local storage (works offline)
  - IndexedDB for audio files (handles files > 10MB)
  - localStorage for dancers, marks, and positions
- **PWA Support** - Installable on mobile devices, works offline
- **Export/Import** - Save and load choreography data as JSON

## Architecture

Built with vanilla web technologies:
- **Vanilla JavaScript** - No frameworks, just pure JS
- **Tailwind CSS** - Styling via CDN
- **IndexedDB + localStorage** - Client-side data persistence
- **PWA** - Service worker for offline support
- **Canvas API** - Waveform visualization

## Local Development

### Prerequisites
- Any local web server (Python, PHP, Node.js http-server, etc.)

### Setup and Run

```bash
cd choreo

# Using Python 3
python3 -m http.server 8000

# Or using Node.js http-server
npx http-server -p 8000
```

Visit `http://localhost:8000/`

## Deployment

**Fully automated via GitHub Actions** - No build step needed!

### How It Works

1. Edit source files in `choreo/`
2. Push to master branch
3. GitHub Actions automatically:
   - Copies source files to deployment directory
   - Deploys to GitHub Pages

### What NOT to Do

❌ Do NOT add build tools or dependencies
❌ Do NOT create a build step
❌ Files are deployed as-is from the repository

The app is production-ready directly from source - no compilation needed!

## File Structure

```
choreo/
├── app.js            # Vanilla JavaScript application code
├── index.html        # Main HTML file (production-ready)
├── manifest.json     # PWA manifest
├── sw.js             # Service worker for offline support
├── .gitignore        # Git ignore rules
└── README.md         # This file
```

## Storage & Persistence

Data persists across browser sessions (even after closing):

**IndexedDB** (for large files):
- Audio file blobs
- Handles files > 10MB with no issues

**localStorage** (for app data):
- Dancers list
- Bookmarks/marks
- Dancer positions
- Audio filename

**Clear Storage:**
Use the "Clear Storage" button in the app to wipe all saved data.

## Configuration

- **Base Path**: `/choreo/` for GitHub Pages routing
- **PWA Manifest**: `manifest.json` for installability
- **Service Worker**: `sw.js` for offline support (cache-first strategy)

## Troubleshooting

**Dev server won't start:**
- Use any static file server (Python, http-server, etc.)
- Ensure you're serving from the choreo directory

**Data not persisting:**
- Check browser console for storage errors
- Ensure you're not in private/incognito mode
- Storage works in all modern browsers with IndexedDB support

**PWA not installing:**
- Verify service worker is registered (check console)
- PWA requires HTTPS (works on localhost and GitHub Pages)
- Check manifest.json is accessible

## Development Notes

This app uses vanilla JavaScript with no build process:
- Direct script loading via `<script src="/choreo/app.js"></script>`
- Tailwind CSS loaded from CDN
- All modern browser APIs (Canvas, IndexedDB, Service Workers)
- Progressive enhancement for offline functionality
