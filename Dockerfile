# Use the official Node.js 18 image
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files first to leverage Docker caching
COPY package*.json ./

# Install dependencies with better error handling
RUN npm ci --production || (echo "npm ci failed, falling back to npm install" && npm install --only=production)

# Copy essential application code
COPY server.js app.js ./
COPY src/ ./src/
COPY config/ ./config/
COPY tests/ ./tests/

# Create necessary directories if they don't exist
RUN mkdir -p src/routes src/config src/utils

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production
# The GOOGLE_CLOUD_PROJECT should be set during deployment
# ENV GOOGLE_CLOUD_PROJECT=your-project-id

# Expose port
EXPOSE 8080

# Mount health check as a volume for faster response
VOLUME ["/usr/src/app/tests"]

# Start the server directly
# The health check is already built into the server.js file
CMD ["node", "server.js"]