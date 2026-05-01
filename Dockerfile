FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN apk add --no-cache sqlite

EXPOSE 3001

CMD ["node", "dashboard/server.js"]