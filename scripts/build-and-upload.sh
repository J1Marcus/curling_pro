#!/bin/bash

# Curling Pro+ - Build and Upload to App Store Connect
# Usage: ./scripts/build-and-upload.sh

set -e

echo "🥌 Curling Pro+ - App Store Build & Upload"
echo "=========================================="

# Navigate to project root
cd "$(dirname "$0")/.."

# Step 1: Build web assets
echo ""
echo "📦 Building web assets..."
npm run build

# Step 2: Sync to iOS
echo ""
echo "📱 Syncing to iOS..."
npx cap sync ios

# Step 3: Clean previous build
echo ""
echo "🧹 Cleaning previous build..."
rm -rf ios/App/build

# Step 4: Archive
echo ""
echo "🔨 Archiving for App Store..."
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination "generic/platform=iOS" -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Manual \
  PROVISIONING_PROFILE_SPECIFIER="Curling Pro Distribution" \
  CODE_SIGN_IDENTITY="Apple Distribution" \
  'CODE_SIGNING_REQUIRED[sdk=*]=NO' \
  'CODE_SIGNING_ALLOWED[sdk=*]=NO' \
  archive -archivePath ./build/App.xcarchive

# Step 5: Export and Upload
echo ""
echo "☁️ Uploading to App Store Connect..."
xcodebuild -exportArchive \
  -archivePath ./build/App.xcarchive \
  -exportPath ./build/export \
  -exportOptionsPlist ./ExportOptions.plist \
  -allowProvisioningUpdates

echo ""
echo "✅ Upload complete!"
echo ""
echo "Next steps:"
echo "1. Go to App Store Connect"
echo "2. Wait for build to process (5-30 min)"
echo "3. Complete export compliance"
echo "4. Create new version or select build"
echo "5. Submit for review"
