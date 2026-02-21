#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/run_auto_door.sh <video_path> [corp_ca_pem]
#
# Examples:
#   ./scripts/run_auto_door.sh ../demo-videos/test_room4.mp4
#   ./scripts/run_auto_door.sh ../demo-videos/test_room4.mp4 ~/certs/company-root-ca.pem

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <video_path> [corp_ca_pem]"
  exit 1
fi

VIDEO_PATH="$1"
CA_PEM="${2:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -d ".venv" ]]; then
  python3 -m venv .venv
fi

source .venv/bin/activate

python -m pip install -U pip setuptools wheel
python -m pip install -r cv/requirements.txt
python -m pip install "git+https://github.com/ultralytics/CLIP.git"

if [[ -n "$CA_PEM" ]]; then
  if [[ ! -f "$CA_PEM" ]]; then
    echo "CA file not found: $CA_PEM"
    exit 1
  fi
  export SSL_CERT_FILE="$CA_PEM"
  export REQUESTS_CA_BUNDLE="$CA_PEM"
  export CURL_CA_BUNDLE="$CA_PEM"
  export PIP_CERT="$CA_PEM"
  echo "Using custom CA bundle: $CA_PEM"
fi

read -r CLIP_URL CLIP_DEST < <(python - <<'PY'
import clip.clip as cc
import os
url = cc._MODELS["ViT-B/32"]
dest = os.path.join(os.path.expanduser("~/.cache/clip"), os.path.basename(url))
print(url, dest)
PY
)

mkdir -p "$(dirname "$CLIP_DEST")"
if [[ ! -f "$CLIP_DEST" ]]; then
  echo "Downloading CLIP weights to $CLIP_DEST"
  if [[ -n "$CA_PEM" ]]; then
    curl --fail --location --cacert "$CA_PEM" "$CLIP_URL" -o "$CLIP_DEST"
  else
    curl --fail --location "$CLIP_URL" -o "$CLIP_DEST"
  fi
else
  echo "CLIP weights already present at $CLIP_DEST"
fi

python people_counter.py --video "$VIDEO_PATH" --auto-detect-doors --show
