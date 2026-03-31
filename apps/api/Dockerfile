FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json tsconfig.json biome.json vitest.config.ts ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN npm run build

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/server.js"]
