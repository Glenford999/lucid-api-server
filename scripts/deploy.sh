#!/bin/bash

# Lucid API Server Deployment Script
# This script builds and deploys the Lucid API server to Google Cloud Run

echo "==================================="
echo "   LUCID API SERVER DEPLOYMENT    "
echo "==================================="
echo "Starting deployment at $(date)"
echo

# Make sure gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
fi

# Confirm we're in the right project
echo "Current Google Cloud project:"
gcloud config get-value project

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Navigate to the root directory of the API server
cd "$(dirname "$0")/.."

# Build and deploy to Cloud Run
echo
echo "Building and deploying to Cloud Run..."
echo

# Get the project ID for proper configuration
PROJECT_ID=$(gcloud config get-value project)

gcloud run deploy lucid-api-server \
  --source . \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 5 \
  --min-instances 1 \
  --timeout 180s \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},NODE_ENV=production" \
  --set-secrets="DEEPSEEK_API_KEY=DEEPSEEK_API_KEY:latest,DEEPSEEK_API_ENDPOINT=DEEPSEEK_API_ENDPOINT:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,OPENAI_API_BASE_URL=OPENAI_API_BASE_URL:latest"

DEPLOY_STATUS=$?

if [ $DEPLOY_STATUS -eq 0 ]; then
  echo
  echo "Deployment successful!"
  echo "Your API server should now be accessible at the URL above."
  
  # Get the URL of the deployed service
  SERVICE_URL=$(gcloud run services describe lucid-api-server --platform managed --region europe-west2 --format="value(status.url)")
  
  echo
  echo "Testing health endpoints..."
  curl -s "${SERVICE_URL}/health" && echo
  
  echo
  echo "Service is available at: ${SERVICE_URL}"
else
  echo
  echo "Deployment encountered errors. Please check the logs above."
fi 