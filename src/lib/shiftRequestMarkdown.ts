import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * 希望休一覧のMarkdown（.md）生成。
 *
 * 画面（ShiftDashboard の「希望休一覧」タブ）に出ている申請だけを渡して、そのまま文字列にする。
 * ここでは絞り込み・権限判定を一切しない（＝画面と食い違うファイルを作らないため、
 * 何を出すかの判断は呼び出し側の visibleRequests に一元化する）。
 */

export interface MdShiftRequest {
  staffId: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  type: string;
  status: string;
  notes?: string;
}

export interface BuildMarkdownOptions {
  /** 見出しに出す月（例: "2026年10月"） */
  monthLabel: string;
  /** 対象範囲（例: "全店舗" / "追浜"） */
  scopeLabel: string;
  requests: MdShiftRequest[];
  /** 店舗マスタの表示順。ここに無い店舗は末尾に回す */
  storeOrderIds: string[];
  getStoreName: (storeId: string) => string;
  getStaffName: (staffId: string) => string;
  /** 出力日時。テスト時に固定するために外から渡せるようにしている */
  now?: Date;
}

export const shiftStatusLabel = (status: string) =>
  status === 'pending' ? '承認待ち' : status === 'approved' ? '承認済' : status === 'rejected' ? '却下' : '不明';

/** MDの表セルを壊さないよう、区切り記号と改行だけを無害化する（内容は書き換えない） */
const mdCell = (v: any) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

const dateLabel = (date: string) => {
  const d = new Date(date);
  // 壊れた日付でファイル生成ごと落とさない（元の文字列をそのまま出す）
  if (isNaN(d.getTime())) return date;
  return format(d, 'M/d (E)', { locale: ja });
};

export function buildShiftRequestMarkdown(opts: BuildMarkdownOptions): string {
  const { monthLabel, scopeLabel, requests, storeOrderIds, getStoreName, getStaffName } = opts;
  const now = opts.now || new Date();

  const storeOrder = new Map<string, number>(storeOrderIds.map((id, i) => [id, i]));
  const byStore = new Map<string, MdShiftRequest[]>();
  requests.forEach((r) => {
    if (!byStore.has(r.storeId)) byStore.set(r.storeId, []);
    byStore.get(r.storeId)!.push(r);
  });
  const storeIds = [...byStore.keys()].sort(
    (a, b) => (storeOrder.get(a) ?? 999) - (storeOrder.get(b) ?? 999)
  );

  // 備考が1件も無いときは列を出さない（空欄だけの列で表を太らせない）
  const hasNotes = requests.some((r) => (r.notes || '').trim());

  const lines: string[] = [];
  lines.push(`# ${monthLabel} 希望休一覧`);
  lines.push('');
  lines.push(`- 対象: ${scopeLabel}`);
  lines.push(`- 件数: ${requests.length}件`);
  lines.push(`- 出力日時: ${format(now, 'yyyy/MM/dd HH:mm')}`);
  lines.push('');

  storeIds.forEach((storeId) => {
    const reqs = byStore.get(storeId)!;
    lines.push(`## ${getStoreName(storeId)}（${reqs.length}件）`);
    lines.push('');

    const byStaff = new Map<string, MdShiftRequest[]>();
    reqs.forEach((r) => {
      if (!byStaff.has(r.staffId)) byStaff.set(r.staffId, []);
      byStaff.get(r.staffId)!.push(r);
    });
    const staffIds = [...byStaff.keys()].sort((a, b) =>
      getStaffName(a).localeCompare(getStaffName(b), 'ja')
    );

    staffIds.forEach((staffId) => {
      const rows = byStaff.get(staffId)!.slice().sort((a, b) => a.date.localeCompare(b.date));
      lines.push(`### ${getStaffName(staffId)}（${rows.length}件）`);
      lines.push('');
      lines.push(hasNotes ? '| 日付 | 区分 | 状態 | 備考 |' : '| 日付 | 区分 | 状態 |');
      lines.push(hasNotes ? '| --- | --- | --- | --- |' : '| --- | --- | --- |');
      rows.forEach((r) => {
        const cells = [mdCell(dateLabel(r.date)), mdCell(r.type), mdCell(shiftStatusLabel(r.status))];
        if (hasNotes) cells.push(mdCell((r.notes || '').trim() || '—'));
        lines.push(`| ${cells.join(' | ')} |`);
      });
      lines.push('');
    });
  });

  // 日付順の通し一覧も付ける（かぶりの確認は日付で見るのが早い）
  lines.push('## 日付順（全員）');
  lines.push('');
  lines.push('| 日付 | 店舗 | 氏名 | 区分 | 状態 |');
  lines.push('| --- | --- | --- | --- | --- |');
  [...requests]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        getStoreName(a.storeId).localeCompare(getStoreName(b.storeId), 'ja') ||
        getStaffName(a.staffId).localeCompare(getStaffName(b.staffId), 'ja')
    )
    .forEach((r) => {
      lines.push(
        `| ${mdCell(dateLabel(r.date))} | ${mdCell(getStoreName(r.storeId))} | ${mdCell(getStaffName(r.staffId))} | ${mdCell(r.type)} | ${mdCell(shiftStatusLabel(r.status))} |`
      );
    });
  lines.push('');

  return lines.join('\n');
}
