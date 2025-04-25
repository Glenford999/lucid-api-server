# Windows PowerShell deployment script using cloudbuild.yaml

# Set your Google Cloud project ID
$PROJECT_ID = "rosy-etching-456415-c7"

# Set the service name
$SERVICE_NAME = "lucid-api-server"

# Set the region
$REGION = "europe-west2"

Write-Host "Starting deployment to Google Cloud Run using Cloud Build..."
Write-Host "Project ID: $PROJECT_ID"
Write-Host "Service: $SERVICE_NAME"

# Verify gcloud is available
try {
    $gcloudVersion = gcloud --version | Select-Object -First 1
    Write-Host "Using $gcloudVersion"
} catch {
    Write-Host "Error: gcloud CLI not found or not in PATH" -ForegroundColor Red
    Write-Host "Please install Google Cloud SDK and try again: https://cloud.google.com/sdk/docs/install"
    exit 1
}

# Check authentication
Write-Host "Checking authentication..."
$account = gcloud auth list --filter=status:ACTIVE --format="value(account)"
if (-not $account) {
    Write-Host "Not authenticated. Please run 'gcloud auth login' first." -ForegroundColor Yellow
    gcloud auth login
}

Write-Host "Authenticated as: $account"

# Submit the build to Cloud Build using cloudbuild.yaml
Write-Host "Submitting build to Cloud Build with cloudbuild.yaml configuration..."
gcloud builds submit --config=cloudbuild.yaml --substitutions=_REGION=$REGION,_SERVICE_NAME=$SERVICE_NAME

# Check the deployed service
Write-Host "Build submitted. Checking for service URL..."
Start-Sleep -Seconds 5  # Give Cloud Build a moment to start

# Wait for the build to complete
Write-Host "You can check build progress in the Google Cloud Console"
Write-Host "When completed, the service will be available at:"
$serviceUrl = gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)" 2>$null
if ($serviceUrl) {
    Write-Host "  $serviceUrl" -ForegroundColor Green
    Write-Host "Health check endpoint: $serviceUrl/health"
} else {
    Write-Host "Service not yet deployed or an error occurred." -ForegroundColor Yellow
}

Write-Host "Deployment process initiated. You can check build status in Google Cloud Console." 