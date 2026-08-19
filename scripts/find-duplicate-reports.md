# KPT週次レポートの重複クリーンアップ手順

同一投稿が同一週に複数ダブって表示される問題（実データの多重投稿）を、
安全に洗い出して整理するための手順です。

> ⚠️ 最重要：このスクリプトは既定で **ドライラン（列挙・集計のみ）** です。
> Firestore のデータ削除は、社長の承認が取れてから、部長が実行します。
> 勝手に `--apply` で実行しないこと。

---

## 何をするスクリプトか

`scripts/dedupeReports.js` は `reports` コレクションを走査し、次のキーで重複を判定します。

- 重複判定キー: `authorId` + `weekNumber` + `year` + 正規化本文
  （`keep` + `problem_gap` + `try_what` を trim・空白正規化して連結）
- 残す1件の既定ルール:
  1. **エンゲージメント最大**（reactions合計 + commentCount + readBy数）を残す
  2. 同点なら **createdAt が最古** を残す
  3. それ以外を「削除候補」として列挙
- 下書き（`status === 'draft'`）は対象外。

出力は「重複グループ数 / 削除候補件数 / 各グループの 残すid・消すid一覧・authorName・storeName・weekNumber」。

---

## 方法A: firebase-admin（Node）で実行（推奨）

依存は `package.json` に追加しません。別途 npx / グローバルで用意します。

1. Firebase コンソールでサービスアカウント鍵(JSON)を発行し、安全な場所に保存。
2. 認証情報を環境変数で指定（Git Bash の例）:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/c/path/to/serviceAccount.json"
   ```
3. firebase-admin を一時的に用意（未導入なら）:
   ```bash
   npm i -g firebase-admin
   ```
4. まずドライラン（安全・既定。削除しない）:
   ```bash
   node ./scripts/dedupeReports.js
   ```
5. 出力を社長に共有し、削除して良いか確認を取る。
6. 承認後の実削除のみ、**二重ガードを両方解除**して実行:
   - `scripts/dedupeReports.js` 内の `const APPLY_CONFIRM = false;` を `true;` に書き換える
   - 実行時に `--apply` を付ける
   ```bash
   node ./scripts/dedupeReports.js --apply
   ```
   ※ どちらか一方でも欠けると削除は走りません（ガード）。

---

## 方法B: ブラウザ Console に貼り付け（admin鍵を使いたくない場合）

アプリに管理者でログインした状態で、DevTools Console から実行します。
※ この方法は Firestore への **削除は行いません**（列挙・集計のみ）。削除は方法Aで。

1. アプリを開き、レポート一覧が読み込まれた状態にする。
2. `scripts/dedupeReports.js` の中身をコピーして Console に貼り付ける
   （`window.__dedupeReports` に純関数が公開される）。
3. 画面のストアからレポート配列を取り出して判定:
   ```js
   // Zustand ストアから全レポートを取得（アプリの実装に合わせて）
   const reports = window.__dedupeReports
     ? (window.useReportStore?.getState?.().reports || [])
     : [];
   const groups = window.__dedupeReports.buildDuplicateGroups(reports);
   window.__dedupeReports.printReport(groups);
   ```
   ※ ストアが `window` に露出していない場合は、方法A（firebase-admin）を使ってください。
   　 ブラウザ版は「表示中の最大150件」しか見えないため、全件の棚卸しには方法Aが確実です。

---

## 実行前チェックリスト

- [ ] ドライランの出力を社長に共有し、削除対象を承認してもらった
- [ ] バックアップ（Firestore エクスポート）を取得済み
- [ ] `APPLY_CONFIRM = true` と `--apply` の両方を意図的に有効化した
- [ ] 実行は部長が行う（自動実行・CI からは実行しない）
