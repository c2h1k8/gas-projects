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

CAL = ('<rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="#fff" stroke-width="2" fill="none"/>'
       '<path d="M3.5 9.6h17" stroke="#fff" stroke-width="2"/>'
       '<path d="M8 3v4M16 3v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>')

ICON = {
    'play':   '<path d="M8.5 5.5v13l11-6.5z" fill="#fff"/>',
    'stop':   '<rect x="8" y="8" width="8" height="8" rx="2.2" fill="#fff"/>',
    'umbrella': ('<path d="M12 3.2a8.4 8.4 0 0 1 8.4 8.4H3.6A8.4 8.4 0 0 1 12 3.2z" fill="#fff"/>'
                 '<path d="M12 11.6v6.2a2.4 2.4 0 0 0 4.8 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'),
    'calendar': CAL,
    'calendar_x': CAL + '<path d="M9.6 13.2l4.8 4.2M14.4 13.2l-4.8 4.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
    'calendar_plus': CAL + '<path d="M12 12.4v5.2M9.4 15h5.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
    'calendar_week': CAL + '<rect x="6.2" y="12.4" width="11.6" height="3.6" rx="1.3" fill="#fff"/>',
    'trash':  '<path d="M6 7h12M9.6 7V5.4h4.8V7M7.6 7l.85 12.6h7.1L16.4 7" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    'clock':  ('<circle cx="12" cy="12" r="8.6" stroke="#fff" stroke-width="2" fill="none"/>'
               '<path d="M12 6.9v5.4l3.5 2.1" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    'bars':   ('<rect x="4.4" y="13" width="3.6" height="7" rx="1.1" fill="#fff"/>'
               '<rect x="10.2" y="8" width="3.6" height="12" rx="1.1" fill="#fff"/>'
               '<rect x="16" y="4.4" width="3.6" height="15.6" rx="1.1" fill="#fff"/>'),
    'alert':  ('<circle cx="12" cy="12" r="8.7" stroke="#fff" stroke-width="2" fill="none"/>'
               '<path d="M12 7.3v5.5" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/>'
               '<circle cx="12" cy="16.5" r="1.35" fill="#fff"/>'),
    'send':   '<path d="M20.6 3.8 3.2 11.1l6.9 2.7 2.6 6.9z" fill="#fff"/>',
    'question': ('<circle cx="12" cy="12" r="8.7" stroke="#fff" stroke-width="2" fill="none"/>'
                 '<path d="M9.5 9.5a2.6 2.6 0 1 1 3.2 3v1.4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'
                 '<circle cx="12.35" cy="17" r="1.25" fill="#fff"/>'),
    'trend':  ('<path d="M4 16.6 9.6 11l3.4 3.4L20 7.4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
               '<path d="M15 7.4h5v5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    'doc_check': ('<path d="M6.2 3.6h7.3l5 5v11.8H6.2z" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/>'
                  '<path d="M9.1 13.6l2.3 2.3 4.1-4.3" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    'open':   ('<path d="M13.8 4.4h5.8v5.8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
               '<path d="M19.6 4.4 11.2 12.8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'
               '<path d="M16.8 14v4.4a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4V8.8a1.6 1.6 0 0 1 1.6-1.6H10"'
               ' stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
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
        None,
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
      box-shadow:0 3px 10px rgba(38,50,73,.07);
      display:flex;flex-direction:column;align-items:center;padding-top:37px}
.ico{width:126px;height:126px;border-radius:44px;margin-bottom:49px;
     display:flex;align-items:center;justify-content:center}
.ico svg{width:64px;height:64px}
.t{font-size:41px;line-height:1;font-weight:600;color:#2D3442;letter-spacing:.01em}
.s{font-size:23px;line-height:1;color:#9298A4;margin-top:12px}
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
            f'<svg viewBox="0 0 24 24">{ICON[icon]}</svg></div>'
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
