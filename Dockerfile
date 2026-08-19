# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
# Build-time value only; the real secret is supplied at run time.
ENV SESSION_SECRET="build-time-placeholder-not-used-at-runtime-000000"
ENV DATABASE_URL="file:/data/deposits.db"
RUN npm run build

# ---------- run ----------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# The database lives on a mounted volume, never in the image layer.
ENV DATABASE_URL="file:/data/deposits.db"
RUN mkdir -p /data && chown node:node /data
VOLUME /data

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# Migrations, seed and backup run against the live volume.
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/lib ./lib
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/tsx ./node_modules/tsx
COPY --from=build /app/node_modules/.bin ./node_modules/.bin
COPY package.json ./

USER node
EXPOSE 3000

# Apply any pending migrations, then serve.
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
