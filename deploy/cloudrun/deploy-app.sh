#!/bin/bash
# Build + push + deploy the Next.js app (explorador Bridge) to Cloud Run.
#
# Usage:  ./deploy/cloudrun/deploy-app.sh
#
# Public domain is wired separately:
#   ./deploy/cloudrun/wire-domain.sh ethglobal.explorador.pt ethglobal-bridge
set -euo pipefail

PROJECT="${PROJECT:-wobreeze-448419}"
REGION="${REGION:-europe-north1}"
SERVICE="ethglobal-bridge"
REPO="ethglobal-bridge"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}"
ENV_SECRET="ethglobal-bridge-env"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.local}"
cd "$REPO_ROOT"

get_env() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true; }

# NEXT_PUBLIC_* must be baked into the client bundle at build time.
PRIVY_APP_ID="$(get_env NEXT_PUBLIC_PRIVY_APP_ID)"
WORLD_APP_ID="$(get_env NEXT_PUBLIC_WORLD_APP_ID)"
WORLD_ACTION="$(get_env NEXT_PUBLIC_WORLD_ACTION)"

SHA="$(git rev-parse --short HEAD)"
IMAGE="${REGISTRY}/image:${SHA}"

# Cloud Run runs linux/amd64 — force it so this works from Apple Silicon too.
echo "==> building + pushing $IMAGE (linux/amd64)"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet >/dev/null 2>&1
docker buildx build \
  --platform linux/amd64 \
  -f Dockerfile \
  --build-arg NEXT_PUBLIC_PRIVY_APP_ID="$PRIVY_APP_ID" \
  --build-arg NEXT_PUBLIC_WORLD_APP_ID="$WORLD_APP_ID" \
  --build-arg NEXT_PUBLIC_WORLD_ACTION="$WORLD_ACTION" \
  -t "$IMAGE" \
  --push \
  .

# Runtime service account (falls back to the default compute SA).
SA="$(gcloud iam service-accounts list --project "$PROJECT" \
  --filter="email~^prod-apps-sa@" --format='value(email)' 2>/dev/null | head -1)"
SA_ARG=(); [ -n "$SA" ] && SA_ARG=(--service-account "$SA")

echo "==> deploying to Cloud Run ($SERVICE)"
gcloud run deploy "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --image "$IMAGE" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 80 \
  --timeout 60 \
  "${SA_ARG[@]}" \
  --set-secrets "/secrets/.env=${ENV_SECRET}:latest"

URL="$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT" --region "$REGION" --format='value(status.url)')"
echo
echo "==> deployed: $URL"
echo "    smoke:   curl -sI $URL/en"
