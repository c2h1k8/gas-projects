#!/bin/bash
# 共通ファイルを使用するプロジェクトにコピーする
#
# 新しいプロジェクトを追加したら copy_project_files 関数の呼び出しを追記する
#   書式: copy_project_files <プロジェクト名> <共通ディレクトリ1> [共通ディレクトリ2 ...]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

copy_project_files() {
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

# プロジェクトごとのコピー設定
copy_project_files "household-account" "common" "notion-common"

echo "Done."
