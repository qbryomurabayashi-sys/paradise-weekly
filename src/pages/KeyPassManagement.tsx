import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useShiftStore } from '../store/useShiftStore';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, limit, query } from 'firebase/firestore';
import { GlassCard } from '../components/ui/GlassCard';
import { Key, ShieldCheck, Mail, Lock, AlertTriangle, CheckCircle, ChevronLeft, ChevronDown, Camera, Check, Plus, Search, Trash2, Users, Package } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { formatStaffName, abbreviateStoreName } from '../lib/formatUtils';

interface Possession {
  type: 'key' | 'pass' | 'safe_pwd' | 'post_pwd';
  storeName: string;
  lastCheckedAt?: string;
  checkMethod?: 'photo' | 'physical';
  lastCheckedByName?: string;
}

interface KeyPassRecord {
  id: string; // userId / staffId
  userName: string;
  possessions: Possession[];
  lastCheckedAt: string;
}

interface StoreItem { text: string; id: string; }

interface StoreKeyPass {
  id: string; // storeId
  storeName: string;
  items: StoreItem[];
  lastCheckedAt: string;
  lastCheckedByName?: string;
  checkMethod?: 'photo' | 'physical';
}

let _globalKeyPassPersonalUnsub: any = null;
let _cachedKeyPassPersonal: KeyPassRecord[] = [];
let _globalKeyPassStoreUnsub: any = null;
let _cachedKeyPassStore: StoreKeyPass[] = [];

const POSS_TYPES: { type: Possession['type']; label: string; icon: any; active: string; dot: string }[] = [
  { type: 'key', label: '鍵所持', icon: Key, active: 'bg-yellow-50 border-yellow-300 text-yellow-700', dot: 'text-yellow-600' },
  { type: 'pass', label: '入館証', icon: ShieldCheck, active: 'bg-blue-50 border-blue-300 text-blue-700', dot: 'text-blue-600' },
  { type: 'safe_pwd', label: '金庫番号', icon: Lock, active: 'bg-purple-50 border-purple-300 text-purple-700', dot: 'text-purple-600' },
  { type: 'post_pwd', label: 'ポスト番号', icon: Mail, active: 'bg-pink-50 border-pink-300 text-pink-700', dot: 'text-pink-600' },
];

const isRecentlyChecked = (iso?: string) =>
  !!iso && (new Date().getTime() - new Date(iso).getTime()) < 7 * 24 * 60 * 60 * 1000;

export const KeyPassManagement = () => {
  const { user, viewMode } = useAuthStore();
  const navigate = useNavigate();
  const { stores, initStores, staffs, initStaffs } = useShiftStore();

  const [records, setRecords] = useState<KeyPassRecord[]>([]);
  const [storeRecords, setStoreRecords] = useState<StoreKeyPass[]>([]);

  const [storeSearch, setStoreSearch] = useState('');
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [expandedStores, setExpandedStores] = useState<string[]>([]);
  const [storeInputs, setStoreInputs] = useState<Record<string, string>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null); // staffId whose add-panel is open
  const [addPanelStore, setAddPanelStore] = useState<Record<string, string>>({}); // staffId -> storeId shown in add panel

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => setToast({ msg, type });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    initStores();
    initStaffs();

    if (!_globalKeyPassPersonalUnsub) {
      _globalKeyPassPersonalUnsub = true;
      (async () => {
        try {
          const { getDocs } = await import('firebase/firestore');
          const snap = await getDocs(query(collection(db, 'key_passes'), limit(500)));
          const data: KeyPassRecord[] = [];
          snap.forEach(d => data.push({ id: d.id, ...d.data() } as KeyPassRecord));
          _cachedKeyPassPersonal = data;
          setRecords(data);
        } catch (e) { console.error(e); }
      })();
    } else {
      setRecords(_cachedKeyPassPersonal);
    }

    if (!_globalKeyPassStoreUnsub) {
      _globalKeyPassStoreUnsub = true;
      (async () => {
        try {
          const { getDocs } = await import('firebase/firestore');
          const snap = await getDocs(query(collection(db, 'store_key_passes'), limit(150)));
          const data: StoreKeyPass[] = [];
          snap.forEach(d => data.push({ id: d.id, ...d.data() } as StoreKeyPass));
          _cachedKeyPassStore = data;
          setStoreRecords(data);
        } catch (e) { console.error(e); }
      })();
    } else {
      setStoreRecords(_cachedKeyPassStore);
    }

    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActuallyBM = user?.role === 'BM';
  const activeRole = isActuallyBM && viewMode ? viewMode : user?.role;
  const isBM = activeRole === 'BM';

  // ---- local state sync helpers (no realtime listener, so we patch cache manually) ----
  const upsertRecord = (staffId: string, staffName: string, possessions: Possession[], bumpCheck: boolean) => {
    setRecords(prev => {
      const existing = prev.find(r => r.id === staffId);
      const lastCheckedAt = bumpCheck ? new Date().toISOString() : (existing?.lastCheckedAt || '');
      const next: KeyPassRecord = { id: staffId, userName: staffName, possessions, lastCheckedAt };
      const arr = [...prev.filter(r => r.id !== staffId), next];
      _cachedKeyPassPersonal = arr;
      return arr;
    });
  };

  const upsertStore = (storeId: string, storeName: string, patch: Partial<StoreKeyPass>) => {
    setStoreRecords(prev => {
      const existing = prev.find(r => r.id === storeId);
      const base: StoreKeyPass = existing
        ? { ...existing }
        : { id: storeId, storeName, items: [], lastCheckedAt: '' };
      const next: StoreKeyPass = { ...base, ...patch, id: storeId, storeName };
      const arr = [...prev.filter(r => r.id !== storeId), next];
      _cachedKeyPassStore = arr;
      return arr;
    });
  };

  // ---- possession (staff) operations : register / check / delete ----
  const staffFullName = (staff: any) => `${staff.lastName} ${staff.firstName}`;

  const togglePossession = async (staff: any, storeName: string, type: Possession['type']) => {
    if (isBM) return;
    const record = records.find(r => r.id === staff.id);
    const current = record?.possessions || [];
    const exists = current.some(p => p.storeName === storeName && p.type === type);
    const next = exists
      ? current.filter(p => !(p.storeName === storeName && p.type === type))
      : [...current, { type, storeName }];
    try {
      await setDoc(doc(db, 'key_passes', staff.id), {
        userName: staffFullName(staff),
        possessions: next,
      }, { merge: true });
      upsertRecord(staff.id, staffFullName(staff), next, false);
      showToast(exists ? '所持を解除しました' : '所持を登録しました', exists ? 'info' : 'success');
    } catch (e) { console.error(e); showToast('エラーが発生しました', 'error'); }
  };

  const checkPossession = async (staff: any, index: number, method: 'photo' | 'physical') => {
    if (isBM) return;
    const record = records.find(r => r.id === staff.id);
    const current = [...(record?.possessions || [])];
    if (!current[index]) return;
    const now = new Date().toISOString();
    current[index] = { ...current[index], lastCheckedAt: now, checkMethod: method, lastCheckedByName: user?.name };
    try {
      await setDoc(doc(db, 'key_passes', staff.id), {
        userName: staffFullName(staff),
        possessions: current,
        lastCheckedAt: now,
      }, { merge: true });
      upsertRecord(staff.id, staffFullName(staff), current, true);
      showToast(`${method === 'photo' ? '写真' : '現物'}で確認しました`, 'success');
    } catch (e) { console.error(e); showToast('エラーが発生しました', 'error'); }
  };

  const checkAllForStaff = async (staff: any, method: 'photo' | 'physical') => {
    if (isBM) return;
    const record = records.find(r => r.id === staff.id);
    const current = (record?.possessions || []);
    if (current.length === 0) return;
    const now = new Date().toISOString();
    const next = current.map(p => ({ ...p, lastCheckedAt: now, checkMethod: method, lastCheckedByName: user?.name }));
    try {
      await setDoc(doc(db, 'key_passes', staff.id), {
        userName: staffFullName(staff),
        possessions: next,
        lastCheckedAt: now,
      }, { merge: true });
      upsertRecord(staff.id, staffFullName(staff), next, true);
      showToast(`まとめて${method === 'photo' ? '写真' : '現物'}確認しました`, 'success');
    } catch (e) { console.error(e); showToast('エラーが発生しました', 'error'); }
  };

  const deletePossession = async (staff: any, index: number) => {
    if (isBM) return;
    const record = records.find(r => r.id === staff.id);
    const current = [...(record?.possessions || [])];
    if (!current[index]) return;
    current.splice(index, 1);
    try {
      await setDoc(doc(db, 'key_passes', staff.id), {
        userName: staffFullName(staff),
        possessions: current,
      }, { merge: true });
      upsertRecord(staff.id, staffFullName(staff), current, false);
      showToast('所持を削除しました', 'info');
    } catch (e) { console.error(e); showToast('エラーが発生しました', 'error'); }
  };

  // ---- store-kept item operations ----
  const handleUpdateStoreCheck = async (storeId: string, storeName: string, method: 'photo' | 'physical') => {
    if (!user || isBM) return;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'store_key_passes', storeId), {
        storeName, lastCheckedAt: now, lastCheckedByName: user.name, checkMethod: method,
      }, { merge: true });
      upsertStore(storeId, storeName, { lastCheckedAt: now, lastCheckedByName: user.name, checkMethod: method });
      showToast(`店舗保管分を${method === 'photo' ? '写真' : '現物'}確認しました`, 'success');
    } catch (e) { console.error(e); showToast('エラーが発生しました', 'error'); }
  };

  const addStoreItem = async (storeId: string, storeName: string, text: string) => {
    if (!text.trim() || isBM) return;
    try {
      const existing = storeRecords.find(r => r.id === storeId);
      const newItems = [...(existing?.items || []), { id: Date.now().toString(), text: text.trim() }];
      await setDoc(doc(db, 'store_key_passes', storeId), { storeName, items: newItems }, { merge: true });
      upsertStore(storeId, storeName, { items: newItems });
      showToast('店舗保管分を追加しました', 'success');
    } catch (e) { console.error(e); showToast('エラーが発生しました', 'error'); }
  };

  const removeStoreItem = async (storeId: string, storeName: string, itemId: string) => {
    if (isBM) return;
    try {
      const existing = storeRecords.find(r => r.id === storeId);
      if (!existing) return;
      const newItems = existing.items.filter(i => i.id !== itemId);
      await setDoc(doc(db, 'store_key_passes', storeId), { items: newItems }, { merge: true });
      upsertStore(storeId, storeName, { items: newItems });
      showToast('店舗保管分を削除しました', 'info');
    } catch (e) { console.error(e); showToast('エラーが発生しました', 'error'); }
  };

  // ---- alert helpers ----
  const getAlertStatus = (record?: KeyPassRecord) => {
    if (!record) return false;
    const hasPhysical = record.possessions?.some(p => p.type === 'key' || p.type === 'pass');
    if (!hasPhysical) return false;
    if (!record.lastCheckedAt) return true;
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return new Date(record.lastCheckedAt) < oneMonthAgo;
  };

  const translateType = (type: string) => POSS_TYPES.find(t => t.type === type)?.label || type;
  const getTypeIcon = (type: string) => {
    const t = POSS_TYPES.find(x => x.type === type);
    if (!t) return null;
    const Icon = t.icon;
    return <Icon size={14} className={t.dot} />;
  };

  const getAlertStores = () => {
    const today = new Date();
    const alertStoreIds = new Set<string>();
    staffs.forEach(staff => {
      const record = records.find(r => r.id === staff.id);
      if (record && record.possessions && record.possessions.length > 0) {
        const isUnchecked = record.possessions.some(p => {
          if (!p.lastCheckedAt) return true;
          const checkedDate = new Date(p.lastCheckedAt);
          const isThisMonth = checkedDate.getMonth() === today.getMonth() && checkedDate.getFullYear() === today.getFullYear();
          if (isThisMonth) return false;
          const diffDays = (today.getTime() - checkedDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays >= 31) return true;
          if (today.getDate() > 15) return true;
          return false;
        });
        if (isUnchecked && staff.storeId) alertStoreIds.add(staff.storeId);
      }
    });
    return Array.from(alertStoreIds).map(id => stores.find(s => s.id === id)?.name).filter(Boolean) as string[];
  };

  const alertStores = getAlertStores();

  const toggleStore = (storeId: string) =>
    setExpandedStores(prev => prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]);

  // ---- derive per-store view models ----
  const visibleStores = [...stores]
    .filter(store => storeSearch.trim() ? store.name.includes(storeSearch.trim()) : true)
    .map(store => {
      const staffList = staffs.filter(s => s.storeId === store.id);
      const alertStaff = staffList.filter(s => getAlertStatus(records.find(r => r.id === s.id)));
      const registeredCount = staffList.filter(s => (records.find(r => r.id === s.id)?.possessions?.length || 0) > 0).length;
      const storeRec = storeRecords.find(r => r.id === store.id);
      return { store, staffList, alertStaff, registeredCount, storeRec };
    })
    .filter(vm => onlyAlerts ? (vm.alertStaff.length > 0) : true);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-32 px-4 animate-fade-in pt-6">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl font-bold text-sm text-white max-w-[90vw]"
            style={{ background: toast.type === 'error' ? '#E60000' : toast.type === 'info' ? '#005AAF' : '#17B26A' }}
          >
            {toast.type === 'error' ? <AlertTriangle size={18} className="shrink-0" /> : <Check size={18} className="shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => navigate('/')}
        className="tap flex items-center gap-1 text-ink-soft font-bold hover:text-ink transition-all group -ml-2"
      >
        <ChevronLeft className="group-hover:-translate-x-1 transition-transform" /> 戻る
      </button>

      {/* Hero header */}
      <div className="rounded-3xl p-5 bg-gradient-to-br from-qb-blue-dark via-qb-blue to-qb-cyan shadow-lg flex items-center gap-3">
        <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
          <Key className="text-white" size={26} />
        </span>
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide">鍵・入証管理</h2>
          <p className="text-xs font-bold text-white/70 mt-0.5">店舗ごとに、登録・確認・削除をこの画面で完結</p>
        </div>
      </div>

      {alertStores.length > 0 && (
        <div className="bg-danger/10 border-2 border-danger/30 text-danger p-4 rounded-2xl shadow-sm flex items-start sm:items-center gap-3">
          <AlertTriangle size={24} className="shrink-0 animate-pulse mt-0.5 sm:mt-0" />
          <div>
            <p className="font-black text-sm sm:text-base">以下の店舗で1ヶ月以上確認が行われていないか、今月15日を過ぎても当月分の確認が完了していません</p>
            <p className="text-xs sm:text-sm font-bold mt-1 opacity-90">{alertStores.join('、')}</p>
          </div>
        </div>
      )}

      {/* 使い方ガイド */}
      {!isBM && (
        <div className="bg-qb-blue/5 border border-qb-blue/15 rounded-2xl px-4 py-3 text-xs sm:text-sm text-ink-soft font-bold leading-relaxed">
          店舗をタップして開くと、<span className="text-qb-blue">店舗保管分</span>と<span className="text-qb-blue">スタッフの所持状況</span>をその場で管理できます。所持の登録・確認・削除はすべてワンタップで即保存されます。
        </div>
      )}

      {/* 検索 & フィルタ */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-qb-gray pointer-events-none" />
          <input
            type="text"
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            placeholder="店舗名で検索"
            enterKeyHint="search"
            className="w-full min-h-[44px] pl-10 pr-3 rounded-2xl bg-surface border border-line text-ink font-bold text-sm outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan"
          />
        </div>
        <button
          onClick={() => setOnlyAlerts(v => !v)}
          className={`tap px-4 rounded-2xl font-bold text-sm whitespace-nowrap border-2 transition-all flex items-center justify-center gap-2 ${onlyAlerts ? 'bg-danger text-white border-danger shadow-md' : 'bg-surface text-ink-soft border-line hover:bg-canvas'}`}
        >
          <AlertTriangle size={16} /> 要確認のみ
        </button>
      </div>

      {/* 店舗別アコーディオン */}
      <div className="space-y-3">
        {visibleStores.length === 0 && (
          <GlassCard className="p-8 text-center text-qb-gray font-bold">該当する店舗がありません</GlassCard>
        )}

        {visibleStores.map(({ store, staffList, alertStaff, registeredCount, storeRec }) => {
          const isExpanded = expandedStores.includes(store.id);
          const items = storeRec?.items || [];

          return (
            <div key={store.id} className={`rounded-2xl border overflow-hidden shadow-sm transition-all ${alertStaff.length > 0 ? 'border-danger/30 bg-danger/[0.03]' : 'border-line bg-surface'}`}>
              {/* Store header */}
              <button
                onClick={() => toggleStore(store.id)}
                className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 hover:bg-canvas/60 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${alertStaff.length > 0 ? 'bg-danger animate-pulse' : 'bg-qb-blue'}`} />
                  <h3 className="font-black text-ink text-base sm:text-lg truncate">{abbreviateStoreName(store.name)}</h3>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {alertStaff.length > 0 && (
                    <span className="text-xs font-black text-white bg-danger px-2 py-0.5 rounded-full whitespace-nowrap">要確認 {alertStaff.length}</span>
                  )}
                  <span className="text-xs font-bold text-qb-blue bg-qb-blue/10 px-2 py-0.5 rounded-full whitespace-nowrap tabular">
                    <Users size={11} className="inline mb-0.5 mr-0.5" />{registeredCount}/{staffList.length}
                  </span>
                  {items.length > 0 && (
                    <span className="text-xs font-bold text-ink-soft bg-line px-2 py-0.5 rounded-full whitespace-nowrap tabular">
                      <Package size={11} className="inline mb-0.5 mr-0.5" />{items.length}
                    </span>
                  )}
                  <ChevronDown className={`text-ink-soft transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={20} />
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 sm:px-4 pb-4 pt-1 border-t border-line bg-canvas/40 space-y-4">

                  {/* === 店舗保管分 === */}
                  <section className="bg-surface rounded-2xl border border-line p-3.5 space-y-3 mt-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-black text-ink text-sm flex items-center gap-1.5">
                        <Package size={16} className="text-qb-blue" /> 店舗保管分
                      </h4>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-[11px] font-bold text-ink-soft leading-tight">
                            {storeRec?.checkMethod === 'photo' ? '写真確認: ' : storeRec?.checkMethod === 'physical' ? '現物確認: ' : '最終確認: '}
                            {storeRec?.lastCheckedByName ? formatStaffName(storeRec.lastCheckedByName) : '未確認'}
                          </p>
                          <div className="flex items-center justify-end gap-1">
                            {isRecentlyChecked(storeRec?.lastCheckedAt) && (
                              <span className="text-[10px] font-black text-white bg-danger px-1.5 py-0.5 rounded animate-pulse">NEW</span>
                            )}
                            <p className="text-xs font-black text-ink tabular">{storeRec?.lastCheckedAt ? new Date(storeRec.lastCheckedAt).toLocaleDateString() : '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* items */}
                    {items.length === 0 ? (
                      <p className="text-xs text-qb-gray font-bold py-1">保管アイテムなし</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {items.map(item => (
                          <li key={item.id} className="flex items-center gap-2 bg-canvas px-3 py-2.5 rounded-xl text-sm font-medium border border-line">
                            <span className="flex-1 text-ink">{item.text}</span>
                            {!isBM && (
                              <button
                                onClick={() => removeStoreItem(store.id, store.name, item.id)}
                                aria-label="削除"
                                className="tap w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-danger bg-danger/10 hover:bg-danger hover:text-white transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {!isBM && (
                      <>
                        {/* add item */}
                        <div className="flex items-stretch gap-2">
                          <input
                            type="text"
                            value={storeInputs[store.id] || ''}
                            onChange={(e) => setStoreInputs({ ...storeInputs, [store.id]: e.target.value })}
                            placeholder="例：鍵1点（緊急用）"
                            enterKeyHint="done"
                            className="flex-1 min-h-[44px] px-3 text-sm rounded-xl bg-canvas border border-line outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && storeInputs[store.id]) {
                                e.preventDefault();
                                addStoreItem(store.id, store.name, storeInputs[store.id]);
                                setStoreInputs({ ...storeInputs, [store.id]: '' });
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              if (storeInputs[store.id]) {
                                addStoreItem(store.id, store.name, storeInputs[store.id]);
                                setStoreInputs({ ...storeInputs, [store.id]: '' });
                              }
                            }}
                            disabled={!storeInputs[store.id]}
                            className="tap bg-gradient-to-r from-qb-blue to-qb-cyan text-white px-4 rounded-xl text-sm font-black disabled:opacity-40 disabled:grayscale whitespace-nowrap flex items-center gap-1"
                          >
                            <Plus size={16} /> 追加
                          </button>
                        </div>

                        {/* store check */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleUpdateStoreCheck(store.id, store.name, 'photo')}
                            className="tap flex-1 justify-center bg-qb-blue/10 text-qb-blue hover:bg-qb-blue/20 rounded-xl text-xs font-bold border border-qb-blue/20 flex items-center gap-1"
                          >
                            <Camera size={15} /> 写真で確認
                          </button>
                          <button
                            onClick={() => handleUpdateStoreCheck(store.id, store.name, 'physical')}
                            className="tap flex-1 justify-center bg-success/10 text-success hover:bg-success/20 rounded-xl text-xs font-bold border border-success/20 flex items-center gap-1"
                          >
                            <CheckCircle size={15} /> 現物で確認
                          </button>
                        </div>
                      </>
                    )}
                  </section>

                  {/* === スタッフの所持状況 === */}
                  <section className="space-y-2.5">
                    <h4 className="font-black text-ink text-sm flex items-center gap-1.5 px-1">
                      <Users size={16} className="text-qb-blue" /> スタッフの所持状況
                    </h4>

                    {staffList.length === 0 && (
                      <p className="text-xs text-qb-gray font-bold px-1 py-2">所属スタッフがいません</p>
                    )}

                    {staffList.map(staff => {
                      const record = records.find(r => r.id === staff.id);
                      const possessions = record?.possessions || [];
                      const isAlert = getAlertStatus(record);
                      const isAdding = addingFor === staff.id;
                      const panelStoreId = addPanelStore[staff.id] ?? staff.storeId ?? store.id;
                      const panelStoreName = stores.find(s => s.id === panelStoreId)?.name || store.name;

                      return (
                        <div key={staff.id} className={`rounded-2xl border-2 p-3.5 transition-all ${isAlert ? 'bg-danger/5 border-danger/30' : 'bg-surface border-line'}`}>
                          {/* name row */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <h5 className="font-black text-ink text-base truncate">
                                {formatStaffName(staffFullName(staff))}
                                <span className="text-[11px] text-qb-gray font-normal ml-1">({staff.employmentType === 'parttime' ? 'パート' : '正社員'})</span>
                              </h5>
                              {isAlert && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-md animate-pulse whitespace-nowrap">
                                  <AlertTriangle size={12} /> 1ヶ月未確認
                                </span>
                              )}
                            </div>
                            {!isBM && possessions.length > 1 && (
                              <button
                                onClick={() => checkAllForStaff(staff, 'physical')}
                                className="text-[11px] font-black text-success bg-success/10 hover:bg-success/20 px-2.5 py-1.5 rounded-lg border border-success/20 flex items-center gap-1 whitespace-nowrap"
                              >
                                <CheckCircle size={13} /> まとめて現物確認
                              </button>
                            )}
                          </div>

                          {/* possession chips */}
                          <div className="flex flex-col gap-2 mt-3">
                            {possessions.length === 0 && (
                              <span className="text-xs text-qb-gray font-bold">所持品なし</span>
                            )}
                            {possessions.map((p, i) => (
                              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-canvas px-3 py-2.5 rounded-xl border border-line">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  {getTypeIcon(p.type)}
                                  <span className="text-sm font-bold text-ink">
                                    {abbreviateStoreName(p.storeName)} <span className="text-xs text-ink-soft">({translateType(p.type)})</span>
                                  </span>
                                  {p.lastCheckedAt && (
                                    <span className="flex items-center gap-1">
                                      {isRecentlyChecked(p.lastCheckedAt) && (
                                        <span className="text-[10px] font-black text-white bg-danger px-1.5 py-0.5 rounded animate-pulse whitespace-nowrap">NEW</span>
                                      )}
                                      <span className="text-[11px] bg-line px-1.5 py-0.5 rounded text-ink-soft font-medium whitespace-nowrap">
                                        {p.checkMethod === 'photo' ? '写真' : p.checkMethod === 'physical' ? '現物' : ''} {new Date(p.lastCheckedAt).toLocaleDateString()}
                                        {p.lastCheckedByName && `・${formatStaffName(p.lastCheckedByName)}`}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                {!isBM && (
                                  <div className="flex gap-1.5 shrink-0">
                                    <button
                                      onClick={() => checkPossession(staff, i, 'photo')}
                                      className="tap min-h-[40px] justify-center bg-qb-blue/10 text-qb-blue hover:bg-qb-blue/20 px-3 rounded-lg text-xs font-bold border border-qb-blue/20 flex items-center gap-1"
                                    >
                                      <Camera size={14} /> 写真
                                    </button>
                                    <button
                                      onClick={() => checkPossession(staff, i, 'physical')}
                                      className="tap min-h-[40px] justify-center bg-success/10 text-success hover:bg-success/20 px-3 rounded-lg text-xs font-bold border border-success/20 flex items-center gap-1"
                                    >
                                      <CheckCircle size={14} /> 現物
                                    </button>
                                    <button
                                      onClick={() => deletePossession(staff, i)}
                                      aria-label="削除"
                                      className="tap w-10 min-h-[40px] justify-center rounded-lg flex items-center text-danger bg-danger/10 hover:bg-danger hover:text-white transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* add / register panel */}
                          {!isBM && (
                            <div className="mt-3">
                              {!isAdding ? (
                                <button
                                  onClick={() => { setAddingFor(staff.id); setAddPanelStore({ ...addPanelStore, [staff.id]: panelStoreId }); }}
                                  className="tap w-full justify-center border-2 border-dashed border-qb-blue/30 text-qb-blue hover:bg-qb-blue/5 rounded-xl text-sm font-black flex items-center gap-1.5"
                                >
                                  <Plus size={16} /> 所持を登録
                                </button>
                              ) : (
                                <div className="bg-canvas rounded-xl border border-line p-3 space-y-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <label className="text-[11px] font-black text-ink-soft uppercase tracking-wide">登録する店舗</label>
                                    <button onClick={() => setAddingFor(null)} className="tap text-xs font-bold text-qb-gray hover:text-ink px-2">閉じる</button>
                                  </div>
                                  <select
                                    value={panelStoreId}
                                    onChange={(e) => setAddPanelStore({ ...addPanelStore, [staff.id]: e.target.value })}
                                    className="w-full min-h-[44px] px-3 rounded-xl bg-surface border border-line text-ink font-bold text-sm outline-none focus:ring-2 focus:ring-qb-cyan"
                                  >
                                    {stores.map(s => <option key={s.id} value={s.id}>{abbreviateStoreName(s.name)}</option>)}
                                  </select>
                                  <p className="text-[11px] font-bold text-ink-soft">タップで登録／解除できます</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {POSS_TYPES.map(pt => {
                                      const active = possessions.some(p => p.storeName === panelStoreName && p.type === pt.type);
                                      const Icon = pt.icon;
                                      return (
                                        <button
                                          key={pt.type}
                                          onClick={() => togglePossession(staff, panelStoreName, pt.type)}
                                          className={`tap flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold border-2 transition-all ${active ? pt.active + ' shadow-sm' : 'bg-surface border-line text-qb-gray hover:bg-canvas'}`}
                                        >
                                          <Icon size={16} /> <span>{pt.label}</span>
                                          {active && <Check size={14} className="ml-0.5" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
