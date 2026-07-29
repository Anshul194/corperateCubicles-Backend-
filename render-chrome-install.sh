#!/usr/bin/env bash
set -e

# Install Chromium (Debian/Ubuntu)
if ! command -v chromium-browser >/dev/null 2>&1; then
  echo "Installing Chromium browser..."
  apt-get update
  apt-get install -y chromium-browser
fi

# Set env variable for Puppeteer
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
echo "PUPPETEER_EXECUTABLE_PATH set to $PUPPETEER_EXECUTABLE_PATH"
