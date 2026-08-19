/**
 * dedupeReports.js — KPT週次レポートの重複検出＆クリーンアップ（既定はドライラン）
 *
 * ⚠️ 既定では「候補を列挙・集計するだけ」で、Firestore のデータは一切削除しません。
 * ⚠️ 実際に削除するのは、明示的に `--apply` を付けて、かつ下の APPLY_CONFIRM を
 *    true に書き換えたときだけです（二重ガード）。社長の確認が取れるまで実行しないこと。
 *
 * 使い方（firebase-admin。依存は package.json に足さず、別途 npx で使う）:
 *   1) サービスアカウント鍵(JSON)を用意し、環境変数で場所を指定する:
 *        export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   2) ドライラン（安全・既定）:
 *        npx --yes firebase-admin@12 node ./scripts/dedupeReports.js
 *      ※ firebase-admin が入っていなければ、いったんグローバル/一時導入:
 *        npm i -g firebase-admin   （または npx で解決）
 *   3) 実削除（社長承認後のみ。--apply かつ APPLY_CONFIRM=true の両方が必要）:
 *        node ./scripts/dedupeReports.js --apply
 *
 * 重複判定キー: authorId + weekNumber + year + 正規化本文
 *   （keep / problem_gap / problem_ideal / try_who / try_when / try_what / try_why の7項目を
 *    trim・空白正規化し U+0001 区切りで連結）
 * 残す1件の既定ルール: エンゲージメント最大（reactions合計 + commentCount。readBy は含めない）。
 *                      同点なら createdAt が最古を残す。それ以外を削除候補にする。
 *
 * ★正はアプリ内のBM専用「KPT重複クリーンアップ」パネル（src/pages/AdminDashboard.tsx）。
 *   このスクリプトは補助であり、weekNumber は createdAt からの getFiscalWeek 再計算値で
 *   グループ化する点も含め、アプリ側（表示側畳み込みロジックD＝useReportStore.ts）が最終基準です。
 *   このスクリプトは createdAt からの週再計算を行わず、保存済み weekNumber をそのまま使うため、
 *   週補正が未反映のデータでは結果が食い違う可能性があります。最終判断はアプリ側で行ってください。
 */

// ==== 二重ガード：本当に削除するときだけ true に書き換える ==================
// これが false の間は、--apply を付けても削除は実行されません。
const APPLY_CONFIRM = false;
// ==========================================================================

const APPLY = process.argv.includes('--apply');

async function main() {
  // firebase-admin は依存に含めない（手順書参照）。実行時に解決する。
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    console.error('firebase-admin が見つかりません。手順書 scripts/find-duplicate-reports.md を参照してください。');
    process.exit(1);
    return;
  }

  if (!admin.apps.length) {
    // GOOGLE_APPLICATION_CREDENTIALS からサービスアカウントを読む
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  const snap = await db.collection('reports').get();
  const reports = [];
  snap.forEach((doc) => reports.push({ id: doc.id, ...doc.data() }));

  const groups = buildDuplicateGroups(reports);

  printReport(groups);

  if (!APPLY) {
    console.log('\n[DRY-RUN] 削除は行っていません。実削除するには --apply とスクリプト内 APPLY_CONFIRM=true の両方が必要です。');
    return;
  }
  if (!APPLY_CONFIRM) {
    console.log('\n[GUARD] --apply は指定されましたが APPLY_CONFIRM が false のため削除しません。');
    console.log('        社長の承認後、スクリプト内の APPLY_CONFIRM を true に書き換えて再実行してください。');
    return;
  }

  // ==== ここから実削除（二重ガードを両方通過したときだけ到達） ====
  let deleted = 0;
  for (const g of groups) {
    for (const victim of g.removeIds) {
      await db.collection('reports').doc(victim).delete();
      deleted++;
      console.log(`  deleted ${victim}`);
    }
  }
  console.log(`\n[APPLIED] ${deleted} 件を削除しました。`);
}

// ---- 共通ロジック（ブラウザConsole版とも共有できる純関数） ----------------
function normalizeContent(r) {
  // KPT内容フィールド全7項目を trim・空白正規化して U+0001 区切りで連結。
  // アプリ側 src/lib/dateUtils.ts の normalizeKptContent と同一仕様（正はアプリ側）。
  return [r.keep, r.problem_gap, r.problem_ideal, r.try_who, r.try_when, r.try_what, r.try_why]
    .map((v) => String(v == null ? '' : v).trim().replace(/\s+/g, ' '))
    .join('\u0001');
}

function tsMillis(createdAt) {
  if (!createdAt) return 0;
  if (typeof createdAt === 'number') return createdAt;
  if (typeof createdAt === 'object' && typeof createdAt.toDate === 'function') return createdAt.toDate().getTime();
  if (typeof createdAt === 'object' && typeof createdAt.seconds === 'number') return createdAt.seconds * 1000;
  if (typeof createdAt === 'string') { const p = new Date(createdAt).getTime(); return isNaN(p) ? 0 : p; }
  return 0;
}

function engagement(r) {
  const reactionSum = Array.isArray(r.reactions)
    ? r.reactions.reduce((s, x) => s + (Number(x.count) || (Array.isArray(x.userIds) ? x.userIds.length : 0)), 0)
    : 0;
  const comments = Number(r.commentCount) || 0;
  // readBy（既読数）は含めない（アプリ側Dと同一仕様）。
  return reactionSum + comments;
}

function buildDuplicateGroups(reports) {
  // 下書きは対象外（published/undefined のみ）
  const target = reports.filter((r) => r.status !== 'draft');
  const map = new Map();
  for (const r of target) {
    const key = [r.authorId, r.weekNumber, r.year, normalizeContent(r)].join('||');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }

  const groups = [];
  for (const [, arr] of map) {
    if (arr.length < 2) continue; // 重複していないものは対象外
    // 残す1件：エンゲージメント最大 → 同点なら createdAt 最古
    const sorted = [...arr].sort((a, b) => {
      const de = engagement(b) - engagement(a);
      if (de !== 0) return de;
      return tsMillis(a.createdAt) - tsMillis(b.createdAt);
    });
    const keep = sorted[0];
    const remove = sorted.slice(1);
    groups.push({
      keepId: keep.id,
      removeIds: remove.map((x) => x.id),
      authorName: keep.authorName || '(不明)',
      storeName: keep.storeName || '(不明)',
      weekNumber: keep.weekNumber,
      year: keep.year,
      keepEngagement: engagement(keep),
    });
  }
  return groups;
}

function printReport(groups) {
  const totalGroups = groups.length;
  const totalRemove = groups.reduce((s, g) => s + g.removeIds.length, 0);
  console.log('===== KPT 重複レポート集計 =====');
  console.log(`重複グループ数: ${totalGroups}`);
  console.log(`削除候補件数  : ${totalRemove}`);
  console.log('--------------------------------');
  groups.forEach((g, i) => {
    console.log(`#${i + 1} ${g.authorName} / ${g.storeName} / ${g.year}年 第${g.weekNumber}週`);
    console.log(`   残す : ${g.keepId} (engagement=${g.keepEngagement})`);
    console.log(`   消す : ${g.removeIds.join(', ')}`);
  });
  console.log('================================');
}

// Node 実行時のみ main を走らせる（ブラウザ貼り付け時は関数だけ使う）
if (typeof require !== 'undefined' && require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

// ブラウザConsole 版で使えるように公開（任意）
if (typeof window !== 'undefined') {
  window.__dedupeReports = { buildDuplicateGroups, printReport, normalizeContent, engagement };
}
