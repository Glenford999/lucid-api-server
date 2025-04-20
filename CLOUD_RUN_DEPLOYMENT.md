# Google Cloud Run Deployment Guide

This guide explains how to deploy the Lucid API Server to Google Cloud Run and set up Secret Manager for secure API key storage.

## Prerequisites

1. Google Cloud Platform account with billing enabled
2. gcloud CLI installed locally
3. Docker installed locally (for testing)
4. DeepSeek API key

## Setup Steps

### 1. Create a Google Cloud Project

If you don't already have a project:

```bash
gcloud projects create [PROJECT_ID] --name="Lucid API Server"
gcloud config set project [PROJECT_ID]
```

### 2. Enable Required APIs

```bash
gcloud services enable run.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com
```

### 3. Create a Service Account for Cloud Run

```bash
gcloud iam service-accounts create lucid-api-server \
    --display-name="Lucid API Server Service Account"
```

### 4. Store Secrets in Secret Manager

```bash
# Create and store the DeepSeek API key
echo -n "your_deepseek_api_key" | \
    gcloud secrets create DEEPSEEK_API_KEY \
    --replication-policy="automatic" \
    --data-file=-
```

### 5. Grant Secret Manager Access to Service Account

```bash
gcloud projects add-iam-policy-binding [PROJECT_ID] \
    --member="serviceAccount:lucid-api-server@[PROJECT_ID].iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 6. Deploy to Cloud Run

Either use Cloud Build by pushing to GitHub repository, or deploy manually:

```bash
# Build the container
docker build -t gcr.io/[PROJECT_ID]/lucid-api-server:latest .

# Push to Container Registry
docker push gcr.io/[PROJECT_ID]/lucid-api-server:latest

# Deploy to Cloud Run
gcloud run deploy lucid-api-server \
    --image gcr.io/[PROJECT_ID]/lucid-api-server:latest \
    --region europe-west2 \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production,GOOGLE_CLOUD_PROJECT=[PROJECT_ID] \
    --memory 512Mi \
    --service-account lucid-api-server@[PROJECT_ID].iam.gserviceaccount.com
```

## Verifying Deployment

1. Access the health check endpoint:
```
https://lucid-api-server-[hash].europe-west2.run.app/health
```

2. Test the API connection:
```
https://lucid-api-server-[hash].europe-west2.run.app/api/search/diagnostic
```

3. Make a test search query:
```bash
curl -X POST \
  https://lucid-api-server-[hash].europe-west2.run.app/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"best wireless headphones"}'
```

## Troubleshooting

### Secret Manager Issues

If the API returns mock data with "reason": "API_NOT_CONFIGURED", check:

1. Secret Manager access permissions
2. Secret name is correct (DEEPSEEK_API_KEY)
3. Service account has proper IAM roles
4. GOOGLE_CLOUD_PROJECT environment variable is set

### Health Check Failures

If the container fails health checks:

1. Check logs in Cloud Run console
2. Verify the /health endpoint responds correctly
3. Ensure your container has enough memory and CPU

### API Timeout Issues

If you see "reason": "API_TIMEOUT":

1. Check DeepSeek API endpoint accessibility
2. Increase the timeout settings in the deepseekController.js
3. Consider changing the region of your Cloud Run deployment 