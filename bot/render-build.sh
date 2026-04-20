#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Installing node modules..."
npm install

echo "Installing Playwright browsers and Linux OS dependencies..."
npx playwright install chromium
npx playwright install-deps

echo "Building TypeScript..."
npm run build

echo "Build complete."
