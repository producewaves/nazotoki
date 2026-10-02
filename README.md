# 午後3時の美術館

時間ループ型の謎解きゲームです。15:05に起きる爆発までの15分間を繰り返し、
ループのたびに集めた「知識」を使って脱出を目指します。

## 遊び方

- 美術館の全体が1枚のマップで見えます。矢印キー / WASD（スマホは十字ボタン）で歩き、
  気になるものの前でスペース（「調べる」ボタン）。
- 1歩で5秒、調べると30秒、話すと1分。15:05になると、また14:50に戻されます。
- 開けた扉や拾った物は戻るたびに元どおり。わかったことだけが「記憶」に残ります。
- 警備員や学芸員は時刻に合わせて館内を動きます。
- 進行状況はブラウザに自動で保存されます。

## 開発

```bash
npm install
npm run dev     # 開発サーバー
npm test        # テスト（vitest）
npm run lint    # lint（oxlint）
npm run build   # 本番ビルド（dist/）
```

## 構成

- `src/game/scenario.ts` — マップ・人物の予定・手がかり・暗証番号などシナリオのデータ
- `src/game/engine.ts` — ループや時間経過を扱う進行ロジック（純粋な reducer）
- `src/game/engine.test.ts` — 進行ロジックのテスト
- `src/render/` — ドット絵の描画（画像ファイルは使わず、すべてコードで描く）
- `src/ui/GameView.tsx` — 歩くアニメーション・人物の移動・キー操作
- `src/App.tsx` — 画面全体

## 公開（GitHub Pages）

`main` にプッシュすると `.github/workflows/deploy.yml` が lint・テスト・ビルドを実行し、
GitHub Pages にデプロイします。初回だけ、リポジトリの Settings → Pages で
Source を「GitHub Actions」にしてください。
