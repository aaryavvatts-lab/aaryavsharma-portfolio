#!/usr/bin/env bash
# Grades the rendered frames and encodes the web sets for the home page film.
# Usage: bash post.sh land|port [first last]
# Output: ../../public/hero/v1/<set>/NNNN.avif (+ .webp fallback)
set -euo pipefail
cd "$(dirname "$0")"
JOB="$1"; FIRST="${2:-1}"; LAST="${3:-0}"
OUTDIR=../../public/hero/v1
# lifted blacks, warm highlights, a soft bloom around the lamp, and a gentle vignette
GRADE="split[a][b];[b]curves=all='0/0 0.62/0 1/1',gblur=sigma=22[g];[a][g]blend=all_mode=screen:all_opacity=0.20,curves=master='0/0.018 0.25/0.22 0.5/0.49 0.8/0.81 1/0.97',colorbalance=rs=0.015:gs=0.004:bs=-0.02:rh=0.025:bh=-0.02,vignette=angle=PI/5:mode=forward"

encode() {
  local f="$1" job="$2" out="$3"
  local n; n=$(basename "$f" .png); n=${n#f_}
  if [ "$job" = land ]; then
    for w in 1920 1280; do
      mkdir -p "$out/land-$w"
      ffmpeg -loglevel error -y -i "$f" -filter_complex "[0:v]$GRADE,scale=$w:-2:flags=lanczos,format=yuv420p10le[v]" -map "[v]" \
        -c:v libaom-av1 -still-picture 1 -crf $([ $w = 1920 ] && echo 26 || echo 28) -cpu-used 6 -row-mt 1 "$out/land-$w/$n.avif"
      ffmpeg -loglevel error -y -i "$f" -filter_complex "[0:v]$GRADE,scale=$w:-2:flags=lanczos,format=rgb24[v]" -map "[v]" \
        -c:v libwebp -quality 72 -compression_level 5 "$out/land-$w/$n.webp"
    done
  else
    mkdir -p "$out/port-1080"
    ffmpeg -loglevel error -y -i "$f" -filter_complex "[0:v]$GRADE,format=yuv420p10le[v]" -map "[v]" \
      -c:v libaom-av1 -still-picture 1 -crf 28 -cpu-used 6 -row-mt 1 "$out/port-1080/$n.avif"
    ffmpeg -loglevel error -y -i "$f" -filter_complex "[0:v]$GRADE,format=rgb24[v]" -map "[v]" \
      -c:v libwebp -quality 72 -compression_level 5 "$out/port-1080/$n.webp"
  fi
}
export -f encode; export GRADE

ls out/$JOB/f_*.png | awk -v a="$FIRST" -v b="$LAST" '{ n = substr($0, length($0)-7, 4) + 0; if (n >= a && (b == 0 || n <= b)) print }' \
  | xargs -P 6 -I{} bash -c 'encode "$@"' _ {} "$JOB" "$OUTDIR"
echo "encoded $JOB"
