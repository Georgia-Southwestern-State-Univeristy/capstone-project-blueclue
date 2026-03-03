# Stage 1 – Build the Vite app
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
# npm install is used instead of npm ci because package-lock.json is gitignored
RUN npm install

COPY . .

# VITE_API_URL must be passed as a build arg so Vite bakes it into the bundle
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2 – Serve with nginx
FROM nginx:stable-alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config: serve index.html for all routes (SPA routing)
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
