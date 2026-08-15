# 刷新進捗（外部メモリ / Loop Engineering）

> このファイルは**ループの外部メモリ**。各ターンの最初に読み、作業後に更新する。
> 各ページは「完了条件」を全て満たしたら `[x]` にする。判定はコマンド末尾の検証（`npm run lint` = `tsc --noEmit` と `npm run build`）が **exit 0** であることを機械的ゴールとする。
> ルール詳細は `.claude/skills/qb-app-revamp/SKILL.md` を参照。

## 機械判定ゴール（毎ターン末で実行）
- [x] `npm run lint`（= `tsc --noEmit`）が exit 0
- [x] `npm run build` が exit 0（警告=チャンクサイズ/動的import併用の情報のみ・エラーなし）
- [x] 下の全ページが `[x]` ← **全画面刷新 完了 2026-08-15**

## 完了済み（Phase 1–3, 13画面）
- [x] App shell + Login
- [x] StoreMetricsRanking / LeavePlanDashboard / ShiftDashboard / StoreMetrics
- [x] MainBoard / PostReport
- [x] CalendarView / StaffShiftRequest / KeyPassManagement
- [x] PostAnnouncement / Profile

## 残タスク（Phase 2/4 — 夜間ループ対象）
検出済みの具体的アンチパターン（`grep`実測 2026-08-15）。数が 0 になったら該当項目クリア。

- [x] **ReportDetail.tsx** 〔最重〕 完了：極小文字0/不可視white0（残white全て有色背景orダークバー上）。戻る/コメント見出し/分割右カラムをink・surface化、送信/選定ボタンqbグラデ、tap適用。lint exit0。
- [x] **BrandAIInsights.tsx** 完了：ヘッダーをqbグラデhero化、入力44px+focus:qb-cyan、分析ボタン/ローディング/prose/空状態をqbトークン化。paradise0/gray0/lint exit0。
- [x] **AdminDashboard.tsx** 完了：alert4件をToast(success/danger)化、paradise/gray→qbトークン、入力44px+inputMode/autoComplete/enterKeyHint、作成ボタンqbグラデ。lint exit0。
- [x] **ProjectsView.tsx** 完了：window.confirmを削除確認モーダル化、極小text-[10px]→text-xs、paradise/gray→qbトークン、入力44px+enterKeyHint。lint exit0。
- [x] **ProfileEdit.tsx** 完了：alert2件→Toast（成功は1.2s後reload）、paradise/orange/gray→qb、🌴→Userアイコン+qbグラデアバター、入力44px+inputMode/autoComplete/enterKeyHint。lint exit0。
- [x] **MonthlyInsights.tsx** 完了：極小text-[10px]→text-xs、月チップtabular+tap、paradise/gray/yellow→qb、生成ボタンtap。lint exit0/アンチパターン0。
- [x] **Achievements.tsx** 完了：各実績に相対バー（qbグラデ）追加で視認性UP、paradise/gray→qbトークン、スピナー/トロフィー/アワードをqb化。lint+build exit0。

## ループ運用メモ
- 1ターン=1ページを原則。着手時に該当行を「作業中」と追記、完了で `[x]`。
- 業務ロジック（Firestore 書込み・購読）は変更しない。見た目/トークン/モバイル対応のみ。
- 迷ったら `Design.md` と `design-tokens.yaml` が唯一の情報源。
- 予期せぬ TypeScript エラーが出たら、そのページを `[ ]` のまま残しエラー内容をこの下の「ブロッカー」に記録して次へ。

## ブロッカー / 申し送り
（なし）
