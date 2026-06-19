#!/bin/bash
# GitHub Actions から GAS へ clasp push するスクリプト
#
# 必要な環境変数:
#   SCRIPT_IDS         project名 -> scriptId の JSON（例: {"line-attendance":"xxx",...}）
#   EVENT_NAME         github.event_name（pull_request / workflow_dispatch）
#   DISPATCH_PROJECTS  workflow_dispatch 時の対象（スペース区切り / all）
#   BASE_SHA, HEAD_SHA pull_request の差分比較用 SHA
#   DEPLOY             true の場合、push 後に本番 /exec デプロイも更新（PRマージ時）
#
# 対象決定ロジック:
#   - workflow_dispatch: 指定プロジェクト（all なら全部）
#   - pull_request: 変更プロジェクトのみ。common/ notion-common/ scripts/ が変われば全部。
set -euo pipefail

ALL_PROJECTS=$(echo "$SCRIPT_IDS" | jq -r 'keys[]')

determine_targets() {
  if [ "${EVENT_NAME:-}" = "workflow_dispatch" ]; then
    if [ "${DISPATCH_PROJECTS:-}" = "all" ]; then
      echo "$ALL_PROJECTS"
    elif [ -n "${DISPATCH_PROJECTS:-}" ]; then
      echo "$DISPATCH_PROJECTS" | tr ' ' '\n' | sed '/^$/d'
    fi
    # 何も選択されていない場合は対象なし（出力なし）
    return
  fi

  # pull_request
  local changed
  changed=$(git diff --name-only "$BASE_SHA" "$HEAD_SHA")
  if echo "$changed" | grep -qE '^(common|notion-common|scripts)/'; then
    # 共通ファイル変更時は全プロジェクト
    echo "$ALL_PROJECTS"
    return
  fi
  # 変更されたプロジェクトディレクトリのうち scriptId 登録があるもの
  echo "$changed" | grep -E '^[^/]+/' | cut -d/ -f1 | sort -u | while read -r d; do
    if echo "$ALL_PROJECTS" | grep -qx "$d"; then
      echo "$d"
    fi
  done
}

targets=$(determine_targets | sort -u | sed '/^$/d')
if [ -z "$targets" ]; then
  echo "push対象なし。終了します。"
  exit 0
fi

echo "対象プロジェクト:"
echo "$targets" | sed 's/^/  - /'
echo

clasp_json() {
  # $1: scriptId
  cat <<EOF
{
  "scriptId": "$1",
  "rootDir": "",
  "scriptExtensions": [".js", ".gs"],
  "htmlExtensions": [".html"],
  "jsonExtensions": [".json"],
  "filePushOrder": [],
  "skipSubdirectories": false
}
EOF
}

failed=()
for project in $targets; do
  sid=$(echo "$SCRIPT_IDS" | jq -r --arg p "$project" '.[$p] // empty')
  if [ -z "$sid" ]; then
    echo "Skip $project（scriptId未登録）"
    continue
  fi
  if [ ! -d "$project" ]; then
    echo "Skip $project（ディレクトリなし）"
    continue
  fi
  clasp_json "$sid" > "$project/.clasp.json"
  echo "==> push: $project"
  if (cd "$project" && clasp push -f); then
    echo "    OK"
  else
    echo "    FAILED"
    failed+=("$project")
    echo
    continue
  fi

  # PRマージ時のみ: 本番 /exec デプロイ（@HEAD以外）を上書き更新
  if [ "${DEPLOY:-false}" = "true" ]; then
    did=$(cd "$project" && clasp deployments | awk '/^- /{ if ($0 !~ /@HEAD/) print $2 }' | head -1)
    if [ -z "$did" ]; then
      echo "    deploy: バージョン付きデプロイなし（trigger型）。pushのみ。"
    elif (cd "$project" && clasp deploy --deploymentId "$did" -d "merge deploy $(date '+%Y-%m-%d %H:%M')"); then
      echo "    deploy OK ($did)"
    else
      echo "    deploy FAILED"
      failed+=("$project(deploy)")
    fi
  fi
  echo
done

if [ "${#failed[@]}" -gt 0 ]; then
  echo "失敗したプロジェクト: ${failed[*]}"
  exit 1
fi
echo "Done."
