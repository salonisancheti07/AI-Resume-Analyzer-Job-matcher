FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
COPY client/postcss.config.js ./
COPY client/tailwind.config.js ./
COPY client/vite.config.js ./
COPY client/index.html ./
COPY client/public ./public
COPY client/src ./src
RUN npm ci
RUN npm run build

FROM node:20-alpine AS backend
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --production
COPY server/src ./src
COPY server/models ./models
COPY server/auth ./auth
COPY server/middleware ./middleware
COPY server/routes ./routes
COPY server/.env.example ./server.env.example
COPY --from=frontend-builder /app/client/dist ./client/dist
EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
