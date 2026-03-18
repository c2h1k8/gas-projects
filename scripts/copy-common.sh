#!/bin/bash
# 共通ファイルを使用するプロジェクトにコピーする
#
# 全ファイルコピー: copy_dir  <プロジェクト名> <共通ディレクトリ1> [共通ディレクトリ2 ...]
# 個別ファイル指定: copy_files <プロジェクト名> <共通ディレクトリ> <ファイル1> [ファイル2 ...]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

copy_dir() {
  local project="$1"
  shift
  local dest="$ROOT_DIR/$project"

  for common_dir in "$@"; do
    local src="$ROOT_DIR/$common_dir"
    for file in "$src"/*; do
      local filename="$(basename "$file")"
      cp "$file" "$dest/$filename"
      echo "Copied $common_dir/$filename → $project/"
    done
  done
}

copy_files() {
  local project="$1"
  local src_dir="$2"
  shift 2
  local dest="$ROOT_DIR/$project"
  local src="$ROOT_DIR/$src_dir"

  for filename in "$@"; do
    cp "$src/$filename" "$dest/$filename"
    echo "Copied $src_dir/$filename → $project/"
  done
}

# プロジェクトごとのコピー設定
copy_files "household-account" "common"       "CoreUtils.js" "DateUtils.js" "GoogleApi.js" "Loading.html" "LoadingUi.js" "Props.js" "SpreadUtils.js"
copy_files "household-account" "notion-common" "NotionApi.js" "NotionPayload.js"
copy_files "notion-checked-time" "common"       "CoreUtils.js" "Props.js"
copy_files "notion-checked-time" "notion-common" "NotionApi.js" "NotionPayload.js"
copy_files "line-attendance"     "common"        "CoreUtils.js" "Props.js" "GoogleApi.js" "LockUtil.js" "DateUtils.js"
copy_files "gmail-auto-delete"  "common"        "CoreUtils.js" "Props.js" "SpreadUtils.js"

echo "Done."
