FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY public ./public
# Dossier du certificat auto-signé (mode HTTPS=1), modifiable par l'utilisateur node.
RUN mkdir -p /app/certs && chown node:node /app/certs
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server/index.js"]
