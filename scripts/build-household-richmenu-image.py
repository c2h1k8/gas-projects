#!/usr/bin/env python3
"""household-account（家計簿の LINE）のリッチメニュー画像（2500x843）を生成する。

    python3 scripts/build-household-richmenu-image.py [出力先ディレクトリ]

出力先を省略すると assets/ へ書き出す（assets/line-richmenu.png）。
マスの増減は TILES を直す。リッチメニュー自体は LINE Official Account Manager で
設定しているので、画像を差し替えたら管理画面でテンプレート（小・横N分割）と各マスの
アクションも合わせること（API では作っていない）。

寸法・配色・書体は初代の画像（手作業で作成・2マス）からピクセルを実測した値。
このスクリプトで TILES を初代の2マスにすると、初代とほぼ同じ画像が出る。
見出しと説明文は Noto Sans JP（Google Fonts から読む＝生成時にネット接続が要る）。
初代と形を比べた一致度は、Hiragino・丸ゴシック系よりこれが高かった。
Chrome のヘッドレススクリーンショットで描画するため Google Chrome が必要。
"""
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'assets'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

W, H = 2500, 843          # LINE のリッチメニュー（小）
MARGIN = 50               # 外周の余白（背景が見える幅）
GAP = 39                  # マスとマスの間
TILE_RADIUS = 38
BG = '#FAFAFA'
CIRCLE = 260              # アイコンの丸の直径。中心はマス上端から 250px
TITLE_TOP = 443           # 見出しの字面の上端（マス上端から）
TITLE_SIZE = 100
TITLE_TRACK = 4.6        # 字間（px）
SUB_TOP = 573             # 説明文の字面の上端（マス上端から）
SUB_SIZE = 45
SUB_TRACK = 4.3          # 字間（px）
TITLE_COLOR = '#282828'
SUB_COLOR = '#787878'
TINT = 0.10               # マスの背景＝丸の色を白に 10% 溶かした色（初代の2色から逆算）

# アイコンの中身（白）。座標は丸の左上を原点とする 260px 四方。
GLYPH = {
    # 棒グラフ：幅49・間隔14・高さ 81/131/176・底 y=190・角丸 8（初代の実測）
    'bars': ('<rect x="44" y="110" width="49" height="81" rx="8"/>'
             '<rect x="106" y="60" width="49" height="131" rx="8"/>'
             '<rect x="168" y="15" width="49" height="176" rx="8"/>'),
    # ？：初代は字（字面 52x112・中心 x=132）。同じ書体で置く
    'question': ('<text x="131" y="177" text-anchor="middle" font-family="Noto Sans JP" '
                 'font-weight="500" font-size="144">?</text>'),
    # 家：アプリ（暮らしの台帳）の帯のアイコンと同じ形を丸の大きさに合わせたもの
    'house': ('<path transform="translate(38 34) scale(7.6)" d="M12 3.2 2.6 11a1.1 1.1 0 0 0 1.4 1.7'
              'l.9-.75V19.6A1.9 1.9 0 0 0 6.8 21.5h3.4v-5.6a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v5.6h3.4'
              'a1.9 1.9 0 0 0 1.9-1.9v-7.65l.9.75A1.1 1.1 0 0 0 21.4 11z"/>'),
}

# マス: (アイコン, 丸の色, 見出し, 説明)。左から並ぶ。
# 初代は [('bars', '#1DB446', '今月の合計', ...), ('question', '#4A90D9', '使い方', ...)] の2マス
TILES = [
    ('bars', '#1DB446', '今月の合計', 'タップで集計を表示'),
    ('house', '#F08C28', '暮らしの台帳', 'アプリを開く'),
    ('question', '#4A90D9', '使い方', 'コマンド一覧'),
]


def _tint(hex_color, a=TINT):
    """丸の色を白に a だけ溶かした色（マスの背景）"""
    c = [int(hex_color[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(255 - a * (255 - v)):02X}' for v in c)


CSS = f"""
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{W}px;height:{H}px;background:{BG};overflow:hidden;
     font-family:"Noto Sans JP",sans-serif;-webkit-font-smoothing:antialiased}}
.row{{position:absolute;left:{MARGIN}px;right:{MARGIN}px;top:{MARGIN}px;bottom:{MARGIN}px;
     display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:{GAP}px}}
.tile{{position:relative;border-radius:{TILE_RADIUS}px}}
.ico{{position:absolute;left:50%;top:{250 - CIRCLE // 2}px;width:{CIRCLE}px;height:{CIRCLE}px;
     margin-left:-{CIRCLE // 2}px;border-radius:50%}}
.ico svg{{display:block}}
/* 字面の上端を合わせるため line-height:1 の箱をフォントの上余白ぶん上げる。
   字間は最後の字の後ろにも付くので、同じだけ左に足して中心を保つ */
.t{{position:absolute;left:0;right:0;top:{TITLE_TOP - round(TITLE_SIZE * 0.07)}px;text-align:center;
   font-size:{TITLE_SIZE}px;line-height:1;font-weight:700;color:{TITLE_COLOR};
   letter-spacing:{TITLE_TRACK}px;padding-left:{TITLE_TRACK}px}}
.s{{position:absolute;left:0;right:0;top:{SUB_TOP - round(SUB_SIZE * 0.17)}px;text-align:center;
   font-size:{SUB_SIZE}px;line-height:1;font-weight:400;color:{SUB_COLOR};
   letter-spacing:{SUB_TRACK}px;padding-left:{SUB_TRACK}px}}
"""


def build(tiles=TILES):
    cells = ''.join(
        f'<div class="tile" style="background:{_tint(color)}">'
        f'<div class="ico" style="background:{color}">'
        f'<svg width="{CIRCLE}" height="{CIRCLE}" viewBox="0 0 {CIRCLE} {CIRCLE}" fill="#fff">{GLYPH[icon]}</svg></div>'
        f'<div class="t">{title}</div><div class="s">{sub}</div></div>'
        for icon, color, title, sub in tiles)
    return ('<!doctype html><html lang="ja"><head><meta charset="utf-8">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
            'family=Noto+Sans+JP:wght@400;500;600;700&display=block">'
            f'<style>{CSS}</style></head><body><div class="row">{cells}</div></body></html>')


def render(html_text, png):
    with tempfile.TemporaryDirectory() as tmp:
        html = Path(tmp) / 'menu.html'
        html.write_text(html_text, encoding='utf-8')
        # --virtual-time-budget: Web フォントを読み終えるまで撮影を待つ
        subprocess.run([CHROME, '--headless', '--disable-gpu', '--hide-scrollbars',
                        '--virtual-time-budget=10000', f'--screenshot={png}',
                        f'--window-size={W},{H}', f'file://{html}'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    png = OUT / 'line-richmenu.png'
    render(build(), png)
    print(f'生成: {png}')


if __name__ == '__main__':
    main()
