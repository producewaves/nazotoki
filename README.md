# 午後3時の美術館

時間ループ型の謎解きゲームです。15:05に起きる爆発までの15分間を繰り返し、
ループのたびに集めた「知識」を使って脱出を目指します。

## 遊び方

- 調べる・話す・移動する・待つなど、行動するたびに1分たちます。
- 15:05になると14:50のロビーに戻されます。開けた扉などはリセットされます。
- わかったことは「メモ帳」に残り、ループしても消えません。
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

- `src/game/scenario.ts` — 部屋・人物・手がかり・暗証番号などシナリオのデータ
- `src/game/engine.ts` — ループや時間経過を扱うゲームの進行ロジック（純粋な reducer）
- `src/game/engine.test.ts` — 進行ロジックのテスト
- `src/App.tsx` — 画面

新しい部屋や謎を追加するときは、まず `scenario.ts` にデータを足し、
特別な処理が必要な場合だけ `engine.ts` の `examine` / `talk` を拡張します。

## 公開（GitHub Pages）

`main` にプッシュすると `.github/workflows/deploy.yml` が lint・テスト・ビルドを実行し、
GitHub Pages にデプロイします。初回だけ、リポジトリの Settings → Pages で
Source を「GitHub Actions」にしてください。
