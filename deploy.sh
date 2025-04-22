#!/bin/bash

# Exit on any error
set -e

echo "Starting deployment to Google Cloud Run..."

# Build the container
echo "Building container image..."
gcloud builds submit --tag europe-west2-docker.pkg.dev/rosy-etching-456415/lucid-api-server/lucid-api-server:latest

# Deploy the new revision
echo "Deploying new revision to Cloud Run..."
gcloud run deploy lucid-api-server \
  --image europe-west2-docker.pkg.dev/rosy-etching-456415/lucid-api-server/lucid-api-server:latest \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated

echo "Deployment complete!" 