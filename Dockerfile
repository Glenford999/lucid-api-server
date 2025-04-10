FROM node:18-slim

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy the application code
COPY . .

# Create a default .env file if one doesn't exist
RUN touch .env

# Set environment variables with defaults
ENV NODE_ENV=production
ENV PORT=8080
ENV DEEPSEEK_API_ENDPOINT=https://api.deepseek.com
# API keys will be provided during deployment

# Expose the port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"] 
