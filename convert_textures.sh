#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# AnimeVRM テクスチャ一括変換スクリプト (PNG -> AVIF)
#
# GEMINI.md ガイドライン準拠:
# - 通常画像: avifenc -s 6 -q 85 input.png output.avif
# - 透過画像: avifenc -s 6 -q 85 --qalpha 100 input.png output.avif
# ==============================================================================

# avifenc コマンドの確認
if ! command -v avifenc &> /dev/null; then
  echo "エラー: 'avifenc' がインストールされていないか、PATH に通っていません。" >&2
  echo "macOS (Homebrew) の場合は以下を実行してインストールしてください:" >&2
  echo "  brew install libavif" >&2
  exit 1
fi

# スクリプト自身のディレクトリ
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 対象ディレクトリの決定
TARGET_DIR="${1:-}"

if [ -z "$TARGET_DIR" ]; then
  if [ -d "$SCRIPT_DIR/public/textures" ]; then
    TARGET_DIR="$SCRIPT_DIR/public/textures"
  elif [ -d "$PWD/public/textures" ]; then
    TARGET_DIR="$PWD/public/textures"
  elif [ -d "$PWD/textures" ]; then
    TARGET_DIR="$PWD/textures"
  elif [ "$(basename "$PWD")" = "textures" ]; then
    TARGET_DIR="$PWD"
  else
    echo "エラー: textures ディレクトリが見つかりませんでした。" >&2
    echo "使用法: $0 [対象ディレクトリパス]" >&2
    echo "例: $0 public/textures" >&2
    exit 1
  fi
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "エラー: 指定されたディレクトリが存在しません: $TARGET_DIR" >&2
  exit 1
fi

echo "=================================================="
echo "  PNG -> AVIF 一括変換を開始します"
echo "  対象ディレクトリ: $TARGET_DIR"
echo "=================================================="

# 統計用変数
total=0
success=0
failed=0
total_orig_size=0
total_new_size=0

# 空白や特殊文字を含むファイル名にも安全に対応 (-print0)
while IFS= read -r -d '' png_file; do
  ((total++))
  
  dir_path="$(dirname "$png_file")"
  base_name="$(basename "$png_file")"
  stem_name="${base_name%.*}"
  avif_file="${dir_path}/${stem_name}.avif"

  echo "--------------------------------------------------"
  echo "[$total] 変換中: $base_name"

  # 透過（アルファチャンネル）判定
  # sips コマンドで hasAlpha の有無をチェック
  is_transparent=false
  if command -v sips &> /dev/null; then
    if sips -g hasAlpha "$png_file" 2>/dev/null | grep -q "hasAlpha: yes"; then
      is_transparent=true
    fi
  fi

  # avifenc コマンド引数構築 (GEMINI.md ガイドライン準拠)
  CMD=("avifenc" "-s" "6" "-q" "85")
  if [ "$is_transparent" = true ]; then
    CMD+=("--qalpha" "100")
    echo "  モード: 透過/アルファあり (--qalpha 100)"
  else
    echo "  モード: 通常/不透明 (-q 85)"
  fi
  CMD+=("$png_file" "$avif_file")

  if "${CMD[@]}" > /dev/null 2>&1; then
    ((success++))
    orig_size=$(stat -f%z "$png_file" 2>/dev/null || stat -c%s "$png_file" 2>/dev/null || echo 0)
    new_size=$(stat -f%z "$avif_file" 2>/dev/null || stat -c%s "$avif_file" 2>/dev/null || echo 0)
    total_orig_size=$((total_orig_size + orig_size))
    total_new_size=$((total_new_size + new_size))

    orig_kb=$((orig_size / 1024))
    new_kb=$((new_size / 1024))
    if [ "$orig_size" -gt 0 ]; then
      ratio=$(( (orig_size - new_size) * 100 / orig_size ))
      echo "  結果: 成功 (${orig_kb} KB -> ${new_kb} KB, 削減率: ${ratio}%)"
    else
      echo "  結果: 成功 (${new_kb} KB)"
    fi
  else
    ((failed++))
    echo "  結果: 失敗 (コマンド実行エラー)" >&2
  fi

done < <(find "$TARGET_DIR" -type f \( -iname "*.png" \) -print0)

echo "=================================================="
if [ "$total" -eq 0 ]; then
  echo "変換対象の PNG ファイルは見つかりませんでした。"
else
  echo "変換処理が完了しました！"
  echo "合計: $total 件 | 成功: $success 件 | 失敗: $failed 件"
  if [ "$total_orig_size" -gt 0 ]; then
    orig_mb=$(awk "BEGIN {printf \"%.2f\", $total_orig_size / 1048576}")
    new_mb=$(awk "BEGIN {printf \"%.2f\", $total_new_size / 1048576}")
    overall_ratio=$(( (total_orig_size - total_new_size) * 100 / total_orig_size ))
    echo "総ファイルサイズ: ${orig_mb} MB -> ${new_mb} MB (削減率: ${overall_ratio}%)"
  fi
fi
echo "=================================================="
