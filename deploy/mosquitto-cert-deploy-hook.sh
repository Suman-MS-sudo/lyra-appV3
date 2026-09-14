#!/bin/bash
# Certbot deploy hook: copies the renewed lyra-app.co.in cert into a
# location the mosquitto system user can actually read.
# /etc/letsencrypt/live/ is 0700 root-only -- mosquitto can't read
# directly from there, so this copies (not symlinks -- a symlink would
# still point at a file mosquitto can't read) into /etc/mosquitto/certs/
# with permissions mosquitto can use, then reloads the broker.
#
# Install:
#   sudo cp deploy/mosquitto-cert-deploy-hook.sh /etc/letsencrypt/renewal-hooks/deploy/mosquitto.sh
#   sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/mosquitto.sh
# Then run it once by hand (deploy hooks only fire on future renewals,
# not retroactively) to populate /etc/mosquitto/certs/ immediately:
#   sudo /etc/letsencrypt/renewal-hooks/deploy/mosquitto.sh

set -euo pipefail

DOMAIN="lyra-app.co.in"
SRC="/etc/letsencrypt/live/$DOMAIN"
DEST="/etc/mosquitto/certs"

mkdir -p "$DEST"
cp "$SRC/fullchain.pem" "$DEST/fullchain.pem"
cp "$SRC/privkey.pem" "$DEST/privkey.pem"
cp "$SRC/chain.pem" "$DEST/chain.pem"

chown mosquitto:mosquitto "$DEST"/*.pem
chmod 640 "$DEST"/*.pem

systemctl reload mosquitto || systemctl restart mosquitto
