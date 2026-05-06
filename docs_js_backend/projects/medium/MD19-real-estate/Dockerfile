FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run db:generate

EXPOSE 3003

CMD ["npm", "run", "dev"]
