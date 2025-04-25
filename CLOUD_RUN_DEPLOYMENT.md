# Cloud Run Deployment Guide

This document explains how to deploy the Lucid API Server to Google Cloud Run.

## Prerequisites

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed
2. Docker installed locally
3. A Google Cloud project with billing enabled
4. Google Cloud API's enabled:
   - Cloud Run API
   - Cloud Build API
   - Secret Manager API (for API key storage)

## Preparing for Deployment

### 1. Set up Secret Manager

Store your DeepSeek API key in Secret Manager:

```bash
# Set your project ID
export PROJECT_ID=your-project-id

# Create a new secret for the DeepSeek API key
echo "your-deepseek-api-key" | gcloud secrets create deepseek-api-key \
  --replication-policy="automatic" \
  --data-file=- \
  --project=$PROJECT_ID
```

### 2. Grant access to Secret Manager

The Cloud Run service account needs access to read the secret:

```bash
# Get the Cloud Run service account email
export SERVICE_ACCOUNT=$(gcloud iam service-accounts list \
  --filter="displayName:Cloud Run Service Agent" \
  --format='value(email)')

# Grant Secret Manager Secret Accessor role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

## Manual Deployment

### 1. Build and push the Docker image

```bash
# Set project ID and service name
export PROJECT_ID=your-project-id
export SERVICE_NAME=lucid-api-server

# Navigate to the project directory
cd lucid-api-server

# Build the Docker image
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .

# Configure Docker to use gcloud credentials
gcloud auth configure-docker

# Push the image to Google Container Registry
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest
```

### 2. Deploy to Cloud Run

```bash
# Deploy the image to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --memory 512Mi \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
  --project=$PROJECT_ID
```

## Automated Deployment with GitHub Actions

We've set up a GitHub Actions workflow in `.github/workflows/deploy-cloud-run.yml` that will automatically:

1. Build the Docker image
2. Push it to Google Container Registry
3. Deploy to Cloud Run
4. Set up the necessary secrets in Secret Manager

### Setting up GitHub Secrets

You need to add these secrets to your GitHub repository:

- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `GCP_SA_KEY`: A JSON service account key with permissions to deploy to Cloud Run and manage secrets
- `DEEPSEEK_API_KEY`: Your DeepSeek API key

### Creating a Service Account for GitHub Actions

```bash
# Create a service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account" \
  --project=$PROJECT_ID

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download the key
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com \
  --project=$PROJECT_ID

# The key.json file content should be added as the GCP_SA_KEY secret in GitHub
```

## Troubleshooting Deployment Issues

### File Not Found Errors

If you see errors like "Cannot find module '/usr/src/app/app.js'", check:

1. That both `app.js` and `server.js` exist in your repository root
2. The Dockerfile is correctly setting the WORKDIR to `/usr/src/app`
3. Try building and running the Docker image locally to verify the paths:

```bash
docker build -t lucid-test .
docker run -p 8080:8080 lucid-test
```

### Secret Manager Issues

If the app is failing to access secrets:

1. Check the Cloud Run logs for any Secret Manager errors
2. Verify the `GOOGLE_CLOUD_PROJECT` environment variable is set correctly
3. Confirm the service account has the secretmanager.secretAccessor role

### Container Crashes

If the container keeps crashing:

1. Check the Cloud Run logs for any error messages
2. Try adding more memory or CPU to the Cloud Run service
3. Make sure all required environment variables are set

## Viewing Logs

To see logs from your deployed service:

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

## Testing the Deployed API

Test your deployment with a simple curl request:

```bash
# Get the Cloud Run URL
export SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region europe-west2 \
  --format='value(status.url)' \
  --project=$PROJECT_ID)

# Test the health endpoint
curl $SERVICE_URL/health

# Test the API endpoint
curl -X POST $SERVICE_URL/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"television"}'
``` 