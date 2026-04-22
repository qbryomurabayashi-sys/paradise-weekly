import { create } from 'zustand';

export interface Reaction {
  type: string;
  count: number;
  userIds: string[];
}

export interface Report {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: '店長' | 'AM' | 'BM';
  storeName: string;
  weekNumber: number;
  year: number;
  keep: string;
  problem_gap: string;
  problem_ideal: string;
  try_who: string;
  try_when: string;
  try_what: string;
  try_why: string;
  reactions: Reaction[];
  commentCount: number;
  createdAt: string;
}

interface ReportState {
  reports: Report[];
  filterRole: string | null;
  setFilterRole: (role: string | null) => void;
  addReport: (report: Omit<Report, 'id' | 'reactions' | 'commentCount' | 'createdAt'>) => void;
}

const MOCK_REPORTS: Report[] = [
  {
    id: '1',
    authorId: 'u1',
    authorName: '佐藤 拓海',
    authorRole: '店長',
    storeName: '渋谷パームツリー店',
    weekNumber: 15,
    year: 2026,
    keep: '朝の挨拶をハイタッチに変えたところ、チームの活気が20%向上しました！',
    problem_gap: 'ランチピーク時の提供スピードが目標より3分遅い。',
    problem_ideal: '全員が連携し、5分以内に全メニューを提供できている状態。',
    try_who: 'キッチンスタッフ全員',
    try_when: '来週のランチタイム',
    try_what: '事前準備（プレップ）のチェックリスト導入',
    try_why: '準備不足によるボトルネックを解消するため',
    reactions: [
      { type: 'like', count: 5, userIds: ['u2'] },
      { type: 'learn', count: 3, userIds: ['u3'] }
    ],
    commentCount: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    authorId: 'u2',
    authorName: '田中 美咲',
    authorRole: 'AM',
    storeName: '東京エリア',
    weekNumber: 15,
    year: 2026,
    keep: '新人のOJTフローを動画マニュアル化したことで、教える側の負担が大幅に減りました。',
    problem_gap: '店舗間での成功事例の共有が月1回の会議のみで、スピード感に欠ける。',
    problem_ideal: '日々、全店長が他店の成功事例を自店に即時取り入れられる環境。',
    try_who: '全店長・AM',
    try_when: '今週から毎日',
    try_what: 'Paradise Reportsでの積極的な発信とリアクション',
    try_why: '情報の民主化とポジティブな文化醸成のため',
    reactions: [
      { type: 'great', count: 8, userIds: ['u1', 'u3'] },
      { type: 'copy', count: 4, userIds: ['u4'] }
    ],
    commentCount: 5,
    createdAt: new Date().toISOString(),
  }
];

export const useReportStore = create<ReportState>((set) => ({
  reports: MOCK_REPORTS,
  filterRole: null,
  setFilterRole: (role) => set({ filterRole: role }),
  addReport: (reportData) => set((state) => ({
    reports: [
      {
        ...reportData,
        id: Math.random().toString(36).substr(2, 9),
        reactions: [],
        commentCount: 0,
        createdAt: new Date().toISOString(),
      },
      ...state.reports,
    ]
  })),
}));
