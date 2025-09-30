Minimal Clothes Tracker
=======================

A tiny React + Express app that helps you log outfits, track washes, and keep your wardrobe organised. SQLite stores the history so you can back it up or move it anywhere.

Highlights
----------
- Add clothing with type, colour, and optional photo (camera and gallery friendly).
- One-tap wear logging and washing with a timeline and inventory analysis.

Quick start
-----------
```
npm install
npm run server   # API on http://localhost:4000 (writes to data/clothes.sqlite)
npm run dev      # Web app on http://localhost:3000
npm run dev:full # run both together
```

Deploy
------
```
npm run build
```
The static bundle lands in `build/`, and the Express server keeps serving JSON under `/api`. Use the included Dockerfile if you prefer a single-container deploy.

Offline & install experience (Phases 1–4)
----------------------------------------
- The client ships with a service worker (cache-first for static assets, network-first for API calls) and a web manifest.
- Wear/wash actions queue locally while offline, deduplicate identical events, and replay in order once connectivity returns.
- Failed sync attempts retry automatically with exponential backoff, background sync registration, and a manual "Retry now" button in the banner.
- Visit the app once online, then reopen it offline; the queue keeps your data safe until it reaches the server again.
- Desktop Chrome, Android Chrome, and Safari surface install prompts. On iOS Safari, tap the share icon → "Add to Home Screen" to install.

API
---
| Method | Endpoint           | Purpose                |
| ------ | ------------------ | ---------------------- |
| GET    | `/api/state`       | Current clothes + logs |
| POST   | `/api/clothes`     | Add or edit an item    |
| POST   | `/api/wears`       | Record today’s wears   |
| POST   | `/api/washes`      | Mark items washed      |
| DELETE | `/api/clothes/:id` | Remove an item         |

Data lives in `data/clothes.sqlite`—back it up if you want to keep the timeline.

Helper scripts
--------------
- `scripts/run-clothestracker.bash` builds the image and runs the container on port 4242 (macOS/Linux).
- `scripts/run-clothestracker.bat` does the same for Windows.