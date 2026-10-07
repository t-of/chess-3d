# chess-3d — 立体のチェス

3D の盤で 2 人で指すチェス

## 🔗 リンク

- 遊ぶ: https://t-of.github.io/chess-3d/
- 制作: [T.OF...](https://t-of.github.io/)

## 遊び方

2 人で交互に指す（AI なし）。駒をタップ → 光った升をタップで動く。ドラッグで盤を回し、ピンチ / ホイールで寄る。手番が変わると視点が相手側へ回る。
キャスリング・アンパッサン・プロモーション（クイーン固定）・チェックメイト / ステイルメイトに対応。

## アプリとして入れる（PWA）

- iPhone / iPad: Safari で開き、共有 → 「ホーム画面に追加」
- Android / PC の Chrome・Edge: 画面の「アプリにする」ボタン、またはアドレスバーのインストールボタン

## 開発

ビルド不要。three.js（r170）は `vendor/` に入れてある。ルール判定は `chess.js`（`node chess.js` で初期局面 20 手と perft を確認）。フォルダをそのまま静的サーバで開く。

```sh
python3 -m http.server 8000   # → http://localhost:8000/
```
