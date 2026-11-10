#!/usr/bin/env bash
# =========================================================================
# Self-Signed TLS Certificate Generator for Aarogya-Drishti Simulation Demo
# Generates ECDSA / RSA 4096-bit self-signed certificate for local HTTPS testing
# =========================================================================

set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "${CERT_DIR}"

echo "Generating local TLS certificates for Aarogya-Drishti..."

openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
  -keyout "${CERT_DIR}/privkey.pem" \
  -out "${CERT_DIR}/fullchain.pem" \
  -subj "/C=IN/ST=Andhra Pradesh/L=Paderu/O=ITDA Paderu Tribal Health/OU=Aarohan Hackathon Simulation/CN=localhost" \
  -addext "subjectAltName = DNS:localhost,IP:127.0.0.1,IP:10.0.2.2"

chmod 600 "${CERT_DIR}/privkey.pem"
chmod 644 "${CERT_DIR}/fullchain.pem"

echo "TLS certificates successfully generated:"
echo "  - Certificate: ${CERT_DIR}/fullchain.pem"
echo "  - Private Key: ${CERT_DIR}/privkey.pem"
