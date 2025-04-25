FROM node:18-slim

# Set default environment variables 
ENV NODE_ENV=production \
    PORT=8080 \
    GOOGLE_CLOUD_PROJECT=rosy-etching-456415-c7

# Create app directory
WORKDIR /usr/src/app

# Install necessary tools
RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create an empty .env file if needed
RUN touch .env

# Create a simple health check server
RUN echo 'const http = require("http");\n\
http.createServer((req, res) => {\n\
  if (req.url === "/health") {\n\
    res.writeHead(200, {"Content-Type": "application/json"});\n\
    res.end(JSON.stringify({status: "ok", timestamp: new Date().toISOString()}));\n\
  } else {\n\
    res.writeHead(404);\n\
    res.end();\n\
  }\n\
}).listen(8081, () => console.log("Health check server running on port 8081"));\n\
' > /usr/src/app/health-server.js

# Create startup script
RUN echo '#!/bin/sh\n\
echo "Starting health check server..."\n\
node health-server.js &\n\
echo "Starting main server..."\n\
node server.js\n\
' > /usr/src/app/start.sh && chmod +x /usr/src/app/start.sh

# Set permissions
RUN chmod -R 755 /usr/src/app

# Expose ports
EXPOSE 8080 8081

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:8080/health || curl -f http://localhost:8081/health || exit 1

# Use non-root user
USER node

# Start the server
CMD ["/usr/src/app/start.sh"]