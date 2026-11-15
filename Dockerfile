# Written with AI assistance (Claude). Owner: Nanda.
# EVA-Sim as a website: build with Vite, then serve the static files with nginx on port 80.
# Dokploy: Application → Build type "Dockerfile" → domain spaceapps26.nanda.biz, container port 80, HTTPS on.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts skips the postinstall Electron download: the website doesn't need the desktop app.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN chmod -R a+rX /usr/share/nginx/html
EXPOSE 80
