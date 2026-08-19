import { differenceInCalendarWeeks } from 'date-fns';

export const getFiscalWeek = (date: Date) => {
  const fiscalYear = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  const startOfFiscalYear = new Date(fiscalYear, 6, 1); // July 1st
  return differenceInCalendarWeeks(date, startOfFiscalYear, { weekStartsOn: 1 }) + 1;
};

// KPTの内容フィールド全部（keep/problem_gap/problem_ideal/try_who/try_when/try_what/try_why）を
// 空白正規化して U+0001 区切りで連結。完全一致判定キーに使う。
// PostReport の重複警告と useReportStore の内容重複畳み込みで同一ロジックを共有する。
// 区切りはソース上は可読な \u0001 エスケープで表記（実行値は char code 1）。
// 空文字連結だと項目境界をまたいで誤一致する恐れがあるためこの区切りを維持。
export function normalizeKptContent(r: {
  keep?: any;
  problem_gap?: any;
  problem_ideal?: any;
  try_who?: any;
  try_when?: any;
  try_what?: any;
  try_why?: any;
}): string {
  return [r.keep, r.problem_gap, r.problem_ideal, r.try_who, r.try_when, r.try_what, r.try_why]
    .map((v) => String(v ?? '').trim().replace(/\s+/g, ' '))
    .join('\u0001');
}
