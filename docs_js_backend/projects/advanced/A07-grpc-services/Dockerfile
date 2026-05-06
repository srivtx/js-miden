FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000 50051 50052

CMD ["node", "dist/gateway/index.js"]
