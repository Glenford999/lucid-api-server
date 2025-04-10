FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm ci --only=production

# Bundle app source
COPY . .

# The app binds to port 8080
EXPOSE 8080

# Use an entrypoint script that can handle environment variables
CMD ["node", "server.js"]
