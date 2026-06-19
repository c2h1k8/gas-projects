#!/bin/bash
# GASプロジェクトを選択して push + deploy する
#
# 使い方:
#   scripts/deploy.sh            … 一覧から選択
#   scripts/deploy.sh <project>  … プロジェクト名を直接指定
#
# push 後、@HEAD 以外のバージョン付きデプロイ(=本番 /exec)を上書き更新する。
# URLは変わらないため LINE Webhook 等の再設定は不要。
# バージョン付きデプロイが無いプロジェクト(trigger型)は push のみ。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# .clasp.json を持つディレクトリを対象プロジェクトとして列挙
projects=()
for dir in "$ROOT_DIR"/*/; do
  [ -f "$dir/.clasp.json" ] && projects+=("$(basename "$dir")")
done
if [ ${#projects[@]} -eq 0 ]; then
  echo "デプロイ対象のプロジェクトが見つかりません" >&2
  exit 1
fi

# 引数指定があればそれを、無ければ選択メニューを表示
if [ $# -ge 1 ]; then
  PROJECT="$1"
  if [[ ! " ${projects[*]} " == *" $PROJECT "* ]]; then
    echo "不明なプロジェクト: $PROJECT" >&2
    echo "対象: ${projects[*]}" >&2
    exit 1
  fi
else
  echo "デプロイするプロジェクトを選択してください:"
  select choice in "${projects[@]}"; do
    if [ -n "${choice:-}" ]; then
      PROJECT="$choice"
      break
    fi
    echo "番号で選択してください"
  done
fi

cd "$ROOT_DIR/$PROJECT"
echo "==> push: $PROJECT"
clasp push -f

# @HEAD 以外のデプロイID(=本番)を抽出
DEPLOY_ID="$(clasp deployments | awk '/^- /{ if ($0 !~ /@HEAD/) print $2 }' | head -1)"
if [ -z "$DEPLOY_ID" ]; then
  echo "==> バージョン付きデプロイなし。push のみで完了（trigger型）"
  exit 0
fi

echo "==> deploy: $DEPLOY_ID"
clasp deploy --deploymentId "$DEPLOY_ID" -d "deploy $(date '+%Y-%m-%d %H:%M')"
echo "==> 完了: $PROJECT ($DEPLOY_ID)"
