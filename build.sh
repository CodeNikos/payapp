#!/bin/bash
set -e

echo "=== Installing Node.js ==="
apt-get update && apt-get install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g npm@latest
apt-get clean && rm -rf /var/lib/apt/lists/*
node --version
npm --version

echo "=== Installing Python dependencies ==="
pip install -r backend/requirements.txt

echo "=== Building frontend ==="
cd frontend
npm ci
npm run build

echo "=== Build complete ==="
