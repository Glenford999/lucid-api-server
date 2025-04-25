#!/bin/bash
set -e

echo "=== Lucid API Test Build and Validation Script ==="
echo "Starting local build process..."

# Check if files exist
if [ ! -f "server.js" ]; then
  echo "Error: server.js is missing!"
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "Error: package.json is missing!"
  exit 1
fi

if [ ! -f "Dockerfile" ]; then
  echo "Error: Dockerfile is missing!"
  exit 1
fi

echo "All required files are present."

# Build the Docker image
echo "Building Docker image..."
docker build -t lucid-api-test:local .

# Test the image locally
echo "Testing the image locally..."
echo "Starting container in detached mode..."
CONTAINER_ID=$(docker run -d -p 8080:8080 lucid-api-test:local)

# Wait for container to start
echo "Waiting for container to initialize..."
sleep 5

# Test the endpoint
echo "Testing the API endpoint..."
RESPONSE=$(curl -s http://localhost:8080/health || echo "Failed to connect")

if [[ $RESPONSE == *"status"*"UP"* ]]; then
  echo "✅ Health check passed! Response: $RESPONSE"
else
  echo "❌ Health check failed! Response: $RESPONSE"
  echo "Container logs:"
  docker logs $CONTAINER_ID
  docker stop $CONTAINER_ID
  exit 1
fi

# Stop the container
echo "Stopping test container..."
docker stop $CONTAINER_ID

echo "=== Local Build and Test Completed Successfully ==="
echo "You can now deploy with confidence using:"
echo "  - ./deploy.sh for direct deployment"
echo "  - git push to trigger Cloud Build deployment" 