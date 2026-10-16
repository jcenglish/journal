# syntax=docker/dockerfile:1
# Build context is the repo root: docker build -f deploy/web.Dockerfile .

FROM node:22-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:1.30.6-alpine
COPY --from=build /app/dist /usr/share/nginx/html
