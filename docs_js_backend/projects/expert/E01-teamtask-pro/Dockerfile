FROM node:20-alpine

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY . .

EXPOSE 3000 3001 3002 3003 3004

CMD ["npm", "run", "dev:gateway"]
