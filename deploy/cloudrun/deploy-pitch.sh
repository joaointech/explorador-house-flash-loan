#!/bin/bash
# Build + push + deploy the static pitch deck (nginx) to Cloud Run.
#
# Usage:  ./deploy/cloudrun/deploy-pitch.sh
#
# Public domain is wired separately:
#   ./deploy/cloudrun/wire-domain.sh pitch-ethglobal.explorador.pt ethglobal-pitch
set -euo pipefail

PROJECT="${PROJECT:-wobreeze-448419}"
REGION="${REGION:-europe-north1}"
SERVICE="ethglobal-pitch"
REPO="ethglobal-pitch"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

SHA="$(git rev-parse --short HEAD)"
IMAGE="${REGISTRY}/image:${SHA}"

echo "==> building + pushing $IMAGE (linux/amd64)"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet >/dev/null 2>&1
docker buildx build \
  --platform linux/amd64 \
  -f deploy/pitch.Dockerfile \
  -t "$IMAGE" \
  --push \
  .

echo "==> deploying to Cloud Run ($SERVICE)"
gcloud run deploy "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --image "$IMAGE" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 256Mi \
  --min-instances 0 \
  --max-instances 2 \
  --concurrency 200 \
  --timeout 30

URL="$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT" --region "$REGION" --format='value(status.url)')"
echo
echo "==> deployed: $URL"
echo "    smoke:   curl -sI $URL/"
