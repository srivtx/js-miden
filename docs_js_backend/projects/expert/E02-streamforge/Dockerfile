FROM node:20-alpine

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY . .

EXPOSE 4000 4001 4002 4003 1935

CMD ["npm", "run", "dev:ingest"]
