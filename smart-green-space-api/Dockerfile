FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./

# Dev image (includes devDependencies for nodemon/prisma)
FROM base AS dev
RUN npm ci
COPY . .
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/greenspace?schema=public
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production image (minimal)
FROM base AS prod
RUN npm ci --omit=dev
COPY . .
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/greenspace?schema=public
RUN npx prisma generate
EXPOSE 3000
CMD ["node", "server.js"]

