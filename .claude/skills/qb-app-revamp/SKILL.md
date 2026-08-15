---
name: qb-app-revamp
description: 管理者共有ツールAPP を QB HOUSE ブランド(紺×シアン)へ刷新する時の設計規約・チェックリスト・機械検証手順。ページのUI/UX刷新、paradise配色の除去、モバイル対応(44px/12px/Toast化)、視認性インジケーター適用の作業を行うとき必ず参照する。
---

# QB APP 刷新スキル

管理者共有ツールAPP（React 19 / Vite / Tailwind v4 / Zustand / Firebase）を
**QB HOUSE Brand Design Policy v2.0（紺×シアンのミニマル）** に刷新する作業の唯一の手順書。

## 情報源（single source of truth）
- `Design.md` … ブランド思想・カラー・タイポ・モバイル規約の全文
- `design-tokens.yaml` … トークン定義
- `docs/REVAMP_PROGRESS.md` … **外部メモリ**。残タスクと完了状態。作業前に読み、作業後に更新する
- 実装済みの参考ページ（お手本）: `src/pages/KeyPassManagement.tsx`, `PostAnnouncement.tsx`, `Profile.tsx`, `CalendarView.tsx`

## 使えるトークン（src/index.css @theme）
- 面/文字: `bg-surface` `bg-canvas` `text-ink`(#00004B) `text-ink-soft` `border-line`
- ブランド: `qb-navy` `qb-blue-dark`(#00327D) `qb-blue`(#005AAF) `qb-blue-mid` `qb-cyan`(#00A5EB)
- 状態: `success`(#17B26A) `danger`(#E60000) `qb-yellow`(注意のみ) `qb-gray` `qb-gray-light`
- ユーティリティ: `.tabular`(数字桁揃え) `.tap`(44px最小タップ) `glass` `no-scrollbar`
- **重要**: `paradise-*` は値だけQB色へ再マップ済み。クラス名を残しても発色はブランド準拠。ただし新規は qb-* を使う。

## 絶対ルール（Design.md §2/§6 準拠）
1. **12px未満禁止** — `text-[7px]〜[11px]` は全廃し `text-xs`(12px) 以上へ。荷重情報ほど大きく。
2. **タップ領域 44×44px** — 削除×やトグルは `tap` か `min-h-[44px]`。
3. **native `alert()/confirm()/prompt()` 全廃** — 成功/失敗は **Toast**、破壊操作の確認は **モーダル/Sheet**。
4. **見えない `text-white` を是正** — ページ背景は淡いブルーグレー。カラーカード内以外の `text-white` は `text-ink`/`text-ink-soft` にするか、グラデhero(`bg-gradient-to-br from-qb-blue to-qb-cyan`)で包む。
5. **数値は `tabular`**、KPIは大きく（Display 36px）。`font-black` 乱用をやめ階層はサイズ+色で。
6. **モバイル1カラム**、入力に `inputMode`/`enterKeyHint`/`autoComplete`。
7. **業務ロジック（Firestore 書込み/購読）は変更しない。** 見た目・トークン・モバイル対応のみ。

## 標準 Toast パターン（コピー用）
```tsx
const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });
useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);
```
```tsx
<AnimatePresence>
  {toast && (
    <motion.div initial={{ opacity:0, y:-24 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-24 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl font-bold text-sm text-white max-w-[90vw]"
      style={{ background: toast.type === 'error' ? '#E60000' : '#17B26A' }}>
      {toast.type === 'error' ? <AlertTriangle size={18} className="shrink-0" /> : <Check size={18} className="shrink-0" />}
      {toast.msg}
    </motion.div>
  )}
</AnimatePresence>
```

## 視認性インジケーター（`src/components/ui/Indicators.tsx`）
`RatingStars`(星) `ProgressRing`(達成率) `MetricBar`(前年比) `RankBar`(順位・金銀銅) `StatTile` `DeltaBadge` `BentoGrid`。
ダッシュボードは Bento グリッド（モバイル1列→sm2列→lg4列）で「1タイル=1指標+1可視化+1ラベル」。

## 作業手順（1ページ単位）
1. `docs/REVAMP_PROGRESS.md` を読み、次の未完 `[ ]` ページを1つ選ぶ。
2. 対象ページを Read。`grep` で `text-\[(7|8|9|10|11)px\]` / `alert|confirm|prompt` / `text-white` / `paradise-` を数える。
3. 上のルール1–7に沿って Edit（お手本ページの構造を踏襲）。
4. **検証**: `npm run lint`（= `tsc --noEmit`）を実行し exit 0 を確認。
5. `docs/REVAMP_PROGRESS.md` の該当行を `[x]` に更新。
6. 予期せぬ型エラーで直せない場合はそのページを `[ ]` のまま残し「ブロッカー」に記録して次へ。

## 完了（ゴール）の機械判定
- `npm run lint` が exit 0（型エラー0）
- `npm run build` が exit 0（本番ビルド成功）
- `docs/REVAMP_PROGRESS.md` の残タスクが全て `[x]`
この3つが揃ったら刷新完了。
