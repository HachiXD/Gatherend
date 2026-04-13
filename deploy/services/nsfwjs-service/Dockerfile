FROM node:22.22.2-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["npm", "start"]
