FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY shared ./shared
COPY services/developer-portal ./services/developer-portal
EXPOSE 3005
CMD ["node", "--loader", "ts-node/esm", "services/developer-portal/src/index.ts"]
