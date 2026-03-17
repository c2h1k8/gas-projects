#!/bin/bash
# 共通ファイルを各プロジェクトにコピーする
# 新しいプロジェクトを追加したら PROJECTS に追記する

PROJECTS=(
  "notion-api"
)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
COMMON_DIR="$ROOT_DIR/common"

for project in "${PROJECTS[@]}"; do
  dest="$ROOT_DIR/$project"
  for file in "$COMMON_DIR"/*; do
    filename="$(basename "$file")"
    cp "$file" "$dest/$filename"
    echo "Copied $filename → $project/"
  done
done

echo "Done."
