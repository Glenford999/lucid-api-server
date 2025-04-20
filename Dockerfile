FROM node:18-slim

WORKDIR /usr/src/app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && apt-get clean

# Copy package files
COPY package*.json ./

# Use npm install instead of npm ci for more reliability
RUN npm install --production

# Copy application code
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Add a healthcheck instruction with more lenient settings for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:8080/health || exit 1

# Use non-root user for security
USER node

# Start the application
CMD [ "node", "server.js" ]