# Lucid API Server Deployment Script for Windows
# This script builds and deploys the Lucid API server to Google Cloud Run

Write-Host "===================================="
Write-Host "   LUCID API SERVER DEPLOYMENT     "
Write-Host "===================================="
Write-Host "Starting deployment at $(Get-Date)"
Write-Host ""

# Make sure gcloud is available
try {
    gcloud --version | Out-Null
} catch {
    Write-Host "Error: gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
}

# Confirm we're in the right project
Write-Host "Current Google Cloud project:"
$projectId = gcloud config get-value project
Write-Host "Project ID: $projectId"

$continue = Read-Host "Continue with deployment? (y/n)"
if ($continue -ne "y") {
    Write-Host "Deployment cancelled."
    exit 1
}

# Set the working directory to the root of the API server
Set-Location (Split-Path -Parent $PSScriptRoot)

# Build and deploy to Cloud Run
Write-Host ""
Write-Host "Building and deploying to Cloud Run..."
Write-Host ""

$deployCommand = gcloud run deploy lucid-api-server `
  --source . `
  --platform managed `
  --region europe-west2 `
  --allow-unauthenticated `
  --memory 512Mi `
  --cpu 1 `
  --max-instances 5 `
  --min-instances 1 `
  --timeout 180s `
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$projectId,NODE_ENV=production" `
  --set-secrets="DEEPSEEK_API_KEY=DEEPSEEK_API_KEY:latest,DEEPSEEK_API_ENDPOINT=DEEPSEEK_API_ENDPOINT:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,OPENAI_API_BASE_URL=OPENAI_API_BASE_URL:latest"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deployment successful!"
    Write-Host "Your API server should now be accessible at the URL above."
    
    # Get the URL of the deployed service
    $serviceUrl = $(gcloud run services describe lucid-api-server --platform managed --region europe-west2 --format="value(status.url)")
    
    Write-Host ""
    Write-Host "Testing health endpoints..."
    Invoke-RestMethod -Uri "$serviceUrl/health" | ConvertTo-Json
    
    Write-Host ""
    Write-Host "Service is available at: $serviceUrl"
} else {
    Write-Host ""
    Write-Host "Deployment encountered errors. Please check the logs above."
} 