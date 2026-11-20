FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY public ./public
# Certificat auto-signé (mode HTTPS=1) et salons gardés pendant une mise à jour, modifiables par l'utilisateur node.
RUN mkdir -p /app/certs /app/data && chown node:node /app/certs /app/data
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server/index.js"]
