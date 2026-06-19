#!/bin/bash
# GitHub Actions から GAS へ clasp push するスクリプト
#
# 必要な環境変数:
#   SCRIPT_IDS         project名 -> scriptId の JSON（例: {"line-attendance":"xxx",...}）
#   EVENT_NAME         github.event_name（pull_request / workflow_dispatch）
#   DISPATCH_PROJECTS  workflow_dispatch 時の対象（スペース区切り / all）
#   PR_NUMBER          pull_request 番号（変更ファイル取得に使用）
#   GH_TOKEN           gh API 認証用トークン（GITHUB_TOKEN）
#   DEPLOY             true の場合、push 後に本番 /exec デプロイも更新（PRマージ時）
#
# 対象決定ロジック:
#   - workflow_dispatch: 指定プロジェクト（all なら全部）
#   - pull_request: 直接変更されたプロジェクト ∪ 変更された共通ファイルを使うプロジェクト。
#       共通ファイル(common/notion-common)の使用先は copy-common.sh の設定から逆引きする。
#       scripts/ や .github/ などGASに無関係な変更は対象に含めない。
set -euo pipefail

ALL_PROJECTS=$(echo "$SCRIPT_IDS" | jq -r 'keys[]')

# common/notion-common の変更ファイルを使用するプロジェクトを
# scripts/copy-common.sh の設定から逆引きする。
#   $1: 共通ディレクトリ名（common / notion-common）
#   $2: ファイル名
common_users() {
  local dir="$1" file="$2"
  awk -v FS='"' -v d="$dir" -v f="$file" '
    # copy_files "project" "srcdir" "file1" "file2" ...
    $1 ~ /^copy_files / { if ($4 == d) { for (i = 6; i <= NF; i += 2) if ($i == f) { print $2; break } } }
    # copy_dir "project" "dir1" "dir2" ...（ディレクトリ全体を使用）
    $1 ~ /^copy_dir /  { for (i = 4; i <= NF; i += 2) if ($i == d) { print $2; break } }
  ' scripts/copy-common.sh
}

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

  # pull_request: 変更ファイルは GitHub API から取得（マージ後も確実・git objectに非依存）
  local changed
  changed=$(gh api "repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/files" --paginate --jq '.[].filename')

  # 対象 = 直接変更されたプロジェクト ∪ 変更された共通ファイルを使うプロジェクト
  # （scripts/ や .github/ などGASに無関係な変更は対象に含めない）
  {
    # 直接変更されたプロジェクトディレクトリ
    echo "$changed" | grep -E '^[^/]+/' | cut -d/ -f1
    # common/notion-common 変更 → copy-common.sh から使用プロジェクトを逆引き
    echo "$changed" | grep -E '^(common|notion-common)/' | while read -r cf; do
      common_users "$(dirname "$cf")" "$(basename "$cf")"
    done
  } | sort -u | sed '/^$/d' | while read -r d; do
    # scriptId 登録のあるプロジェクトのみ
    echo "$ALL_PROJECTS" | grep -qx "$d" && echo "$d"
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
