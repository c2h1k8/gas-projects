#!/bin/bash
# 指定したGASプロジェクトに clasp push する
#
# 使い方:
#   ./scripts/push.sh                          # 全プロジェクトを push
#   ./scripts/push.sh line-attendance          # 指定プロジェクトのみ push（複数指定可）
#   ./scripts/push.sh -c line-attendance ...   # 先に copy-common.sh を実行してから push
#
# 共通ファイル（common/ 等）を変更した場合は -c を付けるか、事前に copy-common.sh を実行すること。
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# -c 指定時は先に共通ファイルをコピー
run_copy=false
if [ "${1:-}" = "-c" ]; then
  run_copy=true
  shift
fi
if [ "$run_copy" = true ]; then
  bash "$SCRIPT_DIR/copy-common.sh"
  echo
fi

# 対象プロジェクト決定（引数なしなら .clasp.json を持つ全ディレクトリ）
projects=("$@")
if [ "$#" -eq 0 ]; then
  for dir in "$ROOT_DIR"/*/; do
    if [ -f "${dir}.clasp.json" ]; then
      projects+=("$(basename "$dir")")
    fi
  done
fi

for project in "${projects[@]}"; do
  dest="$ROOT_DIR/$project"
  if [ ! -f "$dest/.clasp.json" ]; then
    echo "Skip $project（.clasp.json なし）"
    continue
  fi
  echo "==> push: $project"
  (cd "$dest" && clasp push -f)
  echo
done

echo "Done."
