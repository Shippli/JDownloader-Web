# Stage 1: Build frontend
FROM oven/bun:alpine AS builder

WORKDIR /app

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Stage 2: Production runtime
FROM oven/bun:alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist
COPY src/server ./src/server

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["bun", "src/server/index.ts"]
