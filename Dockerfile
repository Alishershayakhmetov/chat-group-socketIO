# Use Node 20 instead of 22 (more stable with PNPM)
FROM node:20-alpine

# Install PNPM globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml .npmrc ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy Prisma schema
COPY prisma/schema.prisma ./prisma/

# Generate Prisma client
RUN pnpm prisma generate

# Copy all files
COPY . .

# Build project
RUN pnpm build

# Start application
CMD ["pnpm", "start"]