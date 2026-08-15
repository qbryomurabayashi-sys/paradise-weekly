---
description: QB APP 刷新を夜間自律で回すループ。残ページを1ページずつ刷新し、型検証まで通す。
argument-hint: "[最大ページ数。省略時は残り全部]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm run lint), Bash(npm run build), Bash(npx tsc --noEmit), Bash(grep:*)
---

# 刷新ループ実行

あなたは `qb-app-revamp` スキルに従って、管理者共有ツールAPP の残ページを自律的に刷新する。

## 進め方（この順で厳密に）
1. `qb-app-revamp` スキルを読み込む（設計規約・Toastパターン・ルール1–7）。
2. `docs/REVAMP_PROGRESS.md` を読む（外部メモリ）。「残タスク」で未完 `[ ]` のページを **上から1つ** 選ぶ。
3. 選んだページを刷新する（スキルの「作業手順」に従う）。**1ターンにつき原則1ページ。**
4. `npm run lint` を実行。**exit 0 でなければそのページの修正を続ける**（別ページに進まない）。
5. exit 0 になったら `docs/REVAMP_PROGRESS.md` の該当行を `[x]` に更新。
6. 次の未完ページへ。以降 2〜5 を繰り返す。

## 完了条件（機械判定ゴール）
次を **すべて** 満たしたら停止し、変更サマリを報告する：
- `npm run lint`（`tsc --noEmit`）が exit 0
- `npm run build` が exit 0
- `docs/REVAMP_PROGRESS.md` の残タスクが全て `[x]`

## 停止条件（暴走防止・必須）
- **上限ページ数**: $ARGUMENTS ページを刷新したら、ゴール未達でも停止して申し送りを報告（省略時は残り全ページが上限）。
- 同一ページで `npm run lint` が **3回連続 exit≠0** なら、そのページを `[ ]` のまま残し、エラー全文を `docs/REVAMP_PROGRESS.md` の「ブロッカー」に記録して次のページへ。
- 業務ロジック（Firestore 書込み/購読）の変更が必要になったら、勝手に変えず「ブロッカー」に記録して次へ。

## 厳守
- 見た目・トークン・モバイル対応のみ。データ層は触らない。
- 情報源は `Design.md` / `design-tokens.yaml` / スキル。直値ハードコード禁止。
- 各ページ完了ごとに必ず外部メモリを更新（途中で中断されても再開できるように）。
