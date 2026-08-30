import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { auth, db } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import Markdown from 'react-markdown';
import { useReportStore, getTimestampMillis } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { MessageCircle, ThumbsUp, Lightbulb, Rocket, Stars, Sparkles, ChevronRight, ChevronDown, ChevronUp, Megaphone, Check, X, Calendar, Users, Trophy, Star, TrendingUp, FileSpreadsheet, Loader2, AlertTriangle, Info } from 'lucide-react';
import { useAnnouncementStore } from '../store/useAnnouncementStore';
import { useShiftStore } from '../store/useShiftStore';
import { useStoreMetricsStore } from '../store/useStoreMetricsStore';
import { useUsersStore } from '../store/useUsersStore';
import { useLeavePlanStore } from '../store/useLeavePlanStore';
import { format, addMonths } from 'date-fns';
import { ShiftShortagesAccordion } from '../components/ui/ShiftShortagesAccordion';
import { RatingStars } from '../components/ui/Indicators';
import { displayRole, formatStaffName, abbreviateStoreName } from '../lib/formatUtils';
import { isPubliclyVisibleReport } from '../lib/reportPermissions';
import { getFiscalWeek } from '../lib/dateUtils';

let _globalTasksUnsub: any = null;
let _cachedTasks: any[] = [];
let _globalKeyPassUnsub: any = null;
let _cachedKeyPasses: any[] = [];

export const MainBoard = () => {
  const { reports, filterRole, setFilterRole, init: initReports } = useReportStore();
  const { user, viewMode, setViewMode } = useAuthStore();
  const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;
  const { users, init: initUsers } = useUsersStore();
  const { announcements, markAsSeen, hideAnnouncement, init: initAnnounce, deleteAnnouncement } = useAnnouncementStore();
  const { staffs, initStaffs, stores, initStores } = useShiftStore();
  const { metrics, subscribe: subscribeMetrics } = useStoreMetricsStore();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [sessionHiddenAnns, setSessionHiddenAnns] = useState<string[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveTab, setArchiveTab] = useState<'normal' | 'shortage'>('normal');
  const [calendarTasks, setCalendarTasks] = useState<any[]>([]);
  const [isInterviewAccordionOpen, setIsInterviewAccordionOpen] = useState(false);
  const navigate = useNavigate();

  // Excel出力（AM・店長の週次報告）用のインライン通知トースト・進行中フラグ
  const [exportToast, setExportToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  useEffect(() => {
    if (!exportToast) return;
    const t = setTimeout(() => setExportToast(null), 3200);
    return () => clearTimeout(t);
  }, [exportToast]);
  const [isExporting, setIsExporting] = useState(false);

  const isBM = user?.role === 'BM';
  const isAM = user?.role === 'AM';
  const simulatedIsBM = activeRole === 'BM';
  const simulatedIsAM = activeRole === 'AM';
  const canAnnounce = activeRole === 'BM' || activeRole === 'AM';

  const currentMonth = new Date().getMonth() + 1;
  const appraisalInterviews: Record<number, string> = {
    7: '第4四半期評価',
    10: '第1四半期評価',
    1: '第2四半期評価',
    4: '第3四半期評価'
  };
  const quarterlyInterviews: Record<number, string> = {
    9: '第1四半期面談',
    12: '第2四半期面談',
    3: '第3四半期面談',
    6: '第4四半期面談'
  };

  const currentAppraisal = appraisalInterviews[currentMonth];
  const currentQuarterly = quarterlyInterviews[currentMonth];
  const hasInterviewThisMonth = !!currentAppraisal || !!currentQuarterly;

  const { leavePlans, initLeavePlans } = useLeavePlanStore();
  const [keyPassRecords, setKeyPassRecords] = useState<any[]>([]);

  useEffect(() => {
    initAnnounce();
    initReports();
    
    // Only fetch heavy administrative data if user is a manager or above to save Firestore Quota
    const isManagerRole = user?.role === 'BM' || user?.role === 'AM' || user?.role === '店長';
    
    if (isManagerRole) {
      initStaffs();
      initStores();
      subscribeMetrics();
      initUsers();
      
      const today = new Date();
      const targetMonthDate = today.getDate() >= 20 ? addMonths(today, 2) : addMonths(today, 1);
      const targetMonthStr = format(targetMonthDate, 'yyyy-MM');
      initLeavePlans(targetMonthStr);

      if (!_globalKeyPassUnsub) {
        _globalKeyPassUnsub = true; // Use boolean flag to prevent repeated fetching
        const loadKeyPasses = async () => {
          try {
            const { getDocs } = await import('firebase/firestore');
            const q = query(collection(db, 'key_passes'), limit(500));
            const snapshot = await getDocs(q);
            const data: any[] = [];
            snapshot.forEach(doc => {
              data.push({ id: doc.id, ...doc.data() });
            });
            _cachedKeyPasses = data;
            setKeyPassRecords(_cachedKeyPasses);
          } catch (error: any) {
            if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
              document.dispatchEvent(new CustomEvent('quota-exceeded'));
            } else {
              console.error("Key passes fetch error:", error);
            }
          }
        };
        loadKeyPasses();
      } else {
        setKeyPassRecords(_cachedKeyPasses);
      }
    }

    // Fetch upcoming tasks for reminders
    if (!_globalTasksUnsub) {
      _globalTasksUnsub = true;
      const loadTasks = async () => {
        try {
          const { getDocs } = await import('firebase/firestore');
          const qTasks = query(collection(db, 'tasks'), orderBy('date', 'asc'), limit(100));
          const snap = await getDocs(qTasks);
          _cachedTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setCalendarTasks(_cachedTasks);
        } catch (error: any) {
          if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
            document.dispatchEvent(new CustomEvent('quota-exceeded'));
          } else {
            console.error("Tasks fetch error:", error);
          }
        }
      };
      loadTasks();
    } else {
      setCalendarTasks(_cachedTasks);
    }

    return () => {};
  }, [initAnnounce, initReports, initStaffs, initStores, subscribeMetrics, initUsers, initLeavePlans, user?.role]);

  // mixedStaffs for evaluating alert status
  const mixedStaffs = React.useMemo(() => {
    if (!stores.length) return staffs;
    const userStaffs = users.filter((u: any) => u.role !== 'BM').map(u => {
      const store = stores.find((s: any) => s.name === u.storeName);
      return {
        id: `user_${u.uid}`,
        storeId: store ? store.id : 'unassigned',
        employmentType: 'fulltime',
        lastName: u.name,
        firstName: '',
        isUser: true,
        role: u.role
      };
    }).filter(u => {
      const nativeExists = staffs.some(s => (s.lastName + (s.firstName || '')).replace(/\s/g, '') === u.lastName.replace(/\s/g, ''));
      return !nativeExists;
    });
    return [...staffs, ...userStaffs];
  }, [staffs, users, stores]);

  const keyPassAlertDetails = React.useMemo(() => {
    const today = new Date();
    const storeNamesMap = new Map<string, Set<string>>();

    mixedStaffs.forEach(staff => {
      const record = keyPassRecords.find(r => r.id === staff.id);
      // 写真・現物確認の対象は鍵・入館証のみ（金庫番号・ポスト番号は確認不要）
      const checkable = (record?.possessions || []).filter((p: any) => p.type === 'key' || p.type === 'pass');
      if (checkable.length === 0) return;

      const isUnchecked = checkable.some((p: any) => {
         if (!p.lastCheckedAt) return true;
         const checkedDate = new Date(p.lastCheckedAt);

         const isThisMonth = checkedDate.getMonth() === today.getMonth() && checkedDate.getFullYear() === today.getFullYear();
         if (isThisMonth) return false;

         const msPerDay = 1000 * 60 * 60 * 24;
         const diffDays = (today.getTime() - checkedDate.getTime()) / msPerDay;

         // 1か月（約31日）以上更新されていない場合
         if (diffDays >= 31) return true;

         // 15日を過ぎても当月分の確認がされていない場合
         if (today.getDate() > 15) return true;

         return false;
      });

      if (isUnchecked && staff.storeId) {
        if (!storeNamesMap.has(staff.storeId)) storeNamesMap.set(staff.storeId, new Set());
        storeNamesMap.get(staff.storeId)!.add(formatStaffName(`${staff.lastName} ${staff.firstName}`));
      }
    });

    return Array.from(storeNamesMap.entries())
      .map(([id, names]) => ({ storeName: stores.find(s => s.id === id)?.name || '', names: Array.from(names) }))
      .filter(d => !!d.storeName);
  }, [keyPassRecords, mixedStaffs, stores]);

  const leavePlanAlertStores = React.useMemo(() => {
    const today = new Date();

    const targetMonthDate = today.getDate() >= 20 ? addMonths(today, 2) : addMonths(today, 1);
    const targetMonthStr = format(targetMonthDate, 'yyyy-MM');
    const alertStoresList: string[] = [];

    stores.forEach(store => {
      const storeStaffs = mixedStaffs.filter(s => s.storeId === store.id);
      if (storeStaffs.length === 0) return;

      const unsubmittedStaffs = storeStaffs.filter(staff => {
        const plan = leavePlans.find(lp => lp.staffId === idToPlanStaffId(staff.id) && lp.targetMonth === targetMonthStr);
        return !plan;
      });

      if (unsubmittedStaffs.length === storeStaffs.length) {
        alertStoresList.push(store.name);
      }
    });

    return alertStoresList;
  }, [leavePlans, mixedStaffs, stores]);

  function idToPlanStaffId(id: string): string {
    // leave_plans user ids usually don't have user_ prefix or they matches staffId
    return id;
  }

  // 店長の自店舗を特定するヘルパー。user.storeName と stores の name の表記ゆれ
  // （前後の空白・正式名称/略称の食い違い）を吸収するため、まず trim 一致、
  // ダメなら略称同一性でフォールバック一致させる。
  //
  // 【注意】abbreviateStoreName（src/lib/formatUtils.ts）によるフォールバック一致は、
  // 現状の11店舗では「サミット」「ヨークフーズ」「コースカ」等の汎用キーワードが
  // それぞれ1店舗にしか対応していないため安全に機能している。しかし将来店舗が追加され、
  // これらと同じ汎用キーワードを含む別の店舗が増えた場合、stores.find() が意図しない
  // 店舗にマッチしてしまうリスクがある。店舗追加時は abbreviateStoreName の判定分岐と
  // 併せて見直すこと。
  const findMyStore = React.useCallback(() => {
    const myStoreName = user?.storeName?.trim();
    if (!myStoreName) return undefined;
    return stores.find(s =>
      s.name.trim() === myStoreName || abbreviateStoreName(s.name) === abbreviateStoreName(myStoreName)
    );
  }, [stores, user?.storeName]);

  const filteredKeyPassAlertStores = React.useMemo(() => {
    if (activeRole === '店長') {
      const myStore = findMyStore();
      // BM自身が権限シミュレーターで店長視点を確認する場合、BMには実店舗が無く
      // myStoreが必ず未特定になる。その場合だけ「確認用」に全店舗分を表示する
      // （実際の店長ユーザーで店舗が特定できない場合は、データ不整合の可能性があるため
      //  そのまま空表示にして気付けるようにする）。
      if (!myStore) return isBM ? keyPassAlertDetails : [];
      return keyPassAlertDetails.filter(d => d.storeName === myStore.name);
    }
    return keyPassAlertDetails;
  }, [keyPassAlertDetails, activeRole, findMyStore, isBM]);

  const filteredLeavePlanAlertStores = React.useMemo(() => {
    if (activeRole === '店長') {
      const myStore = findMyStore();
      if (!myStore) return isBM ? leavePlanAlertStores : [];
      return leavePlanAlertStores.includes(myStore.name) ? [myStore.name] : [];
    }
    return leavePlanAlertStores;
  }, [leavePlanAlertStores, activeRole, findMyStore, isBM]);

  // ランキング計算
  const { topTurnover, topGoogle } = React.useMemo(() => {
    if (stores.length === 0 || metrics.length === 0) return { topTurnover: null, topGoogle: null };

    const today = new Date();
    // 先月
    const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const turnoverRanking = stores.map(store => {
      const metric = metrics.find(m => m.storeId === store.id && m.yearMonth === prevMonthStr);
      if (!metric || !metric.monthlyWorkingStaff || !metric.totalCustomers) {
        return { store, rate: 0, text: '-' };
      }
      const rate = metric.totalCustomers / metric.monthlyWorkingStaff;
      return { store, rate, text: rate.toFixed(1) + ' 人' };
    }).sort((a, b) => b.rate - a.rate);

    const googleRanking = stores.map(store => {
      const metric = metrics.find(m => m.storeId === store.id && m.yearMonth === prevMonthStr);
      if (!metric || !metric.googleReviewCurrent) {
        return { store, rate: 0, text: '-' };
      }
      return { store, rate: metric.googleReviewCurrent, text: metric.googleReviewCurrent.toFixed(1) };
    }).sort((a, b) => b.rate - a.rate);

    return {
      topTurnover: turnoverRanking[0]?.rate > 0 ? { ...turnoverRanking[0], monthStr: `${prevDate.getMonth() + 1}月` } : null,
      topGoogle: googleRanking[0]?.rate > 0 ? { ...googleRanking[0], monthStr: `${prevDate.getMonth() + 1}月` } : null,
    };
  }, [stores, metrics]);

  // 新人フォローアップ面談の対象者を取得する関数
  const getFollowUpInterviewStaffs = () => {
    const today = new Date();
    
    // ユーザーの権限に応じて表示するスタッフをフィルタリング
    // 店長は自店舗のみに絞る。AM・BMは既存仕様どおり全店舗分を見られる（絞り込みなし）。
    let visibleStores = stores;
    if (activeRole === '店長') {
      const myStore = findMyStore();
      // BMが権限シミュレーターで店長視点を確認する場合は全店舗分（確認用フォールバック）
      visibleStores = myStore ? [myStore] : (isBM ? stores : []);
    }
    const storeIds = visibleStores.map(s => s.id);

    return staffs.filter(staff => {
      // 閲覧権限がない店舗のスタッフは除外
      if (!storeIds.includes(staff.storeId)) return false;

      const baseDateStr = (staff.isLogisGrad && staff.assignedDate) ? staff.assignedDate : staff.joinedDate;
      if (!baseDateStr) return false;

      const baseDate = new Date(baseDateStr);
      const monthsDiff = (today.getFullYear() - baseDate.getFullYear()) * 12 + (today.getMonth() - baseDate.getMonth());

      // 入社・配属から1, 2, 3ヶ月目、以降は3ヶ月ごと（6, 9, 12）で終了
      if (monthsDiff === 1 || monthsDiff === 2 || monthsDiff === 3) return true;
      if (monthsDiff > 3 && monthsDiff <= 12 && monthsDiff % 3 === 0) return true;

      return false;
    }).map(staff => {
      const baseDateStr = (staff.isLogisGrad && staff.assignedDate) ? staff.assignedDate : staff.joinedDate;
      const baseDate = new Date(baseDateStr!);
      const monthsDiff = (today.getFullYear() - baseDate.getFullYear()) * 12 + (today.getMonth() - baseDate.getMonth());

      return {
        ...staff,
        monthsDiff,
        storeName: stores.find(s => s.id === staff.storeId)?.name || '不明な店舗'
      };
    }).sort((a, b) => a.monthsDiff - b.monthsDiff);
  };

  const followUpStaffs = getFollowUpInterviewStaffs();
  
  const isShortageAnn = (ann: any) => ann.title.includes('不足') || ann.title.includes('急募') || ann.title.includes('シフト調整のお願い');

  const activeAnnouncements = announcements.filter(a => {
    const uid = user?.uid || '';
    if (isShortageAnn(a)) return false;
    return !a.hiddenBy?.includes(uid) && !a.seenBy?.includes(uid) && !sessionHiddenAnns.includes(a.id);
  });

  // 閲覧モードの決定（上部で定義済み）

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // 親のクリックイベント（詳細へ遷移）を防ぐ
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getReactionIcon = (type: string, size = 14) => {
    switch (type) {
      case 'like': return <ThumbsUp size={size} className="text-paradise-sunset" />;
      case 'learn': return <Lightbulb size={size} className="text-yellow-500" />;
      case 'copy': return <Rocket size={size} className="text-purple-500" />;
      case 'great': return <Stars size={size} className="text-pink-500" />;
      case 'best_kpt': return <Trophy size={size} className="text-cyan-500" />;
      case 'best_kpt_am': return <Trophy size={size} className="text-blue-500" />;
      case 'best_kpt_sm': return <Trophy size={size} className="text-purple-500" />;
      default: return <ThumbsUp size={size} />;
    }
  };

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${y}年${m}月${d}日 ${h}:${min}:${s}`;
  };

  const getActiveReminders = (now: Date) => {
    const reminders = [];
    const dayOfWeek = now.getDay();
    const hours = now.getHours();
    const date = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    if (dayOfWeek === 6 || (dayOfWeek === 0 && hours < 18)) {
      reminders.push({ id: 'weekly', title: '週次報告', time: '日曜日 18:00まで', icon: '📝' });
    }
    if (date === 14 || (date === 15 && hours < 18)) {
      reminders.push({ id: 'keypass', title: '鍵・入証の所持確認', time: '15日 18:00まで', icon: '🔑' });
      reminders.push({ id: 'shift', title: 'シフトの提出', time: '15日 18:00まで', icon: '📅' });
    }
    if (date === lastDayOfMonth - 1 || (date === lastDayOfMonth && hours < 18)) {
      reminders.push({ id: 'leaveplan', title: '有休・公出などの予定数提出', time: '月末日 18:00まで', icon: '🏖️' });
    }

    // Add calendar task alerts for tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    
    // Also include today's tasks as a reminder
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    calendarTasks.forEach(task => {
      // Check if task is assigned to the current user
      const isAssigned = task.assignees?.some((a: any) => a.uid === user?.uid);
      if (isAssigned) {
        if (task.date === tomorrowStr) {
          reminders.push({ id: `task-${task.id}`, title: `【明日】${task.title}`, time: tomorrowStr, icon: '💡' });
        } else if (task.date === todayStr) {
          reminders.push({ id: `task-${task.id}`, title: `【本日】${task.title}`, time: todayStr, icon: '💡' });
        }
      }
    });

    return reminders;
  };

  const activeReminders = getActiveReminders(currentTime);
  const activeReminderIds = activeReminders.map(r => r.id).sort().join(',');

  const [showReminderPopup, setShowReminderPopup] = useState(() => {
    return sessionStorage.getItem('reminder_dismissed_ids') !== activeReminderIds;
  });

  useEffect(() => {
    // If reminders changed and are not the ones dismissed, show popup again
    if (sessionStorage.getItem('reminder_dismissed_ids') !== activeReminderIds && activeReminders.length > 0) {
      setShowReminderPopup(true);
    }
  }, [activeReminderIds, activeReminders.length]);

  const dismissReminder = () => {
    sessionStorage.setItem('reminder_dismissed_ids', activeReminderIds);
    setShowReminderPopup(false);
  };

  // Available months initialization
  const availableMonths = React.useMemo(() => {
    const months = new Set<string>();
    reports.forEach(r => {
      const d = new Date(r.createdAt);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    const sorted = Array.from(months).sort().reverse();
    // 常に現在の月がない場合は追加しておく（レポートがゼロでも当月は出したい場合があるため）
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!sorted.includes(currentMonthStr)) {
        sorted.unshift(currentMonthStr);
        sorted.sort().reverse();
    }
    return sorted;
  }, [reports]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const d = new Date();
     return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calculate grouped and filtered reports
  const displayReports = React.useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const currentUid = user?.uid || (user as any)?.id || null;
    return reports.filter(r => {
      const d = new Date(r.createdAt);
      return d.getFullYear().toString() === year && String(d.getMonth() + 1).padStart(2, '0') === month;
    }).filter(r => {
       // 公開可否（閲覧ロール＋未公開の除外）を共通述語に集約。ナビ対象と集合を一致させる
       if (!isPubliclyVisibleReport(r, activeRole, currentUid)) return false;
       // 役割によるフィルター（MainBoard固有UI）
       if (filterRole && r.authorRole !== filterRole) return false;
       return true;
    });
  }, [reports, selectedMonth, filterRole, activeRole, user]);

  // Excel出力用：HTML文字列で保存されているフィールド(keep/problem_gap/problem_ideal)からタグを除去する。
  // try_who等のプレーンテキスト項目には適用しない（誤ってHTML解釈されて内容が欠落する事故を避けるため）。
  const stripHtml = (html?: string): string => {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').trim();
  };

  // BM・AM限定：選択中の月（selectedMonth）のAM・店長の週次報告をExcel(.xlsx)としてダウンロードする。
  // 表示制御（ボタン非表示）だけに頼らず、実行時にも権限を再チェックする。
  const handleExportExcel = async () => {
    if (!(activeRole === 'BM' || activeRole === 'AM')) return;
    if (isExporting) return;
    setIsExporting(true);
    try {
      const [yearStr, monthStr] = selectedMonth.split('-');
      // 注意：firestore.rules 上、AMがreportsコレクションをlistするには
      // クエリのwhere('authorRole','in',[...])がルールの許可集合(['店長','AM'])と完全一致していないと
      // 全体がpermission-deniedになる（reports/{reportId}のlistルール参照）。そのため必ずこの2つのwhereだけで
      // クエリし、月の絞り込みはFirestore側では行わずクライアント側で行う。
      const q = query(
        collection(db, 'reports'),
        where('year', '==', Number(yearStr)),
        where('authorRole', 'in', ['店長', 'AM'])
      );
      const snapshot = await getDocs(q);
      const currentUid = user?.uid || (user as any)?.id || null;

      let rows = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(r => {
          const d = new Date(getTimestampMillis(r.createdAt));
          return String(d.getMonth() + 1).padStart(2, '0') === monthStr;
        })
        .filter(r => isPubliclyVisibleReport(r, activeRole, currentUid));

      if (rows.length === 0) {
        setExportToast({ msg: `${yearStr}年${parseInt(monthStr)}月分のAM・店長の週次報告が見つかりませんでした。`, type: 'info' });
        setIsExporting(false);
        return;
      }

      // 保存済みのweekNumberを無条件に信頼せず、投稿日から週番号を再計算する
      // （useReportStore.tsのinit()と同様の補正。画面表示とのズレを防ぎ、公式資料としての正確性を優先する）
      rows = rows.map(r => ({
        ...r,
        weekNumber: getFiscalWeek(new Date(getTimestampMillis(r.createdAt)))
      }));

      rows.sort((a, b) => (a.weekNumber - b.weekNumber) || (getTimestampMillis(a.createdAt) - getTimestampMillis(b.createdAt)));

      const XLSX = await import('xlsx');

      const sheetRows = rows.map(r => ({
        '週番号': r.weekNumber,
        '投稿日': new Date(getTimestampMillis(r.createdAt)).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        '店舗名': r.storeName || '',
        '氏名': formatStaffName(r.authorName),
        '役職': r.authorRole,
        'Keep': stripHtml(r.keep),
        'Problem(GAP)': stripHtml(r.problem_gap),
        'Problem(本来あるべき姿)': stripHtml(r.problem_ideal),
        'Try(誰が)': r.try_who || '',
        'Try(いつ)': r.try_when || '',
        'Try(何を)': r.try_what || '',
        'Try(なぜ)': r.try_why || '',
        'MVPスタッフ': r.mvpStaffName ? formatStaffName(r.mvpStaffName) : '',
        'MVP詳細': r.mvpDetail || '',
        '不安スタッフ': r.concernStaffName ? formatStaffName(r.concernStaffName) : '',
        '不安詳細': r.concernDetail || ''
      }));

      const ws = XLSX.utils.json_to_sheet(sheetRows);
      ws['!cols'] = [
        { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 },
        { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 16 },
        { wch: 40 }, { wch: 24 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 30 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '週次報告');
      XLSX.writeFile(wb, `週次報告_${yearStr}年${parseInt(monthStr)}月_AM店長.xlsx`);
      setExportToast({ msg: `${rows.length}件をExcelに出力しました。`, type: 'success' });
    } catch (e) {
      console.error('Excel export error:', e);
      setExportToast({ msg: 'Excel出力に失敗しました。', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  // Group by week
  const groupedByWeek = React.useMemo(() => {
    const groups: { [week: number]: typeof reports } = {};
    displayReports.forEach(r => {
       if (!groups[r.weekNumber]) {
          groups[r.weekNumber] = [];
       }
       groups[r.weekNumber].push(r);
    });
    return groups;
  }, [displayReports]);

  return (
    <div className="pb-24 max-w-4xl mx-auto">
      {/* Excel出力のインライン通知トースト */}
      <AnimatePresence>
        {exportToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[130] w-[92%] max-w-sm"
          >
            <div className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-xl border text-sm font-bold ${
              exportToast.type === 'success' ? 'bg-white border-success/30 text-ink'
              : exportToast.type === 'error' ? 'bg-white border-danger/30 text-ink'
              : 'bg-white border-qb-blue/30 text-ink'
            }`}>
              <span className={`grid place-items-center h-7 w-7 shrink-0 rounded-full text-white ${
                exportToast.type === 'success' ? 'bg-success' : exportToast.type === 'error' ? 'bg-danger' : 'bg-qb-blue'
              }`}>
                {exportToast.type === 'success' ? <Check size={16} /> : exportToast.type === 'error' ? <AlertTriangle size={16} /> : <Info size={16} />}
              </span>
              <span className="flex-1 leading-snug">{exportToast.msg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center mb-6">
        <span className="inline-block bg-white/70 backdrop-blur-md px-6 py-2 rounded-full shadow-sm border border-white/50 text-gray-700 font-bold tracking-wider">
          {formatDate(currentTime)}
        </span>
        {activeReminders.length > 0 && (
          <div className="mt-4 flex flex-col items-center gap-2">
            {activeReminders.map(rem => (
              <div key={rem.id} className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm animate-pulse">
                <span>{rem.icon}</span>
                <span>{rem.title}の期限が迫っています ({rem.time})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ランキング殿堂入り（先月） */}
      {(topTurnover || topGoogle) && (
        <div className="mb-4 px-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topTurnover && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-[1.5px] shadow-sm relative overflow-hidden cursor-default"
                style={{ background: 'linear-gradient(135deg,#F4D03F,#E8B923)' }}
              >
                <div className="relative bg-white rounded-[14px] py-2.5 px-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="grid place-items-center h-8 w-8 shrink-0 rounded-xl" style={{ background: '#E8B923' }}>
                      <Trophy className="text-white" size={16} />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-ink-soft leading-tight">{topTurnover.monthStr} 1人工あたり客数 No.1</span>
                      <span className="block text-sm font-black text-ink truncate">{topTurnover.store.name}</span>
                    </div>
                  </div>
                  <span className="tabular shrink-0 text-sm font-black text-white px-2.5 py-1 rounded-lg" style={{ background: '#E8B923' }}>{topTurnover.text}</span>
                </div>
              </motion.div>
            )}

            {topGoogle && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl p-[1.5px] shadow-sm relative overflow-hidden cursor-default bg-gradient-to-r from-qb-blue to-qb-cyan"
              >
                <div className="relative bg-white rounded-[14px] py-2.5 px-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="grid place-items-center h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-qb-blue to-qb-cyan">
                      <Star className="text-white fill-white" size={16} />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-ink-soft leading-tight">{topGoogle.monthStr} 口コミ No.1</span>
                      <span className="block text-sm font-black text-ink truncate">{topGoogle.store.name}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <RatingStars value={topGoogle.rate} size={13} />
                    <span className="tabular text-xs font-black text-qb-blue">{topGoogle.text}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* 警告・通知セクション (コンパクト・省スペース設計) */}
      {(filteredKeyPassAlertStores.length > 0 || filteredLeavePlanAlertStores.length > 0) && (
        <div className="mb-4 px-2 space-y-2 max-w-xl mx-auto">
          {filteredKeyPassAlertStores.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-800 rounded-xl p-2.5 shadow-sm flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="p-1 bg-red-100 text-red-600 rounded-md shrink-0 text-base">🔑</span>
                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-red-950 block sm:inline-block sm:mr-1">【鍵・入証未確認】</span>
                  <span className="font-bold opacity-95 text-gray-700 truncate block sm:inline">{filteredKeyPassAlertStores.map(d => `${abbreviateStoreName(d.storeName)}(${d.names.join('・')})`).join('、')}</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/key-pass')}
                className="ml-3 px-2 py-1 bg-white hover:bg-red-100 border border-red-200 rounded-lg font-black text-red-700 transition leading-none text-xs shrink-0"
              >
                確認へ
              </button>
            </motion.div>
          )}

          {filteredLeavePlanAlertStores.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50/90 backdrop-blur-sm border border-amber-200 text-amber-800 rounded-xl p-2.5 shadow-sm flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="p-1 bg-amber-100 text-amber-600 rounded-md shrink-0 text-base">🏖️</span>
                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-amber-950 block sm:inline-block sm:mr-1">【予定数未提出】</span>
                  <span className="font-bold opacity-95 text-gray-700 truncate block sm:inline">{filteredLeavePlanAlertStores.map(abbreviateStoreName).join('、')}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  const today = new Date();
                  const targetMonthDate = today.getDate() >= 20 ? addMonths(today, 2) : addMonths(today, 1);
                  navigate(`/leave-plans?month=${format(targetMonthDate, 'yyyy-MM')}`);
                }}
                className="ml-3 px-2 py-1 bg-white hover:bg-amber-100 border border-amber-200 rounded-lg font-black text-amber-700 transition leading-none text-xs shrink-0"
              >
                提出へ
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* 今月の面談・新人フォローアップ（スマホ対応・省スペース・高視認性設計 - アコーディオン開閉式） */}
      {(hasInterviewThisMonth || followUpStaffs.length > 0) && (
        <div id="interview-followup-accordion" className="mb-6 px-2 text-gray-800">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/85 backdrop-blur-md rounded-2xl p-4 border-2 border-white shadow-xl relative overflow-hidden transition-all"
          >
            {/* アコーディオンヘッダー */}
            <div 
              onClick={() => setIsInterviewAccordionOpen(!isInterviewAccordionOpen)}
              className="relative z-10 flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="p-1.5 bg-paradise-ocean/15 text-paradise-ocean rounded-lg shrink-0">
                  <Calendar size={18} />
                </div>
                <h3 className="text-sm font-black text-gray-800 tracking-tight truncate flex items-center gap-1.5 mr-2">
                  <span>面談案内 & 新人フォロー</span>
                  <span className="text-xs text-gray-400 font-normal hidden sm:inline">({currentMonth}月分)</span>
                </h3>

                {/* 閉じている時のサマリーバッジ */}
                {!isInterviewAccordionOpen && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasInterviewThisMonth && (
                      <span className="text-xs font-extrabold text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded-lg">
                        面談あり
                      </span>
                    )}
                    {followUpStaffs.length > 0 && (
                      <span className="text-xs font-extrabold text-pink-700 bg-pink-50 border border-pink-200/60 px-1.5 py-0.5 rounded-lg">
                        新人 {followUpStaffs.length}名
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 開閉矢印アイコン */}
              <div className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100/50 transition-colors shrink-0">
                {isInterviewAccordionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {/* アコーディオンボディ (開閉アニメーション付き) */}
            <AnimatePresence initial={false}>
              {isInterviewAccordionOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="relative z-10 flex flex-col gap-4 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-3">
                    {/* 1. 面談リマインド */}
                    {hasInterviewThisMonth && (
                      <div className="bg-gradient-to-br from-blue-50/50 to-white p-3.5 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-black text-white bg-paradise-ocean px-2 py-0.5 rounded-md uppercase tracking-wider">
                            リマインド
                          </span>
                          <span className="text-xs sm:text-sm font-black text-gray-800">{currentMonth}月の対象面談</span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 font-bold leading-relaxed">
                          今月は
                          {currentAppraisal && <span className="text-paradise-sunset font-extrabold mx-0.5">「評価: {currentAppraisal}」</span>}
                          {currentAppraisal && currentQuarterly && '・'}
                          {currentQuarterly && <span className="text-paradise-ocean font-extrabold mx-0.5">「四半期: {currentQuarterly}」</span>}
                          の対象月です。スケジュールを確認し、進めてください。
                        </p>
                      </div>
                    )}

                    {/* 2. 新人フォローアップ面談 */}
                    {followUpStaffs.length > 0 && (
                      <div className="bg-gradient-to-br from-pink-50/50 to-white p-3.5 rounded-xl border border-pink-100 shadow-sm flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-black text-white bg-pink-500 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            新人フォロー
                          </span>
                          <span className="text-xs sm:text-sm font-black text-gray-800">対象スタッフ</span>
                        </div>
                        <p className="text-xs text-gray-600 font-bold leading-relaxed mb-2">
                          <span className="text-pink-600 font-extrabold">管轄管理者の方は、</span>以下のスタッフと今月フォローアップ面談を実施してください。
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {followUpStaffs.map(staff => (
                            <div key={staff.id} className="bg-pink-50/80 border border-pink-100 text-pink-700 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0">
                              <span className="bg-white px-1.5 py-0.5 rounded-lg text-xs text-pink-500 font-extrabold border border-pink-100/50">{staff.storeName}</span>
                              <span>{formatStaffName(`${staff.lastName} ${staff.firstName}`)}</span>
                              <span className="bg-pink-200 text-pink-800 px-1.5 py-0.5 rounded-lg text-xs font-black">
                                {staff.monthsDiff}ヶ月
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 装飾の背景グラデーションサークル */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-paradise-ocean/5 rounded-full -mr-12 -mt-12 blur-xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/5 rounded-full -ml-12 -mb-12 blur-xl pointer-events-none" />
          </motion.div>
        </div>
      )}

      {/* BM用：視点切り替えトグル (App.tsxでグローバル化したため削除) */}
      
      {/* リマインダーポップアップ */}
      <AnimatePresence>
        {showReminderPopup && activeReminders.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white/95 backdrop-blur-xl p-6 rounded-[2rem] shadow-2xl border-4 border-red-400"
            >
              <div className="flex flex-col items-center text-center gap-2 mb-4">
                <div className="bg-red-100 text-red-500 p-3 rounded-full mb-2 animate-bounce">
                  <Megaphone size={32} />
                </div>
                <h3 className="text-xl font-black text-gray-800">提出期限のお知らせ</h3>
                <p className="text-sm font-bold text-gray-500">以下の項目がもうすぐ提出期限です</p>
              </div>

              <div className="space-y-3 my-6">
                {activeReminders.map(rem => (
                  <div key={rem.id} className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-2xl">{rem.icon}</span>
                    <div className="text-left">
                      <div className="text-sm font-black text-gray-800">{rem.title}</div>
                      <div className="text-xs font-bold text-red-500">{rem.time}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={dismissReminder}
                className="w-full bg-paradise-sunset text-white font-bold py-3 rounded-full shadow-lg hover:shadow-paradise-sunset/50 transition-all active:scale-95"
              >
                確認しました
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* お知らせポップアップ */}
      <AnimatePresence>
        {activeAnnouncements.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-lg bg-white/95 backdrop-blur-xl p-6 rounded-[2rem] shadow-2xl border-4 ${activeAnnouncements[0].isImportant ? 'border-red-400' : 'border-paradise-ocean/50'}`}
            >
              <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                {activeAnnouncements[0].isImportant ? (
                  <div className="bg-red-500 text-white p-2 rounded-xl animate-pulse">
                     <Megaphone size={24} />
                  </div>
                ) : (
                  <div className="bg-paradise-ocean/10 text-paradise-ocean p-2 rounded-xl">
                     <Megaphone size={24} />
                  </div>
                )}
                <div className="flex-1">
                  {activeAnnouncements[0].isImportant && <span className="text-xs font-black text-red-500 bg-red-100 px-2 py-0.5 rounded-full mb-1 inline-block uppercase">重要</span>}
                  <h3 className="text-xl font-black text-gray-800">{activeAnnouncements[0].title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    {users.find(u => u.uid === activeAnnouncements[0].authorId)?.avatarUrl ? (
                      <img src={users.find(u => u.uid === activeAnnouncements[0].authorId)!.avatarUrl} alt="author" className="w-5 h-5 rounded-full object-cover border border-gray-200" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center shrink-0">
                        <Users size={12} className="text-gray-500" />
                      </div>
                    )}
                    <div className="text-xs font-bold text-gray-500">
                      {formatStaffName(activeAnnouncements[0].authorName)} ({displayRole(activeAnnouncements[0].authorRole)})
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-h-[50vh] overflow-y-auto no-scrollbar prose prose-sm max-w-none text-gray-700 bg-white p-4 rounded-xl shadow-inner border border-gray-100 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: activeAnnouncements[0].content }} />

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* 見たよ以外にも直接「今後表示しない」を押せるようにする */}
                <button 
                  onClick={() => {
                    if (user) {
                      hideAnnouncement(activeAnnouncements[0].id, user.uid);
                      setSessionHiddenAnns(prev => [...prev, activeAnnouncements[0].id]);
                    }
                  }}
                  className="text-sm font-bold text-gray-400 hover:text-gray-600 underline underline-offset-2 w-full sm:w-auto text-center order-2 sm:order-1 active:scale-95 transition-transform"
                >
                  今後表示しない
                </button>
                
                <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
                  <button 
                    onClick={() => {
                        if (user) {
                           markAsSeen(activeAnnouncements[0].id, user.uid);
                           setSessionHiddenAnns(prev => [...prev, activeAnnouncements[0].id]);
                        }
                    }}
                    disabled={activeAnnouncements[0].seenBy?.includes(user?.uid || '')}
                    className={`flex-1 sm:flex-none px-6 py-3 rounded-full text-base font-bold flex items-center justify-center gap-2 transition-all ${
                      activeAnnouncements[0].seenBy?.includes(user?.uid || '') 
                        ? 'bg-gray-200 text-gray-500' 
                        : 'bg-paradise-sunset text-white shadow-xl hover:shadow-paradise-sunset/50 active:scale-95'
                    }`}
                  >
                    {activeAnnouncements[0].seenBy?.includes(user?.uid || '') ? <><Check size={16}/> みたよ済</> : '🏝️ みたよ！'}
                  </button>

                  {/* 「みたよ」を押した後、または一時的に閉じたい場合 */}
                  <button 
                    onClick={() => {
                        setSessionHiddenAnns(prev => [...prev, activeAnnouncements[0].id]);
                    }} 
                    className="flex-1 sm:flex-none bg-gray-100 text-gray-600 px-6 py-3 rounded-full text-base font-bold hover:bg-gray-200 transition-colors active:scale-95"
                  >
                    今は閉じる
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* お知らせアーカイブポップアップ */}
      <AnimatePresence>
        {showArchive && (
           <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border-4 border-paradise-ocean/50 flex flex-col max-h-[85vh] overflow-hidden"
            >
               <div className="flex flex-col shrink-0 border-b border-gray-100 bg-white">
                 <div className="flex items-center justify-between p-6 pb-2">
                   <div className="flex flex-col gap-1">
                     <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                       <Megaphone size={24} className="text-paradise-ocean" /> お知らせアーカイブ
                     </h2>
                     <p className="text-xs text-gray-400 font-bold">過去のお知らせや確認済みのお知らせ</p>
                   </div>
                   <button onClick={() => setShowArchive(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 active:scale-95 transition-all">
                     <X size={20} />
                   </button>
                 </div>
                 
                 <div className="flex gap-4 px-6 mt-2">
                   <button 
                     onClick={() => setArchiveTab('normal')}
                     className={`pb-2 font-bold text-sm border-b-2 transition-colors ${archiveTab === 'normal' ? 'border-paradise-ocean text-paradise-ocean' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                   >
                     通常のお知らせ
                   </button>
                   <button 
                     onClick={() => setArchiveTab('shortage')}
                     className={`pb-2 font-bold text-sm border-b-2 transition-colors ${archiveTab === 'shortage' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                   >
                     稼働・シフト過不足
                   </button>
                 </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar bg-gray-50/50">
                 {(() => {
                   const archiveAnns = announcements.filter(a => archiveTab === 'shortage' ? isShortageAnn(a) : !isShortageAnn(a));
                   if (archiveAnns.length === 0) {
                     return <p className="text-center text-gray-400 font-bold py-8">お知らせはありません</p>;
                   }
                   return archiveAnns.map(ann => (
                     <div key={ann.id} className={`bg-white p-5 rounded-2xl border-2 ${ann.isImportant ? 'border-red-200' : 'border-paradise-ocean/20'} shadow-sm relative group`}>
                        <div className="flex items-start justify-between gap-4 mb-3">
                           <div>
                              {ann.isImportant && <span className="text-xs font-black text-red-500 bg-red-100 px-1.5 py-0.5 rounded uppercase mb-1 flex inline-flex items-center w-fit">重要</span>}
                              <h3 className="text-lg font-black text-gray-800">{ann.title}</h3>
                              <div className="flex items-center gap-2 mt-2">
                                {users.find(u => u.uid === ann.authorId)?.avatarUrl ? (
                                  <img src={users.find(u => u.uid === ann.authorId)!.avatarUrl} alt="author" className="w-5 h-5 rounded-full object-cover border border-gray-200" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center shrink-0">
                                    <Users size={12} className="text-gray-500" />
                                  </div>
                                )}
                                <div className="text-xs font-bold text-gray-400 flex flex-wrap gap-x-2 gap-y-1">
                                  <span>{formatStaffName(ann.authorName)} ({displayRole(ann.authorRole)})</span>
                                  <span className="hidden sm:inline">・</span>
                                  <span>{new Date(ann.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                           </div>
                           
                           {/* 投稿者本人の場合は削除ボタンを表示 */}
                           {canAnnounce && ann.authorId === user?.uid && (
                             <button
                               onClick={() => {
                                 deleteAnnouncement(ann.id);
                               }}
                               className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                             >
                               <X size={16} />
                             </button>
                           )}
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-600 bg-gray-50/50 p-4 rounded-xl border border-gray-100 whitespace-pre-wrap text-sm" dangerouslySetInnerHTML={{ __html: ann.content }} />
                     </div>
                   ));
                 })()}
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* フィルタバーとお知らせアーカイブ */}
      <div className="flex items-center justify-between gap-2 mb-8 px-2 overflow-x-auto pb-4 no-scrollbar">
        <div className="flex gap-2 flex-nowrap">
          {['すべて', '店長', 'AM'].filter(role => {
            if (role === 'AM' && activeRole === '店長') return false;
            return true;
          }).map((role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role === 'すべて' ? null : role as any)}
              className={`tap px-6 rounded-full glass transition-all whitespace-nowrap font-bold text-base ${
                (filterRole === role || (role === 'すべて' && !filterRole))
                  ? 'bg-gradient-to-r from-qb-blue to-qb-cyan text-white border-none shadow-lg'
                  : 'text-ink-soft hover:bg-white/60'
              }`}
            >
              {role === '店長' ? 'Ｓ' : role === 'AM' ? 'A' : role}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowArchive(true)}
          className="tap flex items-center gap-2 whitespace-nowrap px-4 rounded-full glass text-qb-blue font-bold text-sm hover:bg-white/60 transition-all border border-qb-blue/30 shadow-sm"
        >
          <Megaphone size={16} /> お知らせ一覧
        </button>
      </div>

      {/* 月変更タブ + Excel出力（BM/AMのみ） */}
      <div className="flex items-center gap-2 mb-6 px-2">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar flex-1 min-w-0">
          {availableMonths.map(month => {
            const [y, m] = month.split('-');
            return (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={`tap px-4 rounded-full border-2 transition-all whitespace-nowrap font-bold text-sm ${
                  selectedMonth === month
                    ? 'border-qb-blue bg-qb-blue/10 text-qb-blue font-black'
                    : 'border-transparent bg-white/50 text-ink-soft hover:bg-white/80'
                }`}
              >
                {y}年{parseInt(m)}月
              </button>
            )
          })}
        </div>
        {(activeRole === 'BM' || activeRole === 'AM') && (
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="tap shrink-0 flex items-center gap-1.5 px-3 rounded-full bg-qb-blue/10 text-qb-blue border border-qb-blue/30 font-black text-sm hover:bg-qb-blue/20 transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            Excel出力
          </button>
        )}
      </div>

      {/* レポートリスト - 月ごと・週ごとのツリー型表示 */}
      <div className="space-y-8 px-2">
         {Object.entries(groupedByWeek as Record<string, any[]>).sort((a, b) => Number(b[0]) - Number(a[0])).map(([weekNum, weekReports]) => {
            const maxAmKpt = Math.max(0, ...weekReports.map(r => r.reactions.find((re: any) => re.type === 'best_kpt_am')?.count || 0));
            const maxSmKpt = Math.max(0, ...weekReports.map(r => r.reactions.find((re: any) => re.type === 'best_kpt_sm')?.count || 0));
            
            return (
            <div key={weekNum} className="space-y-4">
               {/* ツリー型の親（週）の表示 */}
               <div className="flex items-center gap-2 text-paradise-ocean font-black border-b-2 border-paradise-ocean/20 pb-2">
                  <div className="w-6 h-6 rounded-md bg-paradise-ocean/20 flex items-center justify-center text-xs">W</div>
                  <h3 className="text-lg text-gray-700">第 {weekNum} 週</h3>
                  <span className="text-xs bg-paradise-ocean text-white px-2 py-0.5 rounded-full">{weekReports.length} 件</span>
               </div>
               
               <div className="grid gap-4 ml-3 border-l-2 border-paradise-ocean/20 pl-4 py-2 relative">
                 {weekReports.map((report, index) => {
                    const isExpanded = expandedIds.includes(report.id);
                    
                    const hasBestBm = report.reactions.some((r: any) => r.type === 'best_kpt' && r.count > 0);
                    const amCount = report.reactions.find((r: any) => r.type === 'best_kpt_am')?.count || 0;
                    const hasBestAm = maxAmKpt > 0 && amCount === maxAmKpt;
                    const smCount = report.reactions.find((r: any) => r.type === 'best_kpt_sm')?.count || 0;
                    const hasBestSm = maxSmKpt > 0 && smCount === maxSmKpt;
                    
                    const bestType = hasBestBm ? 'BM' : hasBestAm ? 'AM' : hasBestSm ? 'SM' : null;
                    const hasBestKpt = bestType !== null;
                    
                    const cardBg = bestType === 'BM' ? 'bg-gradient-to-br from-cyan-50 to-white border-2 border-cyan-300 shadow-cyan-200/20' 
                                 : bestType === 'AM' ? 'bg-gradient-to-br from-blue-50 to-white border-2 border-blue-300 shadow-blue-200/20'
                                 : bestType === 'SM' ? 'bg-gradient-to-br from-purple-50 to-white border-2 border-purple-300 shadow-purple-200/20' : '';
                    const bannerColor = bestType === 'BM' ? 'bg-cyan-500' : bestType === 'AM' ? 'bg-blue-500' : 'bg-purple-500';
                    const bannerText = bestType === 'BM' ? '💎 BM BEST KPT' : bestType === 'AM' ? '🔷 AＭ BEST KPT' : '🔮 ＳＭ BEST KPT';
                    const reactionTotal = report.reactions.filter((r: any) => ['like','learn','copy','great'].includes(r.type)).reduce((s: number, r: any) => s + (r.count || 0), 0);

                    return (
                        <div key={report.id} className="relative">
                            {/* ツリーの枝の線 */}
                            <div className="absolute -left-4 top-10 w-4 h-[2px] bg-paradise-ocean/20"></div>
                            
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              onClick={() => navigate(`/report/${report.id}`)}
                              className="cursor-pointer"
                            >
                            <GlassCard className={`relative overflow-hidden group transition-all duration-300 shadow-sm hover:shadow-md ${isExpanded ? 'p-6' : 'px-4 py-2.5'} ${!report.readBy?.includes(user?.uid || '') ? 'border-l-[6px] border-l-qb-cyan' : 'border-gray-200/50'} ${cardBg}`}>
                                {/* 1行サマリー（折りたたみ時） */}
                                <div className="flex items-center gap-2 min-w-0">
                                  {!report.readBy?.includes(user?.uid || '') && (
                                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                                       <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-qb-cyan opacity-75"></span>
                                       <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-qb-cyan"></span>
                                    </span>
                                  )}
                                  <span className="text-xs font-black text-white bg-qb-blue px-1.5 py-0.5 rounded shrink-0">
                                    {displayRole(report.authorRole)}
                                  </span>
                                  <h3 className="text-sm font-black text-ink truncate min-w-0">{formatStaffName(report.authorName)}</h3>
                                  <span className="text-xs font-bold text-ink-soft truncate shrink-0 max-w-[34%]">{abbreviateStoreName(report.storeName)}</span>
                                  {hasBestKpt && (
                                    <span title={bannerText} className={`shrink-0 inline-flex items-center gap-0.5 ${bannerColor} text-white text-xs font-black px-1.5 py-0.5 rounded`}>
                                      <Trophy size={11} /> BEST
                                    </span>
                                  )}
                                  {report.status === 'draft' && (
                                    <span className="text-xs font-black text-qb-gray bg-canvas border border-line px-1.5 py-0.5 rounded shrink-0">下書き</span>
                                  )}
                                  {report.status === 'published' && report.scheduledFor && new Date(report.scheduledFor) > new Date() && (
                                    <span className="text-xs font-black text-qb-blue bg-qb-blue/10 border border-qb-blue/30 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5"><Calendar size={10} /> 予約</span>
                                  )}

                                  <div className="ml-auto flex items-center gap-2 shrink-0">
                                    {reactionTotal > 0 && (
                                      <span className="flex items-center gap-0.5 text-xs font-black text-ink-soft tabular">
                                        <ThumbsUp size={13} className="text-qb-cyan" /> {reactionTotal}
                                      </span>
                                    )}
                                    {report.commentCount > 0 && (
                                      <span className="flex items-center gap-0.5 text-xs font-black text-ink-soft tabular">
                                        <MessageCircle size={13} className="text-qb-blue" /> {report.commentCount}
                                      </span>
                                    )}
                                    <span className="text-xs font-bold text-ink-soft tabular hidden sm:inline">
                                      {new Date(report.createdAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                                    </span>
                                    <button
                                      onClick={(e) => toggleExpand(e, report.id)}
                                      className="tap grid place-items-center rounded-lg text-qb-gray hover:text-qb-blue hover:bg-canvas transition-colors shrink-0 -mr-2"
                                    >
                                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                  </div>
                                </div>

                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-6 pt-6 border-t border-gray-100/50 space-y-6">
                                        <section>
                                          <label className="text-xs font-black text-paradise-sunset uppercase tracking-[0.2em] mb-1.5 block">キープ</label>
                                          <div className="text-sm text-gray-700 leading-relaxed font-medium line-clamp-3 prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.keep }} />
                                        </section>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <section className="bg-white/40 p-4 rounded-2xl border border-white/40">
                                            <label className="text-xs font-black text-red-500 uppercase tracking-[0.2em] mb-1 block">問題点</label>
                                            <div className="text-sm text-gray-700 line-clamp-2 prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.problem_gap }} />
                                          </section>
                                          <section className="bg-white/40 p-4 rounded-2xl border border-white/40">
                                            <label className="text-xs font-black text-paradise-ocean uppercase tracking-[0.2em] mb-1 block">挑戦</label>
                                            <p className="text-sm text-gray-700 line-clamp-2">{report.try_what}</p>
                                          </section>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white/40 p-3 rounded-2xl border border-white/50">
                                          <div className="flex flex-wrap gap-2">
                                             {report.reactions.map((reaction, i) => (
                                               <div key={i} className="flex items-center gap-1 text-sm sm:text-xs bg-white/80 px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-full font-bold text-gray-600 border border-gray-100/80 shadow-sm shrink-0">
                                                 {getReactionIcon(reaction.type)} <span className="ml-0.5">{reaction.count}</span>
                                               </div>
                                             ))}
                                             {report.commentCount > 0 && (
                                               <div className="flex items-center gap-1 text-sm sm:text-xs bg-white/80 px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-full font-bold text-gray-600 border border-gray-100/80 shadow-sm shrink-0">
                                                 <MessageCircle size={14} className="text-blue-400" /> <span className="ml-0.5">{report.commentCount}</span>
                                               </div>
                                             )}
                                          </div>
                                          <div className="flex items-center justify-center sm:justify-end gap-1 text-xs font-black text-paradise-ocean uppercase bg-white/60 px-4 py-2 sm:px-3 sm:py-1.5 rounded-full hover:bg-white transition-colors shrink-0 whitespace-nowrap self-stretch sm:self-auto shadow-sm">
                                            詳細を開く <ChevronRight size={12} />
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </GlassCard>
                            </motion.div>
                        </div>
                    );
                 })}
               </div>
            </div>
         )}) }
      </div>

      {/* 空の状態 */}
      {Object.keys(groupedByWeek).length === 0 && (
        <div className="text-center py-20 opacity-50">
          <p className="text-xl font-bold text-gray-400">レポートがまだありません</p>
          <p className="text-base text-gray-300 mt-2">あなたの体験を最初のレポートにしましょう 🌴</p>
        </div>
      )}

      {/* フローティング投稿ボタン */}
      {(!isBM || activeRole !== 'BM') && (
        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/post')}
          className="fixed bottom-10 right-10 w-16 h-16 bg-gradient-to-br from-qb-blue to-qb-cyan rounded-full shadow-2xl shadow-qb-blue/30 flex items-center justify-center text-white z-50 border-4 border-white/50"
        >
          <Stars size={32} />
        </motion.button>
      )}

    </div>
  );
};
