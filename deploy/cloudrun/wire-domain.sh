#!/bin/bash
# Wire a subdomain to a Cloud Run service, publishing the DNS in Cloud DNS.
# Re-runnable: every step is idempotent.
#
# Usage:
#   ./deploy/cloudrun/wire-domain.sh ethglobal.explorador.pt       ethglobal-bridge
#   ./deploy/cloudrun/wire-domain.sh pitch-ethglobal.explorador.pt ethglobal-pitch
#
# The base domain (explorador.pt) must already be verified for this project
# (it is — the irrealista frontend maps explorador.pt in the same project) and
# hosted in a Cloud DNS managed zone, which this script auto-detects.
set -euo pipefail

DOMAIN="${1:?usage: wire-domain.sh <subdomain> <cloud-run-service>}"
SERVICE="${2:?usage: wire-domain.sh <subdomain> <cloud-run-service>}"

PROJECT="${PROJECT:-wobreeze-448419}"
REGION="${REGION:-europe-north1}"

# Base domain = last two labels (explorador.pt). Find its managed zone.
BASE_DOMAIN="$(echo "$DOMAIN" | awk -F. '{print $(NF-1)"."$NF}')"
ZONE="${ZONE:-$(gcloud dns managed-zones list --project "$PROJECT" \
  --filter="dnsName=${BASE_DOMAIN}." --format='value(name)' | head -1)}"
if [ -z "$ZONE" ]; then
  echo "ERROR: no Cloud DNS managed zone found for ${BASE_DOMAIN}."
  echo "       Set ZONE=<zone-name> explicitly, or create the zone first."
  exit 1
fi
echo "==> domain=$DOMAIN service=$SERVICE zone=$ZONE"

echo "==> ensuring domain mapping $DOMAIN -> $SERVICE"
if gcloud beta run domain-mappings describe \
     --domain "$DOMAIN" --project "$PROJECT" --region "$REGION" >/dev/null 2>&1; then
  echo "    already exists"
else
  gcloud beta run domain-mappings create \
    --service "$SERVICE" --domain "$DOMAIN" \
    --project "$PROJECT" --region "$REGION" --force-override
  echo "    created"
fi

echo "==> reading records Cloud Run wants published"
gcloud beta run domain-mappings describe \
  --domain "$DOMAIN" --project "$PROJECT" --region "$REGION" \
  --format=json > /tmp/dm.json

python3 - "$DOMAIN" <<'PY' > /tmp/dm-records.tsv
import json, sys
domain = sys.argv[1]
data = json.load(open("/tmp/dm.json"))
for r in data.get("status", {}).get("resourceRecords") or []:
    name = r.get("name") or domain
    print(f"{name}\t{r['type']}\t{r['rrdata']}")
PY
cat /tmp/dm-records.tsv

echo "==> upserting DNS records into zone $ZONE"
declare -A GROUPED
while IFS=$'\t' read -r name type data; do
  key="${name}.|${type}"
  if [ -z "${GROUPED[$key]+x}" ]; then GROUPED[$key]="$data"; else GROUPED[$key]="${GROUPED[$key]}|$data"; fi
done < /tmp/dm-records.tsv

gcloud dns record-sets transaction abort --zone="$ZONE" --project="$PROJECT" >/dev/null 2>&1 || true
gcloud dns record-sets transaction start --zone="$ZONE" --project="$PROJECT" >/dev/null

CHANGED=0
for key in "${!GROUPED[@]}"; do
  name="${key%|*}"; type="${key#*|}"; values="${GROUPED[$key]}"
  current="$(gcloud dns record-sets list --zone="$ZONE" --project="$PROJECT" \
    --name="$name" --type="$type" --format='value(rrdatas)' 2>/dev/null || true)"
  wanted="$(echo "$values" | tr '|' '\n' | sort | paste -sd';' -)"
  current_sorted="$(echo "$current" | tr ',' '\n' | sort | paste -sd';' -)"
  if [ "$current_sorted" = "$wanted" ]; then echo "    $name $type — already correct"; continue; fi
  if [ -n "$current" ]; then
    # shellcheck disable=SC2086
    gcloud dns record-sets transaction remove --zone="$ZONE" --project="$PROJECT" \
      --name="$name" --type="$type" --ttl=300 $(echo "$current" | tr ',' ' ') >/dev/null
  fi
  # shellcheck disable=SC2086
  gcloud dns record-sets transaction add --zone="$ZONE" --project="$PROJECT" \
    --name="$name" --type="$type" --ttl=300 $(echo "$values" | tr '|' ' ') >/dev/null
  echo "    $name $type — queued ($values)"
  CHANGED=1
done

if [ "$CHANGED" = "1" ]; then
  gcloud dns record-sets transaction execute --zone="$ZONE" --project="$PROJECT" >/dev/null
  echo "    transaction executed"
else
  gcloud dns record-sets transaction abort --zone="$ZONE" --project="$PROJECT" >/dev/null
  echo "    nothing to change"
fi

echo
echo "==> mapping status (cert provisioning is async, 15-60 min)"
gcloud beta run domain-mappings describe \
  --domain "$DOMAIN" --project "$PROJECT" --region "$REGION" \
  --format='table(status.conditions[].type, status.conditions[].status, status.conditions[].reason)'
echo
echo "Re-run this script anytime to re-check. https://$DOMAIN goes live once the cert is ACTIVE."
