FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY shared ./shared
COPY services/analytics ./services/analytics
EXPOSE 3004
CMD ["node", "--loader", "ts-node/esm", "services/analytics/src/index.ts"]
