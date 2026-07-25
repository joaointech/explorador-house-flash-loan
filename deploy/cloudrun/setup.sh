#!/bin/bash
# One-time (idempotent) setup: Artifact Registry repos + the app env secret.
#
# Usage:  ./deploy/cloudrun/setup.sh
#
# Prereqs:
#   - gcloud authenticated (gcloud auth login) with access to the project
#   - .env.local populated at the repo root (server-side secrets live here)
set -euo pipefail

PROJECT="${PROJECT:-wobreeze-448419}"
REGION="${REGION:-europe-north1}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.local}"
ENV_SECRET="ethglobal-bridge-env"

echo "==> project=$PROJECT region=$REGION"

echo "==> enabling required APIs (no-op if already on)"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com dns.googleapis.com \
  --project "$PROJECT" >/dev/null

echo "==> creating Artifact Registry repositories"
for repo in ethglobal-bridge ethglobal-pitch; do
  if gcloud artifacts repositories describe "$repo" \
       --project "$PROJECT" --location "$REGION" >/dev/null 2>&1; then
    echo "    $repo — already exists"
  else
    gcloud artifacts repositories create "$repo" \
      --project "$PROJECT" --location "$REGION" \
      --repository-format=docker --description="ETHGlobal $repo"
    echo "    $repo — created"
  fi
done

echo "==> uploading app env secret ($ENV_SECRET) from $ENV_FILE"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Populate it before running setup."
  exit 1
fi
if ! gcloud secrets describe "$ENV_SECRET" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud secrets create "$ENV_SECRET" --project "$PROJECT" --replication-policy=automatic
fi
gcloud secrets versions add "$ENV_SECRET" --project "$PROJECT" --data-file="$ENV_FILE" >/dev/null
echo "    $ENV_SECRET — new version added"

echo "==> granting the Cloud Run runtime SA access to the secret"
SA="$(gcloud iam service-accounts list --project "$PROJECT" \
  --filter="email~^prod-apps-sa@" --format='value(email)' 2>/dev/null | head -1)"
if [ -z "$SA" ]; then
  SA="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
  echo "    prod-apps-sa not found, defaulting to compute SA: $SA"
fi
gcloud secrets add-iam-policy-binding "$ENV_SECRET" --project "$PROJECT" \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
echo "    granted to $SA"

echo
echo "Done. Next:"
echo "  ./deploy/cloudrun/deploy-app.sh      # deploy the Next.js app"
echo "  ./deploy/cloudrun/deploy-pitch.sh    # deploy the static pitch"
echo "  ./deploy/cloudrun/wire-domain.sh ethglobal.explorador.pt ethglobal-bridge"
echo "  ./deploy/cloudrun/wire-domain.sh pitch-ethglobal.explorador.pt ethglobal-pitch"
