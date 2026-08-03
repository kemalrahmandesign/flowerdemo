#!/usr/bin/env bash
#
# Rebuild the scroll film from its source clips and vendor every asset local.
#
# Run from the repo root:   ./scripts/vendor.sh
#
# Why this exists. The generated clips are 1080p24 at ~31MB each with a normal
# keyframe interval. Scrubbing those directly is what made the first build
# crawl: every currentTime write sent the decoder back to the previous
# keyframe and re-decoded everything in between, over 62MB of video streamed
# from a CDN. This script fixes both halves of that problem -- it merges the
# clips into one timeline and re-encodes all-intra, ~7MB.

set -euo pipefail

cd "$(dirname "$0")/.."

CDN="https://d8j0ntlcm91z4.cloudfront.net/user_3FE0Xjh16Sot9aoCPbOwO7vYemS"
WIDE="hf_20260803_164720_9974793f-90e0-4f7f-b4d6-b8003d42eeda.png"
MACRO="hf_20260803_164720_3105b6d4-d68a-4705-89f5-2b58186d4342.png"
BENCH="hf_20260803_181420_7d452e52-0693-46c8-a404-f9bab046a2d5.png"
CLIP1="hf_20260803_173022_c28da1c8-06c3-4a57-892a-e511b65b50d7.mp4"
CLIP2="hf_20260803_184958_304a9ce1-0d9a-4ec5-9ed0-1bef1e7829f4.mp4"

FILM_CDN="https://d2ol7oe51mr4n9.cloudfront.net/user_3FE0Xjh16Sot9aoCPbOwO7vYemS/d1c66372-3efa-4ba3-9bc3-a213d514f952.mp4"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found."
  echo "  macOS:  brew install ffmpeg"
  echo "  Debian: sudo apt install ffmpeg"
  exit 1
fi

mkdir -p public/media

echo "==> Downloading stills"
curl -fsSL "$CDN/$WIDE"  -o public/media/hero-wide.png
curl -fsSL "$CDN/$BENCH" -o public/media/studio-bench.png
curl -fsSL "$CDN/$MACRO" -o public/media/hero-macro.png

echo "==> Downloading source clips (~31MB each)"
curl -fsSL "$CDN/$CLIP1" -o public/media/_clip1.mp4
curl -fsSL "$CDN/$CLIP2" -o public/media/_clip2.mp4

echo "==> Merging and encoding for scrubbing"
# concat  : one continuous timeline, so nothing switches source at runtime
# scale   : 1280 wide -- scrub smoothness matters more than pixel count on a
#           shot that is always in motion
# fps=20  : the temporal resolution scroll actually needs; roughly halves the
#           frames, and therefore the bytes, versus the 24fps source
# -g 1 …  : every frame a keyframe, so a seek decodes exactly ONE frame.
#           This is the setting that makes scrubbing feel attached to the
#           finger rather than lurching.
ffmpeg -y -loglevel error \
  -i public/media/_clip1.mp4 -i public/media/_clip2.mp4 \
  -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0[c];[c]scale=1280:-2,fps=20[v]" \
  -map "[v]" \
  -c:v libx264 -preset slow -crf 20 \
  -g 1 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -movflags +faststart -an \
  public/media/film.mp4

rm -f public/media/_clip1.mp4 public/media/_clip2.mp4

echo "==> Verifying keyframe density"
FRAMES=$(ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames -of csv=p=0 public/media/film.mp4)
KEYS=$(ffprobe -v error -select_streams v:0 -show_entries frame=key_frame -of csv=p=0 public/media/film.mp4 | grep -c '^1')
echo "    frames=$FRAMES keyframes=$KEYS"
if [ "$FRAMES" != "$KEYS" ]; then
  echo "    WARNING: not all-intra. Scrubbing will lurch."
fi

echo "==> Repointing index.html at local files"
# Perl rather than sed -i, which is not portable between macOS and GNU.
perl -pi -e "s{\Q$CDN/$WIDE\E}{./public/media/hero-wide.png}g"     index.html
perl -pi -e "s{\Q$CDN/$BENCH\E}{./public/media/studio-bench.png}g" index.html
perl -pi -e "s{\Q$FILM_CDN\E}{./public/media/film.mp4}g"           index.html

echo
echo "Done:"
ls -lh public/media/ | awk 'NR>1 {printf "  %-22s %s\n", $9, $5}'
echo
echo "Serve and scroll it, then commit public/media/ and index.html."
