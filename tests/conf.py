"""テストの共通設定。Chrome の場所は、環境変数 CHROME で指定できる（指定しなければ Playwright の Chromium を使う）"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
GEN = ROOT / 'src' / 'generated'
SHOTS = ROOT / 'tests' / '_shots'      # スクリーンショットの置き場所（git には入れない）
SHOTS.mkdir(parents=True, exist_ok=True)
GEN.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get('CHROME')
LAUNCH = dict(executable_path=CHROME, args=['--no-sandbox']) if CHROME else dict()
URL = DOCS.as_uri() + '/'
