# Deploy

Both projects ship to **Google Cloud Run** (project `wobreeze-448419`, region
`europe-north1`), matching the `irrealista` conventions. DNS lives in the
`explorador.pt` Cloud DNS managed zone.

| What | Service | Domain |
|---|---|---|
| Next.js app (explorador Bridge) | `ethglobal-bridge` | `ethglobal.explorador.pt` |
| Static pitch deck | `ethglobal-pitch` | `pitch-ethglobal.explorador.pt` |

## Prerequisites

```bash
gcloud auth login                       # token was expired; refresh it
gcloud config set project wobreeze-448419
# Docker Desktop running (buildx is used to produce linux/amd64 images)
# .env.local populated at the repo root (server-side secrets)
```

## One shot

```bash
./deploy/deploy-all.sh
```

Runs setup, deploys both services, and wires both domains. Idempotent, so
re-run it any time to ship a new build.

## Step by step

```bash
./deploy/cloudrun/setup.sh                 # Artifact Registry + env secret (once)
./deploy/cloudrun/deploy-app.sh            # build+push+deploy the Next.js app
./deploy/cloudrun/deploy-pitch.sh          # build+push+deploy the pitch
./deploy/cloudrun/wire-domain.sh ethglobal.explorador.pt       ethglobal-bridge
./deploy/cloudrun/wire-domain.sh pitch-ethglobal.explorador.pt ethglobal-pitch
```

## Notes

- **Redeploy after code changes:** just re-run `deploy-app.sh` / `deploy-pitch.sh`.
  Images are tagged with the git short SHA.
- **Change a server secret:** edit `.env.local`, re-run `setup.sh` (adds a new
  secret version), then re-run `deploy-app.sh` to pick it up. `NEXT_PUBLIC_*`
  vars are baked at build time, so a change there needs a rebuild too.
- **Certificates:** Cloud Run provisions the TLS cert automatically once the DNS
  record resolves — typically 15–60 min. Re-run `wire-domain.sh` to re-check status.
- **Override project/region/zone:** every script honours `PROJECT`, `REGION`,
  and (for wiring) `ZONE` env vars.
