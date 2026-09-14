import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserRound, Info } from 'lucide-react';
import { formatStaffName, displayRole, abbreviateStoreName } from '../../lib/formatUtils';

/**
 * 「誰がやったか」を一覧で見せるボトムシート。
 * スマホ（iPhone）では title 属性のツールチップが出ないため、
 * いいね実施者・閲覧者（足跡）はタップで開くこの面で見せる。
 */

export type Person = {
  uid: string;
  name: string;
  role?: string;
  storeName?: string;
  photoURL?: string;
  /** 閲覧時刻など（分かる場合のみ）。ISO文字列 / epoch秒 / epochミリ秒 を許容 */
  at?: string | number | null;
};

export type PeopleSection = {
  key: string;
  label: string;
  /** 見出し左のアイコン（絵文字ではなくlucideを渡す） */
  icon?: React.ReactNode;
  people: Person[];
};

/** 閲覧時刻の表示（分からない場合は空文字） */
export function formatSeenAt(at: string | number | null | undefined): string {
  if (at === null || at === undefined || at === '') return '';
  let ms: number;
  if (typeof at === 'number') {
    // 10桁なら秒、13桁ならミリ秒として扱う
    ms = at < 1e12 ? at * 1000 : at;
  } else {
    ms = new Date(at).getTime();
  }
  if (!ms || isNaN(ms)) return '';
  return new Date(ms).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const Row = ({ person }: { person: Person }) => {
  const at = formatSeenAt(person.at);
  return (
    <li className="flex items-center gap-2.5 min-h-[44px] py-2 border-b border-line last:border-b-0">
      <span className="w-9 h-9 shrink-0 rounded-xl bg-canvas border border-line grid place-items-center overflow-hidden text-ink-soft">
        {person.photoURL ? (
          <img src={person.photoURL} alt="" className="w-full h-full object-cover" />
        ) : (
          <UserRound size={16} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-black text-ink truncate">{formatStaffName(person.name)}</span>
          {person.role && (
            <span className="text-xs font-black text-white bg-qb-blue px-1.5 py-0.5 rounded shrink-0">
              {displayRole(person.role)}
            </span>
          )}
        </span>
        {person.storeName && (
          <span className="block text-xs font-bold text-ink-soft truncate">
            {abbreviateStoreName(person.storeName)}
          </span>
        )}
      </span>
      {at && <span className="text-xs font-bold text-qb-gray tabular shrink-0">{at}</span>}
    </li>
  );
};

export const PeopleSheet = ({
  open,
  onClose,
  title,
  subtitle,
  notice,
  sections,
  emptyText = 'まだ誰もいません',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  notice?: string;
  sections: PeopleSection[];
  emptyText?: string;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const visible = sections.filter((s) => s.people.length > 0);
  const total = visible.reduce((sum, s) => sum + s.people.length, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 40, opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl border border-line flex flex-col max-h-[82vh] max-h-[82dvh] overflow-hidden"
          >
            {/* ヘッダー */}
            <div className="flex items-start gap-2 px-4 pt-4 pb-3 border-b border-line shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-ink flex items-center gap-1.5">
                  {title}
                  <span className="text-xs font-black text-ink-soft bg-canvas border border-line px-1.5 py-0.5 rounded-full tabular">
                    {total}人
                  </span>
                </h3>
                {subtitle && <p className="text-xs font-bold text-ink-soft mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="閉じる"
                className="tap grid place-items-center rounded-xl bg-canvas border border-line text-ink-soft hover:text-ink shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* 本体 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 overscroll-contain">
              {visible.length === 0 ? (
                <p className="text-center text-sm font-bold text-ink-soft py-10">{emptyText}</p>
              ) : (
                <div className="space-y-4">
                  {visible.map((s) => (
                    <section key={s.key}>
                      <h4 className="text-xs font-black text-ink-soft flex items-center gap-1.5 mb-1">
                        {s.icon}
                        {s.label}
                        <span className="tabular text-qb-gray">{s.people.length}</span>
                      </h4>
                      <ul>
                        {s.people.map((p) => (
                          <Row key={s.key + '-' + p.uid} person={p} />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {/* 注記 */}
            {notice && (
              <div className="shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 border-t border-line">
                <p className="text-xs font-bold text-ink-soft bg-canvas border border-line rounded-xl px-3 py-2 flex items-start gap-1.5">
                  <Info size={14} className="shrink-0 mt-0.5 text-qb-blue" />
                  <span>{notice}</span>
                </p>
              </div>
            )}
            {!notice && <div className="shrink-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))]" />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
