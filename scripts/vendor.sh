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
BENCH="hf_20260803_181420_7d452e52-0693-46c8-a404-f9bab046a2d5.png"
VIDEO1="hf_20260803_173022_c28da1c8-06c3-4a57-892a-e511b65b50d7.mp4"
VIDEO2="hf_20260803_184958_304a9ce1-0d9a-4ec5-9ed0-1bef1e7829f4.mp4"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found."
  echo "  macOS:  brew install ffmpeg"
  echo "  Debian: sudo apt install ffmpeg"
  exit 1
fi

mkdir -p public/media

echo "==> Downloading source assets"
curl -fsSL "$CDN/$WIDE"   -o public/media/hero-wide.png
curl -fsSL "$CDN/$MACRO"  -o public/media/hero-macro.png
curl -fsSL "$CDN/$BENCH"  -o public/media/studio-bench.png
curl -fsSL "$CDN/$VIDEO1" -o public/media/push-in-source.mp4
curl -fsSL "$CDN/$VIDEO2" -o public/media/pull-back-source.mp4

# -g 1 / -keyint_min 1 / -sc_threshold 0 make every frame a keyframe, so any
# seek decodes exactly one frame. +faststart puts the moov atom up front so
# playback can begin before the whole file arrives. This inflates the files
# substantially -- that is the cost of smooth scrubbing, and why the clips
# are only five seconds each.
encode() {
  echo "==> Re-encoding $2 for scrubbing (all-intra)"
  ffmpeg -y -loglevel error -i "$1" \
    -c:v libx264 -preset slow -crf 18 \
    -g 1 -keyint_min 1 -sc_threshold 0 \
    -pix_fmt yuv420p -movflags +faststart \
    -an \
    "$2"
}

encode public/media/push-in-source.mp4   public/media/push-in.mp4
encode public/media/pull-back-source.mp4 public/media/pull-back.mp4

echo "==> Repointing index.html at local files"
# Perl rather than sed -i, which is not portable between macOS and GNU.
perl -pi -e "s{\Q$CDN/$WIDE\E}{./public/media/hero-wide.png}g"     index.html
perl -pi -e "s{\Q$CDN/$MACRO\E}{./public/media/hero-macro.png}g"   index.html
perl -pi -e "s{\Q$CDN/$BENCH\E}{./public/media/studio-bench.png}g" index.html
perl -pi -e "s{\Q$CDN/$VIDEO1\E}{./public/media/push-in.mp4}g"     index.html
perl -pi -e "s{\Q$CDN/$VIDEO2\E}{./public/media/pull-back.mp4}g"   index.html

rm -f public/media/push-in-source.mp4 public/media/pull-back-source.mp4

echo
echo "Done. Sizes:"
ls -lh public/media/ | awk 'NR>1 {printf "  %-22s %s\n", $9, $5}'
echo
echo "Next: serve and scroll it, then commit public/media/ and index.html."
echo "If the re-encoded file feels too large, the fallback is an image"
echo "sequence -- see README."
