#!/bin/bash

# Exit on any error
set -e

# Set your Google Cloud project ID
PROJECT_ID="rosy-etching-456415-c7" # Updated with correct project ID

# Set the service name
SERVICE_NAME="lucid-api-server"

# Set the region
REGION="europe-west2"

echo "Starting deployment to Google Cloud Run..."
echo "Project ID: $PROJECT_ID"
echo "Service: $SERVICE_NAME"

# Build the container
echo "Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# Deploy the new revision with all the necessary settings
echo "Deploying new revision to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 300s \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,NODE_ENV=production" \
  --set-secrets="DEEPSEEK_API_KEY=DEEPSEEK_API_KEY:latest,DEEPSEEK_API_ENDPOINT=DEEPSEEK_API_ENDPOINT:latest" \
  --service-account="$SERVICE_NAME-sa@$PROJECT_ID.iam.gserviceaccount.com"

# Check that the service is deployed
echo "Checking deployment status..."
gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"

echo "Testing health endpoint..."
HEALTH_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")/health
echo "Health endpoint: $HEALTH_URL"
curl -s $HEALTH_URL || echo "Health check failed"

echo "Deployment complete!" 