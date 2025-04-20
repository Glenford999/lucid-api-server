FROM node:18-slim

WORKDIR /usr/src/app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && apt-get clean

# Copy package files
COPY package*.json ./

# Install dependencies and dev dependencies (needed for TypeScript compilation)
RUN npm install

# Copy application code
COPY . .

# Build TypeScript code
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production

# Expose the port the app runs on
EXPOSE 8080

# Add a healthcheck instruction with more lenient settings for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:8080/health || exit 1

# Use non-root user for security
USER node

# Start both the health check server and the main app with PM2
CMD ["./node_modules/.bin/pm2-runtime", "ecosystem.config.js"]