Clothes Tracker
===============

Track your wardrobe, log what you wear, and know when it's time to do laundry.

Features
--------
- Add clothes with photos, types, and colors
- Track when you wear items
- Log washing cycles
- See your clothing timeline on a calendar

Quick Start
-----------
```bash
npm install
npm run dev:full
```
Then open http://localhost:3000


Data Storage
------------
All your data is stored locally in `data/clothes.sqlite`. Back up this file to keep your history.

Docker
------
```bash
docker build -t clothes-tracker .
docker run -p 4242:4000 -v $(pwd)/data:/app/data clothes-tracker
```
Or use the helper scripts in `scripts/` folder.
