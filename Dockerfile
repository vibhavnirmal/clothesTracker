# Multi-stage build for Simple Clothes Tracker

FROM node:22-slim AS build
WORKDIR /app

# Native dependencies required to compile better-sqlite3
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    pkg-config \
    libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Chicago

# Install tzdata for timezone support
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata \
  && rm -rf /var/lib/apt/lists/*

# Copy runtime dependencies and application code
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/build ./build

# Ensure data directory exists for SQLite database (mount as volume for persistence)
RUN mkdir -p /app/data

EXPOSE 4000
CMD ["node", "server/index.js"]
