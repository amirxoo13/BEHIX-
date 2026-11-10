# BEHIX on Google Cloud Run: site + /api/tts in one Node server (Nitro node-server preset).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
ENV NITRO_PRESET=node-server
# Only Google Cloud on this site: no third-party "Created with Grok" script (grok.com) in the pages.
ENV VITE_GROK_EXTENSIONS=0
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 VITE_GROK_EXTENSIONS=0
# Cloud Run (and nginx with $proxy_add_x_forwarded_for) append the real client IP last.
ENV TRUSTED_IP_HEADER=x-forwarded-for
COPY --from=build /app/.output ./.output
USER node
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
