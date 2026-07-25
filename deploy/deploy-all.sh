#!/bin/bash
# Full deploy of BOTH projects to Cloud Run + domain wiring, in order.
#
#   app   -> ethglobal.explorador.pt        (Next.js, ethglobal-bridge)
#   pitch -> pitch-ethglobal.explorador.pt  (static deck, ethglobal-pitch)
#
# Usage:  ./deploy/deploy-all.sh
# Prereqs: gcloud auth login  +  docker running  +  .env.local populated.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/cloudrun" && pwd)"

"$HERE/setup.sh"
"$HERE/deploy-app.sh"
"$HERE/deploy-pitch.sh"
"$HERE/wire-domain.sh" ethglobal.explorador.pt        ethglobal-bridge
"$HERE/wire-domain.sh" pitch-ethglobal.explorador.pt  ethglobal-pitch

echo
echo "All done. Certificates provision asynchronously (15-60 min):"
echo "  https://ethglobal.explorador.pt"
echo "  https://pitch-ethglobal.explorador.pt"
