#!/bin/sh
# Cloud Run mounts this service's consolidated env secret (ethglobal-bridge-env)
# as a file at /secrets/.env. The Next.js standalone server.js only reads
# process.env, so load the file here before starting it. Values are exported
# literally (NOT shell-evaluated) so metacharacters in a secret don't break
# startup. NEXT_PUBLIC_* are baked at build time, not here.
set -e
if [ -f /secrets/.env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    key=${line%%=*}
    val=${line#*=}
    export "$key=$val"
  done < /secrets/.env
fi
exec "$@"
