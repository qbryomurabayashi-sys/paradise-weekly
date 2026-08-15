import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useUsersStore } from '../store/useUsersStore';
import { useShiftStore } from '../store/useShiftStore';
import { useLeavePlanStore, LeavePlan } from '../store/useLeavePlanStore';
import { Calendar, ChevronDown, Save, FileEdit, Info, Umbrella, AlertTriangle } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { formatStaffName, displayRole } from '../lib/formatUtils';
import { useSearchParams } from 'react-router-dom';

const FIELDS: { key: 'paidLeave' | 'publicWork' | 'training' | 'meeting'; label: string }[] = [
    { key: 'paidLeave', label: '有休' },
    { key: 'publicWork', label: '公出' },
    { key: 'training', label: '研修' },
    { key: 'meeting', label: '会議' },
];

export const LeavePlanDashboard = () => {
    const { user, viewMode } = useAuthStore();
    const { users, init: initUsers } = useUsersStore();
    const { stores, staffs, initStores, initStaffs } = useShiftStore();
    const { leavePlans, initLeavePlans, saveLeavePlan } = useLeavePlanStore();

    const [searchParams, setSearchParams] = useSearchParams();
    const urlMonth = searchParams.get('month');

    // デフォルトは翌々月 (URLパラメータがある場合はそちらを優先)
    const [targetMonthDate, setTargetMonthDate] = useState<Date>(() => {
        if (urlMonth) {
            const parsed = new Date(urlMonth + '-01');
            if (!isNaN(parsed.getTime())) return parsed;
        }
        const today = new Date();
        return today.getDate() >= 20 ? addMonths(today, 2) : addMonths(today, 1);
    });
    const targetMonthStr = format(targetMonthDate, 'yyyy-MM');

    const [expandedStores, setExpandedStores] = useState<string[]>([]);
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ paidLeave: 0, publicWork: 0, training: 0, meeting: 0 });
    const [bulkConfirmStore, setBulkConfirmStore] = useState<string | null>(null);
    const [flashStaffId, setFlashStaffId] = useState<string | null>(null);

    const handleSetAllNoLeave = async (storeId: string, storeStaffs: any[]) => {
        setBulkConfirmStore(null);
        try {
            for (const staff of storeStaffs) {
                await saveLeavePlan({
                    id: '',
                    staffId: staff.id,
                    storeId: storeId,
                    targetMonth: targetMonthStr,
                    paidLeave: 0,
                    publicWork: 0,
                    training: 0,
                    meeting: 0,
                    updatedAt: ''
                });
            }
        } catch (error) {
            console.error('Failed to save plans bulk:', error);
        }
    };

    useEffect(() => {
        const unsubStores = initStores();
        const unsubStaffs = initStaffs();
        const unsubUsers = initUsers();
        return () => {
            unsubStores();
            unsubStaffs();
            if (unsubUsers) unsubUsers();
        };
    }, []);

    useEffect(() => {
        const unsubLeavePlans = initLeavePlans(targetMonthStr);
        return () => unsubLeavePlans();
    }, [targetMonthStr]);

    const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;
    const isBM = activeRole === 'BM';
    const isAM = activeRole === 'AM';
    const isTencho = activeRole === '店長';
    const isAdmin = isBM || isAM || isTencho;

    // mixedStaffs（ShiftDashboardと同様）
    const mixedStaffs = useMemo(() => {
        if (!stores.length) return staffs;
        const userStaffs = users.filter((u:any) => u.role !== 'BM').map(u => {
            const store = stores.find((s:any) => s.name === u.storeName);
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

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = new Date(e.target.value + '-01');
        if (!isNaN(date.getTime())) {
            setTargetMonthDate(date);
            setSearchParams({ month: e.target.value });
        }
    };

    const toggleStore = (storeId: string) => {
        setExpandedStores(prev => prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]);
    };

    const startEdit = (staffId: string, currentPlan?: LeavePlan) => {
        setEditingStaffId(staffId);
        if (currentPlan) {
            setEditForm({
                paidLeave: currentPlan.paidLeave || 0,
                publicWork: currentPlan.publicWork || 0,
                training: currentPlan.training || 0,
                meeting: currentPlan.meeting || 0
            });
        } else {
            setEditForm({ paidLeave: 0, publicWork: 0, training: 0, meeting: 0 });
        }
    };

    const saveEdit = async (staffId: string, storeId: string) => {
        await saveLeavePlan({
            id: '',
            staffId,
            storeId,
            targetMonth: targetMonthStr,
            paidLeave: editForm.paidLeave,
            publicWork: editForm.publicWork,
            training: editForm.training,
            meeting: editForm.meeting,
            updatedAt: ''
        });
        setEditingStaffId(null);
        setFlashStaffId(staffId);
        setTimeout(() => setFlashStaffId(null), 1600);
    };

    // グルーピング
    const storeGroups = useMemo(() => {
        const groups = stores.map(store => ({
            store,
            staffs: mixedStaffs.filter((s:any) => s.storeId === store.id)
        }));

        const unassignedStaffs = mixedStaffs.filter((s:any) => !stores.some(st => st.id === s.storeId));
        if (unassignedStaffs.length > 0) {
            groups.push({ store: { id: 'unassigned', name: '未割り当て' } as any, staffs: unassignedStaffs });
        }

        if (!isAdmin) {
            const myStore = stores.find(s => s.name === user?.storeName);
            if (myStore) {
                return groups.filter(g => g.store.id === myStore.id);
            }
            return [];
        }
        return groups;
    }, [stores, mixedStaffs, isAdmin, user?.storeName]);

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 pb-24 space-y-5">
            {/* ヘッダー */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-5 rounded-3xl">
                <div>
                    <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                        <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-qb-blue to-qb-cyan text-white shrink-0">
                            <Calendar size={18} />
                        </span>
                        予定数ダッシュボード
                    </h2>
                    <p className="text-sm font-bold text-ink-soft mt-1.5">有休・公出・研修・会議の予定数を管理</p>
                </div>

                <div className="flex items-center gap-2 bg-white/70 p-2 rounded-2xl border border-line">
                    <label className="text-xs font-bold text-ink-soft px-1">対象月</label>
                    <input
                        type="month"
                        value={targetMonthStr}
                        onChange={handleMonthChange}
                        className="tabular bg-white border border-line text-ink font-bold rounded-xl px-3 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-qb-cyan"
                    />
                </div>
            </div>

            {/* 案内 */}
            <div className="bg-qb-cyan/10 border border-qb-cyan/25 p-4 rounded-2xl flex items-start gap-3">
                <Info className="text-qb-blue shrink-0 mt-0.5" size={18} />
                <p className="text-sm font-bold text-ink leading-relaxed">
                    月末日18:00までに、翌々月の予定数を入力してください。<br/>
                    <span className="text-ink-soft">例: 5月末日までに7月分の予定数を送信。</span>
                </p>
            </div>

            <div className="space-y-4">
                {storeGroups.map(group => {
                    if (group.staffs.length === 0) return null;
                    const isExpanded = expandedStores.includes(group.store.id);

                    const storeTotals = group.staffs.reduce((acc, staff) => {
                        const plan = leavePlans.find(p => p.staffId === staff.id);
                        if (plan) {
                            acc.paidLeave += plan.paidLeave || 0;
                            acc.publicWork += plan.publicWork || 0;
                            acc.training += plan.training || 0;
                            acc.meeting += plan.meeting || 0;
                        }
                        return acc;
                    }, { paidLeave: 0, publicWork: 0, training: 0, meeting: 0 });

                    return (
                        <div key={group.store.id} className="glass rounded-3xl overflow-hidden">
                            <button
                                type="button"
                                onClick={() => toggleStore(group.store.id)}
                                className="w-full text-left p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/40 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-bold text-ink">{group.store.name}</h3>
                                    <span className="bg-qb-navy/5 px-2.5 py-1 rounded-full text-xs font-bold text-ink-soft">
                                        スタッフ {group.staffs.length}名
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="flex bg-qb-blue/8 px-3 py-2 rounded-xl gap-4 flex-1 sm:flex-none justify-around">
                                        {FIELDS.map(f => (
                                            <div key={f.key} className="flex flex-col items-center">
                                                <span className="text-xs text-ink-soft font-bold">{f.label}</span>
                                                <span className="tabular text-base font-black text-qb-blue">{storeTotals[f.key]}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <ChevronDown className={`text-ink-soft transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} size={20} />
                                </div>
                            </button>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden border-t border-line bg-white/30"
                                    >
                                        <div className="p-4 sm:p-5 grid gap-3">
                                            {/* 一括登録オプション */}
                                            {group.staffs.length > 0 && (
                                                bulkConfirmStore === group.store.id ? (
                                                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-2xl flex flex-col gap-3">
                                                        <div className="flex items-start gap-2">
                                                            <AlertTriangle className="text-qb-yellow shrink-0 mt-0.5" size={18} />
                                                            <p className="text-sm font-bold text-ink leading-relaxed">
                                                                {group.store.name}の全スタッフ（{group.staffs.length}名）の予定数を「すべて0」で一括登録します。個別入力済みの値も上書きされます。よろしいですか？
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetAllNoLeave(group.store.id, group.staffs)}
                                                                className="tap flex-1 rounded-xl bg-qb-blue text-white text-sm font-bold active:scale-95 transition-transform"
                                                            >
                                                                一括登録する
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setBulkConfirmStore(null)}
                                                                className="tap flex-1 rounded-xl bg-white text-ink-soft border border-line text-sm font-bold active:scale-95 transition-transform"
                                                            >
                                                                やめる
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-white/60 border border-line p-3.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <Umbrella className="text-qb-cyan shrink-0" size={18} />
                                                            <span className="text-sm font-bold text-ink-soft leading-normal">
                                                                全員が有休・公出・研修・会議なしの場合はこちら
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setBulkConfirmStore(group.store.id)}
                                                            className="tap w-full md:w-auto bg-white border border-qb-blue/30 text-qb-blue hover:bg-qb-blue/5 font-bold px-4 rounded-xl transition-all active:scale-95 text-sm"
                                                        >
                                                            全員まとめて「0」で登録
                                                        </button>
                                                    </div>
                                                )
                                            )}

                                            {group.staffs.map((staff:any) => {
                                                const plan = leavePlans.find(p => p.staffId === staff.id);
                                                const isEditing = editingStaffId === staff.id;
                                                const staffName = formatStaffName(`${staff.lastName} ${staff.firstName || ''}`) + (staff.role ? ` (${displayRole(staff.role)})` : '');
                                                const isFlash = flashStaffId === staff.id;

                                                return (
                                                    <div key={staff.id} className={`bg-white border rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between transition-colors ${isFlash ? 'border-success ring-2 ring-success/30' : 'border-line'}`}>
                                                        <div className="flex items-center gap-2 w-full md:w-40 shrink-0 font-bold text-ink">
                                                            {staffName}
                                                        </div>

                                                        {isEditing ? (
                                                            <div className="grid grid-cols-4 gap-2 w-full md:flex-1">
                                                                {FIELDS.map(f => (
                                                                    <div key={f.key} className="flex flex-col gap-1">
                                                                        <label className="text-xs font-bold text-ink-soft text-center">{f.label}</label>
                                                                        <input
                                                                            type="number"
                                                                            inputMode="numeric"
                                                                            min="0"
                                                                            value={editForm[f.key]}
                                                                            onFocus={e => e.target.select()}
                                                                            onChange={e => setEditForm({ ...editForm, [f.key]: Number(e.target.value) })}
                                                                            className="tabular w-full text-center min-h-[44px] rounded-xl border border-line text-ink font-bold focus:outline-none focus:ring-2 focus:ring-qb-cyan"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-4 gap-2 w-full md:flex-1 md:max-w-sm md:ml-auto">
                                                                {FIELDS.map(f => (
                                                                    <div key={f.key} className="flex flex-col items-center bg-canvas py-2 rounded-xl">
                                                                        <span className="text-xs text-ink-soft font-bold">{f.label}</span>
                                                                        <span className="tabular font-black text-ink">{plan?.[f.key] || 0}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="w-full md:w-auto flex justify-end shrink-0">
                                                            {isEditing ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => saveEdit(staff.id, group.store.id)}
                                                                    className="tap bg-success hover:brightness-105 text-white px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 w-full md:w-auto font-bold text-sm"
                                                                >
                                                                    <Save size={18} /> 保存
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startEdit(staff.id, plan)}
                                                                    className="tap bg-white border border-line text-ink-soft hover:border-qb-cyan hover:text-qb-blue px-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 w-full md:w-auto font-bold text-sm"
                                                                >
                                                                    <FileEdit size={18} /> 編集
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
