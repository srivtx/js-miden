FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY shared ./shared
COPY services/gateway ./services/gateway
EXPOSE 3000
CMD ["node", "--loader", "ts-node/esm", "services/gateway/src/index.ts"]
