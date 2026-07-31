# syntax=docker/dockerfile:1

# ---- deps: 전체 의존성 설치 (devDependencies 포함 — Prisma CLI 등 빌드/마이그레이션에 필요) ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: Next.js standalone 산출물 빌드 ----
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- migrator: 마이그레이션·관리 명령 전용 이미지. Prisma CLI·tsx 등
# devDependency를 그대로 유지하며 전체 소스를 포함한다. docker-compose에서
# 이 스테이지로 1회성 명령을 실행한다:
#   docker compose run --rm migrate                        (기본: prisma migrate deploy)
#   docker compose run --rm migrate npm run admin:create   (최초 관리자 생성)
#   docker compose run --rm migrate npm run db:seed        (로컬/스테이징 전용 시드)
FROM node:22-slim AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- runner: 실제 서비스 실행용 경량 이미지 (standalone 산출물만 포함) ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
