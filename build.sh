#!/bin/bash
# Build script for LLM Studio Zotero Plugin

set -e

PLUGIN_NAME="llmstudio-zotero"
VERSION=$(grep '"version"' src/manifest.json | sed 's/.*: *"\([^"]*\)".*/\1/')
XPI_NAME="${PLUGIN_NAME}-${VERSION}.xpi"

echo "Building ${PLUGIN_NAME} v${VERSION}..."

# Clean previous build
rm -f *.xpi

# Create xpi from src directory
cd src
zip -r "../${XPI_NAME}" .
cd ..

echo "Built: ${XPI_NAME}"
echo ""
echo "To install for development:"
echo "1. Close Zotero"
echo "2. Create a file at: ~/Library/Application Support/Zotero/Profiles/PROFILE/extensions/llmstudio-zotero@aiops.dev"
echo "3. Put this path in the file: $(pwd)/src"
echo "4. Restart Zotero"
