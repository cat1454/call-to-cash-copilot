FROM mcr.microsoft.com/playwright:v1.56.0-noble

WORKDIR /app
COPY . .
RUN corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @call-to-cash/rtm-relay build

ENV NODE_ENV=production
ENV RTM_RELAY_HOST=0.0.0.0
ENV RTM_RELAY_BROWSER_EXECUTABLE_PATH=/ms-playwright/chromium-1194/chrome-linux/chrome

CMD ["node", "apps/rtm-relay/dist/server.js"]
