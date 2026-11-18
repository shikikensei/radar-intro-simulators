"""リポジトリの中のファイルの場所を決める共通部品（組み立てスクリプトから使う）"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src'
DOCS = ROOT / 'docs'            # 完成した HTML の置き場所（GitHub Pages の公開元）
GEN = SRC / 'generated'         # 組み立ての途中で作るファイル（git には入れない）
DIRS = [SRC / 'framework', SRC / 'episodes', SRC / 'episodes' / 'legacy', GEN]


def find(name):
    for d in DIRS:
        p = d / name
        if p.exists():
            return p
    raise FileNotFoundError(name)


def rd(name):
    return find(name).read_text(encoding='utf-8')


def wr(path, text):
    """改行を LF にそろえて書く（OS が違っても同じファイルになるように）"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
