#!/bin/bash
set -e

echo "Installing Node.js and npm..."

apt-get update && apt-get install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g npm@latest
apt-get clean && rm -rf /var/lib/apt/lists/*

echo "Node.js installation complete."
node --version
npm --version
