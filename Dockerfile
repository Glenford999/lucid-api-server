FROM node:18-slim

WORKDIR /usr/src/app

# Install curl and ps for healthcheck and PM2
RUN apt-get update && \
    apt-get install -y curl procps && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies and dev dependencies (needed for TypeScript compilation)
RUN npm install

# Copy application code
COPY . .

# Verify app.js exists in the correct location
RUN ls -la && \
    if [ ! -f app.js ]; then \
      echo "Warning: app.js not found in expected location" && \
      find . -name "app.js" -type f; \
    fi

# Build TypeScript code
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production

# Expose the port the app runs on
EXPOSE 8080

# Add a healthcheck directly in the container
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:8080/health || exit 1

# Use non-root user for security
USER node

# Directly start the main application without PM2
CMD ["node", "server.js"]