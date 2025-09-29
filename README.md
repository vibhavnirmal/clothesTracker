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