#!/usr/bin/env python3
"""line-attendance のリッチメニュー画像(1200x810 x3)を生成する。

    python3 scripts/build-richmenu-images.py [出力先ディレクトリ]

出力先を省略すると assets/ へ書き出す。メニューの枠を変更したら
RichMenuSetup.js の areas と PAGES を合わせて更新すること。

配色・寸法は既存画像から実測した値を使用している（scripts/richmenu-metrics.md 参照）。
Chrome のヘッドレススクリーンショットで描画するため Google Chrome が必要。
"""
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'assets'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

TABS = ['勤怠登録', '稼働・提出', '状況確認']

# アイコン背景のグラデーション（上→下・垂直）
G = {
    'green':  ('#6BC894', '#32B36B'),
    'orange': ('#F9C07E', '#F8A84C'),
    'teal':   ('#66CBC7', '#2AB7B1'),
    'blue':   ('#7FA9EE', '#4E88E8'),
    'red':    ('#F297A2', '#EE6F7E'),
    'purple': ('#9797E7', '#6F6FDE'),
    'gray':   ('#B3B7BF', '#9AA0AB'),
}

# 旧アイコンに合わせた塗り（ソリッド）系のグリフ。viewBox 24。
# 中抜きは fill-rule="evenodd" の副パスで表現する（アイコン背景のグラデーションが透ける）。
RING = ('M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8z'
        'm0 3.1a6.3 6.3 0 1 1 0 12.6 6.3 6.3 0 0 1 0-12.6z')

def _cal(inner=''):
    """カレンダーの土台（上部は帯、下部は中抜き）＋中身"""
    return ('<rect x="6.5" y="2" width="3" height="4.6" rx="1.5"/>'
            '<rect x="14.5" y="2" width="3" height="4.6" rx="1.5"/>'
            '<path fill-rule="evenodd" d="M3.6 4.3h16.8a1.6 1.6 0 0 1 1.6 1.6v14.5a1.6 1.6 0 0 1-1.6 1.6'
            'H3.6A1.6 1.6 0 0 1 2 20.4V5.9a1.6 1.6 0 0 1 1.6-1.6zm1.7 8.3v7v0h13.4v-7z"/>' + inner)

ICON = {
    'play': '<path d="M9.8 6.8a1 1 0 0 1 1.5-.87l7.3 4.25a1 1 0 0 1 0 1.74l-7.3 4.25a1 1 0 0 1-1.5-.87z"/>',
    'stop': '<rect x="7.9" y="7.9" width="8.2" height="8.2" rx="2.4"/>',
    'umbrella': ('<path d="M12 2.1c-5.6 0-10.1 4.4-10.1 9.8h20.2c0-5.4-4.5-9.8-10.1-9.8z"/>'
                 '<path d="M11.05 11.9h1.9v5.9a1.55 1.55 0 0 0 3.1 0v-.6h1.9v.6a3.45 3.45 0 0 1-6.9 0z"/>'),
    'calendar': _cal(),
    'calendar_x': _cal('<path d="M9.5 13.5l5 4.2M14.5 13.5l-5 4.2" stroke="#fff" stroke-width="2.9" stroke-linecap="round"/>'),
    'calendar_plus': _cal('<path d="M12 13.2v5M9.5 15.7h5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'),
    'calendar_check': _cal('<path d="M8.9 15.8l2.4 2.3 4.1-4.0" stroke="#fff" stroke-width="2.6" fill="none"'
                           ' stroke-linecap="round" stroke-linejoin="round"/>'),
    'calendar_week': _cal('<rect x="6.4" y="13.8" width="11.2" height="4.2" rx="1.5"/>'),
    'trash': ('<path d="M9.5 2h5a1.2 1.2 0 0 1 1.2 1.2v1.3H8.3V3.2A1.2 1.2 0 0 1 9.5 2z"/>'
              '<rect x="2.9" y="5.1" width="18.2" height="3.7" rx="1.5"/>'
              '<path fill-rule="evenodd" d="M5.3 9.6h13.4l-1 11.2A1.4 1.4 0 0 1 16.3 22H7.7a1.4 1.4 0 0 1-1.4-1.2z'
              'm2.9 2.4v7.8h1.3v-7.8zm3.1 0v7.8h1.3v-7.8zm3.1 0v7.8h1.3v-7.8z"/>'),
    'clock': (f'<path fill-rule="evenodd" d="{RING}"/>'
              '<path d="M10.9 6.9h2.2v5.5l3.5 2-1.1 1.9-4.6-2.7z"/>'),
    'bars': ('<rect x="4.2" y="12.8" width="4" height="7.2" rx="1.3"/>'
             '<rect x="10" y="7.6" width="4" height="12.4" rx="1.3"/>'
             '<rect x="15.8" y="4" width="4" height="16" rx="1.3"/>'),
    'alert': (f'<path fill-rule="evenodd" d="{RING}"/>'
              '<rect x="10.85" y="7.4" width="2.3" height="6.1" rx="1.15"/>'
              '<circle cx="12" cy="16.1" r="1.4"/>'),
    'send': '<path d="M21.8 12 2.9 4.2l3.5 7.8-3.5 7.8z"/>',
    'question': (f'<path fill-rule="evenodd" d="{RING}"/>'
                 '<path d="M9.4 9.7a2.7 2.7 0 1 1 3.4 3.1v1.4" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
                 '<circle cx="12.35" cy="17" r="1.4"/>'),
    'trend': ('<path d="M3.7 17.2 9.7 11.2l3.4 3.4L19.4 8.3" stroke="#fff" stroke-width="3.2" fill="none"'
              ' stroke-linecap="round" stroke-linejoin="round"/>'
              '<path d="M14.4 6.6h6.2v6.2z"/>'),
    'doc_check': ('<path fill-rule="evenodd" d="M5.4 2.4h8.2l5.4 5.4v13.8H5.4zm8.6 1.7v4.1h4.1z'
                  'm-4.7 9.6-1.6 1.7 3.9 3.8 5.6-6.1-1.7-1.6-3.9 4.3z"/>'),
    'open': ('<path d="M13.4 2.6h8v8h-3.1V7.9l-6.1 6.1-2.2-2.2 6.1-6.1h-2.7z"/>'
             '<path d="M3.4 6.4a1.5 1.5 0 0 1 1.5-1.5h5.4v3H6.4v9.6h9.6v-4h3v5.5a1.5 1.5 0 0 1-1.5 1.5H4.9'
             'a1.5 1.5 0 0 1-1.5-1.5z"/>'),
}

# 各ページ 6枠: (アイコン, 配色, タイトル, 説明) / None は空き枠
PAGES = {
    'a': [
        ('play', 'green', '勤務開始', '今すぐ'),
        ('stop', 'orange', '勤務終了', '今すぐ'),
        ('umbrella', 'teal', '休暇', '当日'),
        ('calendar', 'blue', '勤怠登録', '日付指定'),
        ('calendar_x', 'teal', '休暇登録', '日付指定'),
        ('trash', 'red', 'クリア', '日付指定'),
    ],
    'b': [
        ('calendar', 'blue', '今月勤怠', '一覧'),
        ('clock', 'purple', '先月勤怠', '一覧'),
        ('bars', 'blue', '月別推移', '過去12ヶ月'),
        ('alert', 'orange', '未登録', 'あとから入力'),
        ('send', 'purple', '提出', '勤務表'),
        ('question', 'gray', 'ヘルプ', '使い方'),
    ],
    'c': [
        ('calendar_week', 'teal', '今週の状況', '稼働・残業'),
        ('trend', 'purple', '着地見込み', '当月見込み'),
        ('doc_check', 'teal', '提出状況', '提出済/未提出'),
        ('open', 'blue', '勤務表を開く', 'シート'),
        ('calendar_plus', 'green', '翌月作成', '勤務表'),
        ('calendar_check', 'orange', '休暇予約', '未作成月の休み'),
    ],
}

CSS = """
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:810px;background:#F5F7FA;
     font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;
     -webkit-font-smoothing:antialiased;overflow:hidden}
.tabs{height:132px;background:#ECF2FC;display:flex;align-items:center}
.tab{flex:1;height:132px;display:flex;align-items:center;justify-content:center;
     font-size:36px;font-weight:600;color:#98A0AE;letter-spacing:.02em}
.tab .pill{width:364px;padding:20px 0;text-align:center;border-radius:26px}
.tab.on .pill{background:#4A86E8;color:#fff}
.grid{height:678px;display:grid;grid-template-columns:repeat(3,400px);grid-template-rows:339px 339px}
.cell{padding:24px}
.card{width:100%;height:100%;background:#fff;border-radius:31px;
      box-shadow:0 7px 34px rgba(38,50,73,.24);
      display:flex;flex-direction:column;align-items:center;padding-top:37px}
.ico{width:126px;height:126px;border-radius:44px;margin-bottom:49px;
     display:flex;align-items:center;justify-content:center}
.ico svg{width:64px;height:64px}
.t{font-size:41px;line-height:1;font-weight:400;color:#2D3442;letter-spacing:.01em}
.s{font-size:23px;line-height:1;font-weight:500;color:#9298A4;margin-top:12px}
"""


def build(page):
    tabs = ''.join(
        f'<div class="tab{" on" if i == "abc".index(page) else ""}"><div class="pill">{t}</div></div>'
        for i, t in enumerate(TABS))
    cells = []
    for item in PAGES[page]:
        if item is None:
            cells.append('<div class="cell"></div>')
            continue
        icon, grad, title, sub = item
        c1, c2 = G[grad]
        # 影はアイコン下端の色を落としたグロー
        cells.append(
            f'<div class="cell"><div class="card">'
            f'<div class="ico" style="background:linear-gradient(180deg,{c1},{c2});'
            f'box-shadow:0 11px 20px -3px {c2}80">'
            f'<svg viewBox="0 0 24 24" fill="#fff">{ICON[icon]}</svg></div>'
            f'<div class="t">{title}</div><div class="s">{sub}</div>'
            f'</div></div>')
    return (f'<!doctype html><html lang="ja"><head><meta charset="utf-8">'
            f'<style>{CSS}</style></head><body>'
            f'<div class="tabs">{tabs}</div><div class="grid">{"".join(cells)}</div>'
            f'</body></html>')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for page in 'abc':
            html = Path(tmp) / f'{page}.html'
            html.write_text(build(page), encoding='utf-8')
            png = OUT / f'line-attendance-richmenu-{page}.png'
            subprocess.run([CHROME, '--headless', '--disable-gpu', '--hide-scrollbars',
                            f'--screenshot={png}', '--window-size=1200,810', f'file://{html}'],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f'生成: {png}')


if __name__ == '__main__':
    main()
