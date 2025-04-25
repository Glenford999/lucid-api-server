#!/bin/bash

# Exit on any error
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-"your-gcp-project-id"}
REGION=${REGION:-"europe-west4"}
SERVICE_NAME=${SERVICE_NAME:-"lucid-api-test"}
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME:manual-$(date +%Y%m%d-%H%M%S)"

echo "=== Lucid API Manual Deployment Script ==="
echo "Starting deployment with configuration:"
echo "  • Project ID: $PROJECT_ID"
echo "  • Region: $REGION"
echo "  • Service: $SERVICE_NAME"
echo "  • Image: $IMAGE_NAME"

# Verify gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI not found. Please install it first."
    exit 1
fi

# Verify project and authentication
echo "Verifying GCP authentication..."
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "Current project is $CURRENT_PROJECT, switching to $PROJECT_ID..."
    gcloud config set project $PROJECT_ID
fi

# Build the Docker image locally
echo "Building Docker image..."
docker build -t $IMAGE_NAME .

# Push the image to Container Registry
echo "Pushing image to Google Container Registry..."
gcloud auth configure-docker --quiet
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE_NAME \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080

# Check deployment status
echo "Checking deployment status..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

echo "=== Deployment Completed Successfully ==="
echo "Service URL: $SERVICE_URL"
echo "To test the deployment, run: curl $SERVICE_URL/health" 