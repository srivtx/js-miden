FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY shared ./shared
COPY services/usage ./services/usage
EXPOSE 3002
CMD ["node", "--loader", "ts-node/esm", "services/usage/src/index.ts"]
