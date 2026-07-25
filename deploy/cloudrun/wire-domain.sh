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

# Cloud Run returns the rrdata (and a relative name we ignore) — the record is
# always for the mapped DOMAIN itself. Emit type<TAB>rrdata.
python3 <<'PY' > /tmp/dm-records.tsv
import json
data = json.load(open("/tmp/dm.json"))
for r in data.get("status", {}).get("resourceRecords") or []:
    print(f"{r['type']}\t{r['rrdata']}")
PY
cat /tmp/dm-records.tsv

echo "==> upserting DNS records for ${DOMAIN}. into zone $ZONE"
# One record set per type (rrdatas comma-joined). No bash-4 associative arrays,
# so this runs on macOS's stock bash 3.2 too.
fqdn="${DOMAIN}."
cut -f1 /tmp/dm-records.tsv | sort -u | while IFS= read -r type; do
  [ -z "$type" ] && continue
  values="$(awk -F'\t' -v t="$type" '$1==t {print $2}' /tmp/dm-records.tsv | paste -sd, -)"
  if gcloud dns record-sets describe "$fqdn" --type="$type" --zone="$ZONE" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud dns record-sets update "$fqdn" --type="$type" --ttl=300 --rrdatas="$values" \
      --zone="$ZONE" --project="$PROJECT" >/dev/null
    echo "    $fqdn $type — updated ($values)"
  else
    gcloud dns record-sets create "$fqdn" --type="$type" --ttl=300 --rrdatas="$values" \
      --zone="$ZONE" --project="$PROJECT" >/dev/null
    echo "    $fqdn $type — created ($values)"
  fi
done

echo
echo "==> mapping status (cert provisioning is async, 15-60 min)"
gcloud beta run domain-mappings describe \
  --domain "$DOMAIN" --project "$PROJECT" --region "$REGION" \
  --format='table(status.conditions[].type, status.conditions[].status, status.conditions[].reason)'
echo
echo "Re-run this script anytime to re-check. https://$DOMAIN goes live once the cert is ACTIVE."
