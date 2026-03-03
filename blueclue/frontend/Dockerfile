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

# Install envsubst (part of gettext)
RUN apk add --no-cache gettext

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template (BACKEND_URL is substituted at container startup)
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

EXPOSE 80

# Substitute BACKEND_URL at startup, then launch nginx
# Only ${BACKEND_URL} is replaced — nginx vars like $host, $uri are preserved
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
