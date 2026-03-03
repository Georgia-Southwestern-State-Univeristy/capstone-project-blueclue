FROM node:20-slim

LABEL maintainer="BlueClue Team"
LABEL description="BlueClue Backend API"

ENV NODE_ENV=production

WORKDIR /app

# Install dependencies first (cached layer)
# npm install is used instead of npm ci because package-lock.json is gitignored
COPY package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/app.js"]
