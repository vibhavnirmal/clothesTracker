
  # Minimal Clothes Tracker App

  This project is a Vite + React implementation of the Minimal Clothes Tracker experience. It now ships with a lightweight Express + SQLite API so wardrobe data persists beyond the browser.

  ## Prerequisites

  - Node.js 18+ (required by Vite/Bun tooling and the SQLite bindings)
  - npm (ships with Node)
  - Build tools for native modules (`python3`, `make`, `g++`) – needed the first time `better-sqlite3` compiles

  ## Installation

  ```bash
  npm install
  ```

  This downloads both the frontend dependencies and the backend packages (Express + SQLite bindings).

  ## Running in development

  The frontend expects the API to be available at `/api`. During development a Vite proxy forwards those calls to the Express server.

  1. Start the API server (writes data to `data/clothes.sqlite`):

  ```bash
  npm run server
  ```

  2. In another terminal, start the Vite dev server:

  ```
  npm run dev
  ```

  The app opens at http://localhost:3000 and will talk to the API running on http://localhost:4000 via the proxy declared in `vite.config.ts`.

  Prefer a single command? Use:

  ```bash
  npm run dev:full
  ```

  This runs both the API server and the Vite dev server in parallel.

  ## Building for production

  ```bash
  npm run build
  ```

  This creates an optimized bundle in `build/`. Serve the static files with your preferred host and run `npm run server` (or your own process manager) to expose the API.

  ## API quick reference

  All endpoints are JSON and live under `/api`.

  | Method | Endpoint        | Description                              |
  | ------ | --------------- | ---------------------------------------- |
  | GET    | `/api/state`    | Full snapshot of clothes, wears, washes |
  | POST   | `/api/clothes`  | Create a clothing item                   |
  | POST   | `/api/wears`    | Record wearing selected clothes today    |
  | POST   | `/api/washes`   | Mark selected clothes as washed          |
  | DELETE | `/api/clothes/:id` | Remove a clothing item (and its history) |

  The database file lives at `data/clothes.sqlite` and can be inspected with any SQLite client.

  ## Hosting with Docker (single container)

  A production-ready `Dockerfile` now lives at the project root. It builds the React frontend, prunes dev dependencies, and copies the API + static assets into a lightweight Node 22 runtime. The Express server serves both JSON endpoints under `/api` and the compiled SPA, so you only need a single container.

  ### Build the image

  ```bash
  docker build -t simple-clothes-tracker .
  ```

  ### Run it (with persistent storage)

  ```bash
  docker run \
    --name clothes-tracker \
    -p 8080:4000 \
    -v clothes-data:/app/data \
    -e PORT=4000 \
    -d simple-clothes-tracker
  ```

  - Visit the UI at http://localhost:8080 (adjust the published port as needed for your NAS).
  - All API routes remain available under `/api` on the same host/port.
  - The bundled Express server listens on `PORT` (defaults to `4000`); override it with `-e PORT=<port>` if your NAS prefers a different internal port.
  - The named volume `clothes-data` keeps the SQLite database between container restarts. Swap it for a bind mount (`/volume1/docker/clothes-tracker:/app/data`, for example) to store the data on your NAS filesystem.

  To upgrade, rebuild the image and restart the container:

  ```bash
  docker build -t simple-clothes-tracker .
  docker stop clothes-tracker && docker rm clothes-tracker
  docker run -p 8080:4000 -v clothes-data:/app/data -d simple-clothes-tracker
  ```

  If you prefer orchestration (e.g. Docker Compose, Portainer, Synology UI), mount `/app/data` and expose the container port that fits your network.