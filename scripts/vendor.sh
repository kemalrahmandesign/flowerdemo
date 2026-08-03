#!/usr/bin/env bash
#
# Pull the generated assets off the Higgsfield CDN, re-encode the video for
# scroll-scrubbing, and repoint index.html at the local copies.
#
# Run this from the repo root:   ./scripts/vendor.sh
#
# Why it exists: the CDN URLs are generation artifacts, not hosting. They can
# rotate or expire, and the delivered MP4 uses a normal keyframe interval,
# which makes scrubbing chew through dozens of frames per seek. Both problems
# are fixed here.

set -euo pipefail

cd "$(dirname "$0")/.."

CDN="https://d8j0ntlcm91z4.cloudfront.net/user_3FE0Xjh16Sot9aoCPbOwO7vYemS"
WIDE="hf_20260803_164720_9974793f-90e0-4f7f-b4d6-b8003d42eeda.png"
MACRO="hf_20260803_164720_3105b6d4-d68a-4705-89f5-2b58186d4342.png"
VIDEO="hf_20260803_173022_c28da1c8-06c3-4a57-892a-e511b65b50d7.mp4"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found."
  echo "  macOS:  brew install ffmpeg"
  echo "  Debian: sudo apt install ffmpeg"
  exit 1
fi

mkdir -p public/media

echo "==> Downloading source assets"
curl -fsSL "$CDN/$WIDE"  -o public/media/hero-wide.png
curl -fsSL "$CDN/$MACRO" -o public/media/hero-macro.png
curl -fsSL "$CDN/$VIDEO" -o public/media/push-in-source.mp4

echo "==> Re-encoding for scrubbing (all-intra)"
# -g 1 / -keyint_min 1 / -sc_threshold 0 make every frame a keyframe, so any
# seek decodes exactly one frame. +faststart puts the moov atom up front so
# playback can begin before the whole file arrives. This inflates the file
# substantially -- that is the cost of smooth scrubbing, and why the clip is
# only five seconds long.
ffmpeg -y -loglevel error -i public/media/push-in-source.mp4 \
  -c:v libx264 -preset slow -crf 18 \
  -g 1 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -movflags +faststart \
  -an \
  public/media/push-in.mp4

echo "==> Repointing index.html at local files"
# Perl rather than sed -i, which is not portable between macOS and GNU.
perl -pi -e "s{\Q$CDN/$WIDE\E}{./public/media/hero-wide.png}g"  index.html
perl -pi -e "s{\Q$CDN/$MACRO\E}{./public/media/hero-macro.png}g" index.html
perl -pi -e "s{\Q$CDN/$VIDEO\E}{./public/media/push-in.mp4}g"    index.html

rm -f public/media/push-in-source.mp4

echo
echo "Done. Sizes:"
ls -lh public/media/ | awk 'NR>1 {printf "  %-22s %s\n", $9, $5}'
echo
echo "Next: serve and scroll it, then commit public/media/ and index.html."
echo "If the re-encoded file feels too large, the fallback is an image"
echo "sequence -- see README."
