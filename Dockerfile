FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install necessary tools for health checks
RUN apt-get update && \
    apt-get install -y curl procps && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first (for better layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Show what files we have for debugging
RUN echo "Files in current directory:" && \
    ls -la && \
    echo "Node.js version:" && \
    node --version && \
    echo "NPM version:" && \
    npm --version

# Set permissions for node user
RUN mkdir -p /usr/src/app/logs && \
    chown -R node:node /usr/src/app

# Expose the port the app runs on
EXPOSE 8080

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:8080/health || exit 1

# Use non-root user for better security
USER node

# Set runtime environment variables
ENV NODE_ENV=production \
    PORT=8080

# Start the server
CMD ["node", "server.js"]