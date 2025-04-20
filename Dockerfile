# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm

COPY . .
RUN pnpm build:fly

CMD ["pnpm", "start"]