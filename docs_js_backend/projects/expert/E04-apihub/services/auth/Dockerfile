FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY shared ./shared
COPY services/auth ./services/auth
EXPOSE 3001
CMD ["node", "--loader", "ts-node/esm", "services/auth/src/index.ts"]
