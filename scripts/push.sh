#!/bin/bash
# 指定したGASプロジェクトに clasp push する
#
# 使い方:
#   ./scripts/push.sh                      # 対話メニューで選択（番号スペース区切り / a=全部）
#   ./scripts/push.sh line-attendance      # 指定プロジェクトのみ push（複数指定可・名前は検証）
#   ./scripts/push.sh -c [プロジェクト...]  # 先に copy-common.sh を実行してから push
#
# 共通ファイル（common/ 等）を変更した場合は -c を付けるか、事前に copy-common.sh を実行すること。
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# -c 指定時は後で共通ファイルをコピー
run_copy=false
if [ "${1:-}" = "-c" ]; then
  run_copy=true
  shift
fi

# .clasp.json を持つプロジェクト一覧（昇順）
available=()
for dir in "$ROOT_DIR"/*/; do
  [ -f "${dir}.clasp.json" ] && available+=("$(basename "$dir")")
done
IFS=$'\n' available=($(printf '%s\n' "${available[@]}" | sort)); unset IFS

is_available() {
  local name="$1" p
  for p in "${available[@]}"; do
    [ "$p" = "$name" ] && return 0
  done
  return 1
}

targets=()
if [ "$#" -gt 0 ]; then
  # 引数指定：既知プロジェクト名か検証
  for name in "$@"; do
    if is_available "$name"; then
      targets+=("$name")
    else
      echo "エラー: 不明なプロジェクト '$name'" >&2
      echo "指定可能: ${available[*]}" >&2
      exit 1
    fi
  done
else
  # 対話選択
  echo "push対象を選択してください（番号をスペース区切り / a=全部 / Enter=全部）:"
  i=1
  for p in "${available[@]}"; do
    printf "  %d) %s\n" "$i" "$p"
    i=$((i + 1))
  done
  printf "> "
  read -r answer
  if [ -z "$answer" ] || [ "$answer" = "a" ] || [ "$answer" = "all" ]; then
    targets=("${available[@]}")
  else
    for num in $answer; do
      case "$num" in
        '' | *[!0-9]*)
          echo "エラー: 無効な入力 '$num'" >&2
          exit 1
          ;;
      esac
      idx=$((num - 1))
      if [ "$idx" -lt 0 ] || [ "$idx" -ge "${#available[@]}" ]; then
        echo "エラー: 範囲外の番号 '$num'" >&2
        exit 1
      fi
      targets+=("${available[$idx]}")
    done
  fi
fi

if [ "${#targets[@]}" -eq 0 ]; then
  echo "対象なし。終了します。"
  exit 0
fi

# -c 指定時は共通ファイルをコピー
if [ "$run_copy" = true ]; then
  bash "$SCRIPT_DIR/copy-common.sh"
  echo
fi

for project in "${targets[@]}"; do
  echo "==> push: $project"
  (cd "$ROOT_DIR/$project" && clasp push -f)
  echo
done

echo "Done."
