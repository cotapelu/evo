# Agent OS v1.0 - Docker Image
FROM node:18-alpine

# Install dependencies (sqlite3)
RUN apk add --no-cache sqlite python3 make g++

# Create app directory
WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Create data directory
RUN mkdir -p /data

# Expose ports
EXPOSE 3456 9229

# Environment
ENV NODE_ENV=production
ENV AGENT_DB_PATH=/data/agent.db
ENV AGENT_METRICS_PORT=3456

# Run agent
CMD ["node", "evo.ts"]
