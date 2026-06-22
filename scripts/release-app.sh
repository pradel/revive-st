#!/usr/bin/env bash
set -e

PLATFORM="all"
AUTO_SUBMIT=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --platform|-p) PLATFORM="$2"; shift ;;
        --auto-submit|-a) AUTO_SUBMIT="--auto-submit" ;;
        -h|--help)
            echo "Usage: ./release-app.sh [options]"
            echo "Options:"
            echo "  -p, --platform <all|ios|android>  Specify platform to build (default: all)"
            echo "  -a, --auto-submit                 Automatically submit to app stores after build"
            echo "  -h, --help                        Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Validate platform
if [[ "$PLATFORM" != "all" && "$PLATFORM" != "ios" && "$PLATFORM" != "android" ]]; then
    echo "Error: Invalid platform. Must be 'all', 'ios', or 'android'."
    exit 1
fi

# Ensure we're in the project root
cd "$(dirname "$0")/.." || exit 1

echo "🔍 Checking for clean working tree..."
if [[ -n $(git status -s) ]]; then
  echo "❌ Error: Working tree is not clean. Please commit or stash changes first."
  exit 1
fi

echo "🔄 Checking out main and pulling latest changes..."
git checkout main
git pull origin main

# Extract current version using jq
cd apps/app || exit 1
APP_VERSION=$(jq -r '.version' package.json)
echo "📱 Current app version in package.json is $APP_VERSION"

echo "🔎 Checking EAS for existing builds of version $APP_VERSION..."
# Query EAS for recent finished builds
# We use jq to parse the JSON and check if any build matches the current version AND the requested platform

if [[ "$PLATFORM" == "all" ]]; then
  JQ_FILTER="map(select(.appVersion == \"$APP_VERSION\")) | length"
else
  JQ_FILTER="map(select(.appVersion == \"$APP_VERSION\" and (.platform | ascii_downcase) == \"$PLATFORM\")) | length"
fi

MATCH_COUNT=$(npx eas-cli build:list --status finished --limit 20 --json --non-interactive | jq "$JQ_FILTER" 2>/dev/null || echo "error")

if [[ "$MATCH_COUNT" == "error" ]]; then
  ALREADY_BUILT="error"
elif [[ "$MATCH_COUNT" -gt 0 ]]; then
  ALREADY_BUILT="yes"
else
  ALREADY_BUILT="no"
fi

if [[ "$ALREADY_BUILT" == "error" ]]; then
  echo "⚠️ Failed to parse EAS build list. Proceeding cautiously..."
elif [[ "$ALREADY_BUILT" == "yes" ]]; then
  echo "❌ Error: Version $APP_VERSION has already been built on Expo for the requested platform(s). Aborting."
  echo "If you want to build again, you need to bump the version first."
  exit 1
else
  echo "✅ Version $APP_VERSION has not been built yet."
fi

echo "🚀 Triggering new EAS build for platform: $PLATFORM..."
if [[ -n "$AUTO_SUBMIT" ]]; then
    echo "This build will automatically be submitted to the stores."
fi

npx eas-cli build --platform "$PLATFORM" $AUTO_SUBMIT

echo "🎉 Build process finished successfully!"
