FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY shared ./shared
COPY services/billing ./services/billing
EXPOSE 3003
CMD ["node", "--loader", "ts-node/esm", "services/billing/src/index.ts"]
