# Design System — 管理者共有ツールAPP

> **出典**: QB HOUSE / QB Net Co., Ltd. **Brand Design Policy VER 2.0 (2022.11.1)**（STRICTLY CONFIDENTIAL）より抽出したブランド規定に、本アプリの UI/UX 刷新方針を統合したもの。
> このファイルと [`design-tokens.yaml`](design-tokens.yaml) が **唯一の情報源（single source of truth）**。色・余白・文字サイズを直値でハードコードせず、必ずトークン（`--color-*` / Tailwind クラス）を参照する。

---

## 0. ブランド思想

| 項目 | 内容 |
|---|---|
| Philosophy | **LESS IS MORE** — 引き算の美学。要素を減らし、情報の階層を明確に。 |
| Voice | **Come alive, be yourself!** — 前向き・清潔・機能的。 |
| 適用原則 | 装飾より可読性。1画面1メッセージ。ノイズ（過剰なグラデ/アニメ/極小文字）を排除。 |

刷新前の本アプリは「Paradise」トロピカル配色（ピンク/ティール/サンセット橙のアニメ背景）で、ブランドと乖離し情報過多だった。本設計はそれを **QB HOUSE の紺×シアンのミニマル・コーポレートUI** に置き換える。

---

## 1. カラー

### 1.1 ブランドパレット（原典の実測値）

| トークン | HEX | RGB | CMYK | PANTONE / DIC | 役割 |
|---|---|---|---|---|---|
| `qb-navy` | `#00004B` | 0,0,75 | C100 M100 Y0 K60 | 2955U / DIC F6 | **基幹色**。ロゴ・見出し・濃色面 |
| `qb-blue-dark` | `#00327D` | 0,50,125 | C100 M80 Y0 K30 | 2945U / DIC F45 | 濃青。強調・ヘッダー |
| `qb-blue` | `#005AAF` | 0,90,175 | C100 M60 Y0 K0 | 3005C / DIC 579 | **主要操作色**（ボタン・リンク） |
| `qb-blue-mid` | `#0082CD` | 0,130,205 | C95 M30 Y0 K0 | 3005C / DIC 640 | 中間青。グラフ・帯 |
| `qb-cyan` | `#00A5EB` | 0,165,235 | C90 M0 Y0 K0 | Process Cyan / DIC 577 | **アクセント/CTA**。ハイライト・選択状態 |
| `qb-yellow` | `#FAF028` | 250,240,40 | C5 M0 Y85 K0 | 3965U / DIC 597 | 注意喚起・バッジ（多用しない） |
| `qb-red` | `#E60000` | 230,0,0 | C0 M100 Y100 K0 | 206U / DIC 563 | 警告・エラー・不足のみ |
| `qb-gray` | `#7D7D7D` | 125,125,125 | C65 M50 Y45 K0 | Cool Gray 11 | 本文補助・境界 |
| `qb-gray-light` | `#DADADA` | 218,218,218 | C17 M13 Y13 K0 | Cool Gray 1 | 罫線・無効状態 |
| `qb-white` | `#FFFFFF` | 255,255,255 | C0 M0 Y0 K0 | — | 面・カード |

### 1.2 セマンティックロール（UIでの意味づけ）

| 意味 | トークン | 値 |
|---|---|---|
| Primary（主操作） | `--color-primary` | `qb-blue #005AAF` |
| Accent（CTA/選択） | `--color-accent` | `qb-cyan #00A5EB` |
| Ink（本文/見出し） | `--color-ink` | `qb-navy #00004B` |
| Surface（背景面） | `--color-surface` | `#FFFFFF` |
| Canvas（ページ背景） | `--color-canvas` | `#F4F8FC`（極淡ブルーグレー） |
| Success | `--color-success` | `#17B26A` |
| Warning | `--color-warning` | `qb-yellow #FAF028`（文字は navy） |
| Danger | `--color-danger` | `qb-red #E60000` |
| Muted | `--color-muted` | `qb-gray #7D7D7D` |
| Hairline（罫線） | `--color-line` | `#E4EBF2` |

> **配色ルール**: 1画面あたり有彩色は原則 **navy + blue + cyan の青系1トーン** に統一。yellow / red は「注意・警告」の意味を持つときだけ。green（success）は完了・達成にのみ。装飾目的で複数のビビッド色を並べない（旧pink/mint/lavender/sunsetの多色使いを廃止）。

### 1.3 旧トークンの再マッピング（無停止リブランド）

既存コードは `paradise-*` を多数参照するため、クラス名は変えず **値だけ** ブランド色へ置換する。

| 旧トークン | 旧値 | → 新値 | 意図 |
|---|---|---|---|
| `paradise-ocean` | `#007A99` | **`#005AAF`** | 主操作色 → QB Blue |
| `paradise-sunset` | `#D96A46` | **`#00A5EB`** | アクセント/CTA → QB Cyan |
| `paradise-blue` | `#70D1CD` | **`#0082CD`** | 中間青 |
| `paradise-mint` | `#56C49D` | **`#17B26A`** | 成功系グリーンとして温存 |
| `paradise-lavender`| `#9F83C1` | **`#00327D`** | 濃紺へ |
| `paradise-pink` | `#D697A7` | **`#C7DCEF`** | 淡ブルーの装飾へ |

---

## 2. タイポグラフィ

原典指定：和文 **Noto Sans CJK JP**、欧文 **Red Hat Display**（見出し）。エディトリアル系は Noto Serif CJK JP + Abhaya Libre（本アプリでは未使用）。

```
font-family:
  "Red Hat Display",      /* 数字・英字・見出し */
  "Noto Sans JP",         /* 和文 */
  system-ui, sans-serif;
```

- **数字（KPI/客数/評価）** は Red Hat Display を優先し、`font-variant-numeric: tabular-nums` で桁揃え。
- ウェイト：Regular(400) / Medium(500) / Bold(700) / Black(900)。旧UIの `font-black` 乱用をやめ、階層は**サイズと色**で作る。

### タイプスケール（rem / 行間）

| 用途 | size | line-height | weight |
|---|---|---|---|
| Display（KPI大数字） | 2.25rem (36) | 1.05 | 900 |
| H1 | 1.5rem (24) | 1.25 | 700 |
| H2 | 1.25rem (20) | 1.3 | 700 |
| H3 | 1.075rem (17) | 1.35 | 700 |
| Body | 0.9375rem (15) | 1.6 | 400/500 |
| Label | 0.8125rem (13) | 1.4 | 500 |
| Caption（最小） | **0.75rem (12)** | 1.4 | 500 |

> **鉄則：12px 未満を使わない。** 旧UIの `text-[7px]/[9px]/[10px]` は全廃。荷重情報（過不足・達成率・ステータス）ほど大きく。

---

## 3. スペーシング・角丸・影・モーション

- **Spacing**（4pxグリッド）: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40。
- **Radius**: sm 8 / md 12 / lg 16 / xl 20 / 2xl 24 / pill 9999。カード標準は `lg(16)`〜`xl(20)`（旧`2rem/3rem`の過剰丸みを抑える）。
- **Shadow**: `sm`（微）/ `md`（カード）/ `lg`（浮上/モーダル）。多用しない。
- **Glass**: 背景が淡色になるため半透明は `rgba(255,255,255,.72)` + `blur(10px)` に上げ、コントラスト確保。
- **Motion**: 150–250ms / `ease-out`。ページ遷移の3D `rotateY` や常時ループ発光（背景blob）は低負荷化・削減。`prefers-reduced-motion` を尊重。

---

## 4. ダッシュボード：Bento Grid（弁当グリッド）

情報を**用途別のタイル**に分割し、CSS Grid で敷き詰める。モバイル1列 → sm 2列 → lg 4列。

```
grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
gap: 12px;   /* mobile */ 16px; /* >=sm */
```

- **Hero タイル**（最重要KPI 1–2枚）は `col-span-2 row-span-2` で大きく。
- 1タイル＝1指標＋1可視化＋1ラベル。タイル内に25項目を詰め込まない（旧StoreMetricsの反省）。
- タイルの上部に極小ラベル、中央に**大数字（Display）**、下に**インジケーター**（下記）。

推奨タイル例：`客数実績/予算（達成率リング）`・`前年比（バー）`・`Google口コミ（星）`・`稼働 vs 必要人工（バー＋過不足）`・`新規/リピート比率（スタックバー）`。

---

## 5. 視認性インジケーター

再利用コンポーネントとして `src/components/ui/` に実装（[design-tokens.yaml](design-tokens.yaml) の `components` 参照）。

| コンポーネント | 用途 | 仕様 |
|---|---|---|
| **RatingStars** | Google口コミ評価 | 5つ星、0.1刻みで部分塗り。数値併記（例 `★4.3`）。色 `qb-yellow`、空は `qb-gray-light` |
| **ProgressRing** | 達成率（予客達成率/公休消化） | SVG円環。100%=`success`、80–99%=`accent`、<80%=`warning`。中央に% |
| **MetricBar** | 前年比・曜日別・比率 | 横バー。基準線（100%/前年）を点線で表示。＋は`success`／−は`danger` |
| **RankBar** | 店舗ランキング | 行内に相対長バー＋順位。1–3位は金/銀/銅。差（gap）が一目で分かる |
| **StatTile** | Bentoの基本タイル | label / value(Display) / delta / 任意のインジケーター slot |
| **DeltaBadge** | 増減 | `▲+0.2`(success) / `▼-0.1`(danger)、色と矢印で方向明示 |

**しきい値の色分け（例）**
- 達成率：≥100% success / 90–99% accent / <90% warning / 大幅未達 danger
- 過不足人工：0以上 success / -1〜-2 warning / -3以下 danger（`animate-pulse`は-3以下のみ）

---

## 6. モバイル・ファースト入力規約

対象は**スマホがメイン**の店長/AM/BM。以下を必須とする（調査で検出した問題への対処）。

1. **タップ領域 ≥ 44×44px**（旧12pxの`×`削除ボタン等を是正）。
2. **最小文字 12px**（§2）。カレンダーセル/ステータスバッジの極小文字を廃止。
3. **native `alert()/confirm()/prompt()` を全廃** → アプリ内 **Toast**（成功/失敗）と **Sheet/Dialog**（確認・破壊操作）に置換。
4. **textarea は auto-grow**（`SmoothTextArea` に高さ自動拡張を追加、`resize-none`固定廃止）。
5. **モバイルは1カラム**：`grid-cols-2` の横並び入力（誰が/いつ 等）は縦積みに。
6. **ボトムシート**でフォーム/選択を提示（キーボードと競合する固定`h-[90vh]`パネルを是正、`env(safe-area-inset-bottom)` 対応）。
7. **入力補助属性**：`inputMode` / `enterKeyHint` / `autoComplete` / `autoCapitalize=off`（ID等）。Login は `<form>` 化し Enter 送信。
8. **ネスト内スクロール（`no-scrollbar`）を避け**、必要時はスクロール可視化。
9. **ホバー依存の操作を排除**（アバター変更等はタップで常時アフォーダンス表示）。
10. **カレンダー高密度セル**は「バッジ＋色」で状態を示し、詳細は**タップでシート展開**。

---

## 7. アクセシビリティ

- テキストコントラスト AA（本文 4.5:1）。navy/blue on white は十分。**yellow上の文字は navy**（白抜き禁止）。
- 状態は色だけに依存しない（アイコン/記号/ラベル併用：達成`✓`、不足`▼`、警告`!`）。
- フォーカスリング（`outline` 2px `accent`）を消さない。
- `prefers-reduced-motion: reduce` で装飾アニメを停止。

---

## 8. 実装マッピング

| 論理 | 実体 |
|---|---|
| トークン定義 | `src/index.css` の `@theme`（Tailwind v4） |
| フォント | `index.html` の Google Fonts（Noto Sans JP + Red Hat Display） |
| PWA配色 | `index.html` `theme-color` / `public/manifest.json` `theme_color` = `#00327D` |
| プリミティブ | `src/components/ui/` (RatingStars, ProgressRing, MetricBar, RankBar, StatTile, DeltaBadge, BentoGrid, Sheet, Toast) |

---

## 9. 段階的ロールアウト

- **Phase 1（本コミット）**: トークン基盤・フォント・背景/glass刷新・PWA配色・インジケーター/Bentoプリミティブ・アプリシェル（Header/ナビ/背景）。旧`paradise-*`のremapで**全画面が即ブランド化**。
- **Phase 2**: ダッシュボード再構成（StoreMetrics / StoreMetricsRanking / ShiftDashboard / LeavePlanDashboard / Achievements）を Bento＋インジケーターへ。極小文字全廃。
- **Phase 3**: 入力系（PostReport / StaffShiftRequest / KeyPass / Calendar / ProjectsView / Login）のモバイル化（Sheet/Toast/auto-grow/44px/`<form>`）。
- **Phase 4**: `dangerouslySetInnerHTML` のサニタイズ、リアルタイム購読への統一、不要な desktop-only コード削減。

---

_最終更新: 2026-08-15 — QB HOUSE Brand Design Policy v2.0 準拠_
