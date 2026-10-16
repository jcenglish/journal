#!/usr/bin/env bash
# Run on the developer machine, never on the server.
# Usage: deploy/scripts/issue-cert.sh <hostname> <server-ip> [ca-dir]
set -euo pipefail

host="${1:?usage: issue-cert.sh <hostname> <server-ip> [ca-dir]}"
ip="${2:?usage: issue-cert.sh <hostname> <server-ip> [ca-dir]}"
ca_dir="${3:-$HOME/.journal-ca}"
out_dir="$(cd "$(dirname "$0")/.." && pwd)/certs"
days=365

umask 077
mkdir -p "$ca_dir"

if [ ! -f "$ca_dir/ca.key" ]; then
  openssl genrsa -out "$ca_dir/ca.key" 4096
  openssl req -x509 -new -key "$ca_dir/ca.key" -sha256 -days 3650 \
    -subj "/CN=Journal Private CA" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -out "$ca_dir/ca.pem"
  echo "Created CA in $ca_dir. Back up ca.key securely; install ca.pem on each device."
fi

if [ ! -f "$ca_dir/ca.pem" ]; then
  echo "Found $ca_dir/ca.key but no ca.pem. Restore ca.pem from backup, or delete the CA dir to start a new CA (devices must then trust the new root)." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

openssl ecparam -name prime256v1 -genkey -noout -out "$tmp/key.pem"
openssl req -new -key "$tmp/key.pem" -subj "/CN=$host" -out "$tmp/leaf.csr"
printf 'subjectAltName=DNS:%s,IP:%s\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\n' "$host" "$ip" > "$tmp/ext.cnf"
openssl x509 -req -in "$tmp/leaf.csr" -CA "$ca_dir/ca.pem" -CAkey "$ca_dir/ca.key" \
  -CAcreateserial -CAserial "$tmp/ca.srl" -days "$days" -sha256 -extfile "$tmp/ext.cnf" \
  -out "$out_dir/fullchain.pem"
install -m 600 "$tmp/key.pem" "$out_dir/key.pem"

echo "Wrote $out_dir/fullchain.pem and key.pem (valid $days days). Copy only these two to the server."
