FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node . .
ENV NODE_ENV=production PORT=8080
USER node
EXPOSE 8080
CMD ["node", "dev-server.js"]
