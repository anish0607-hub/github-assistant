FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 4000

# Apply migrations (or push schema on first boot) then start the server
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss; node dist/index.js"]
