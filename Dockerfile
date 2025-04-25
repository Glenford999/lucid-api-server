FROM node:18-slim

# Set default environment variables 
ENV NODE_ENV=production \
    PORT=8080 \
    GOOGLE_CLOUD_PROJECT=rosy-etching-456415-c7

# Create app directory
WORKDIR /usr/src/app

# Install necessary tools for health checks and debugging
RUN apt-get update && \
    apt-get install -y curl procps netcat-openbsd && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first (for better layer caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create an empty .env file if it doesn't exist (for safety)
RUN touch .env

# Show what files we have for debugging
RUN echo "Files in current directory:" && \
    ls -la && \
    echo "Files in src directory:" && \
    ls -la src/ || echo "No src directory found" && \
    echo "Node.js version:" && \
    node --version && \
    echo "NPM version:" && \
    npm --version

# Create a more comprehensive startup script
RUN echo '#!/bin/sh\n\
echo "====== LUCID API SERVER STARTUP ======"\n\
echo "Starting container in $(pwd) at $(date)"\n\
echo "Environment:"\n\
echo "- NODE_ENV: $NODE_ENV"\n\
echo "- PORT: $PORT"\n\
echo "- GOOGLE_CLOUD_PROJECT: $GOOGLE_CLOUD_PROJECT"\n\
echo "\nChecking directory structure:"\n\
ls -la\n\
\n\
echo "\nChecking for critical files:"\n\
if [ -f "server.js" ]; then\n\
  echo "✓ server.js exists"\n\
else\n\
  echo "✗ server.js NOT FOUND"\n\
fi\n\
\n\
if [ -f "app.js" ]; then\n\
  echo "✓ app.js exists"\n\
else\n\
  echo "✗ app.js NOT FOUND"\n\
fi\n\
\n\
if [ -d "src" ]; then\n\
  echo "✓ src directory exists"\n\
  echo "\nContents of src directory:"\n\
  ls -la src/\n\
else\n\
  echo "✗ src directory NOT FOUND"\n\
fi\n\
\n\
echo "\nStarting server..."\n\
node server.js\n\
' > /usr/src/app/start.sh && chmod +x /usr/src/app/start.sh

# Create a healthcheck script
RUN echo '#!/bin/sh\n\
curl -s http://localhost:$PORT/health\n\
' > /usr/src/app/healthcheck.sh && chmod +x /usr/src/app/healthcheck.sh

# Set permissions for node user
RUN mkdir -p /usr/src/app/logs && \
    chown -R node:node /usr/src/app

# Expose the port the app runs on
EXPOSE 8080

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD /usr/src/app/healthcheck.sh || exit 1

# Use non-root user for better security
USER node

# Start the server using the startup script
CMD ["/usr/src/app/start.sh"]