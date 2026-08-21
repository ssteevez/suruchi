#!/bin/bash
# Export the deployable project tree to the clean public-repo folder:
#   /Volumes/Steevez2025/SuruchiWebsite/gitUpload
#
# Excluded: internal workflow documentation (AGENTS, WORKLOG, CONSTITUTION,
# DECISIONS, STATE, CHANGELOG, references, specs/), local tool config, env
# files, build output, the unused 170MB master video, and this script itself.
#
# Run after each work session you want published:
#   bash scripts/export-to-gitupload.sh
# then commit + push inside gitUpload.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="/Volumes/Steevez2025/SuruchiWebsite/gitUpload"
mkdir -p "$DEST"

rsync -a --delete \
  --exclude='.git/' \
  --exclude='/.gitignore' \
  --exclude='/README.md' \
  --exclude='experiments/euphemisims/README.md' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.netlify/' \
  --exclude='.claude/' \
  --exclude='scratch/' \
  --exclude='raw-images/' \
  --exclude='.pydeps/' \
  --exclude='._*' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  --exclude='AGENTS.md' \
  --exclude='CHANGELOG.md' \
  --exclude='CONSTITUTION.md' \
  --exclude='DECISIONS.md' \
  --exclude='STATE.md' \
  --exclude='WORKLOG.md' \
  --exclude='references.md' \
  --exclude='specs/' \
  --exclude='public/video.mp4' \
  --exclude='suruchi-*backup*.json' \
  --exclude='suruchi-projects-*.json' \
  --exclude='scripts/export-to-gitupload.sh' \
  "$SRC/" "$DEST/"

echo "Export complete → $DEST"
echo "Next: cd $DEST && git status && git add -A && git commit && git push"
