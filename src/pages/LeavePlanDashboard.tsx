import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useUsersStore } from '../store/useUsersStore';
import { useShiftStore } from '../store/useShiftStore';
import { useLeavePlanStore, LeavePlan } from '../store/useLeavePlanStore';
import { Calendar, ChevronDown, Save, FileEdit, CheckCircle } from 'lucide-react';
import { format, addMonths } from 'date-fns';

export const LeavePlanDashboard = () => {
    const { user, viewMode } = useAuthStore();
    const { users, init: initUsers } = useUsersStore();
    const { stores, staffs, initStores, initStaffs } = useShiftStore();
    const { leavePlans, initLeavePlans, saveLeavePlan, isLoading } = useLeavePlanStore();

    // デフォルトは翌々月
    const [targetMonthDate, setTargetMonthDate] = useState<Date>(() => addMonths(new Date(), 2));
    const targetMonthStr = format(targetMonthDate, 'yyyy-MM');

    const [expandedStores, setExpandedStores] = useState<string[]>([]);
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ paidLeave: 0, publicWork: 0, training: 0, meeting: 0 });

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
    const isAdmin = isBM || isAM;

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
    };

    // グルーピング
    const storeGroups = useMemo(() => {
        const groups = stores.map(store => ({
            store,
            staffs: mixedStaffs.filter((s:any) => s.storeId === store.id)
        }));
        
        const unassignedStaffs = mixedStaffs.filter((s:any) => !stores.some(st => st.id === s.storeId));
        if (unassignedStaffs.length > 0) {
            groups.push({ store: { id: 'unassigned', name: '未割り当て' } as Record<string,any>, staffs: unassignedStaffs });
        }
        
        if (!isAdmin) {
            // 店長の場合は自分の店舗のみ
            const myStore = stores.find(s => s.name === user?.storeName);
            if (myStore) {
                return groups.filter(g => g.store.id === myStore.id);
            }
            return [];
        }
        return groups;
    }, [stores, mixedStaffs, isAdmin, user?.storeName]);

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 pb-24 space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <Calendar className="text-paradise-ocean" /> 予定数ダッシュボード
                    </h2>
                    <p className="text-sm font-bold text-gray-500 mt-1">有休・公出・研修・会議の予定数を管理</p>
                </div>
                
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                    <label className="text-xs font-bold text-gray-500 px-2 uppercase">対象月</label>
                    <input 
                        type="month" 
                        value={targetMonthStr}
                        onChange={handleMonthChange}
                        className="bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-paradise-ocean/50"
                    />
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                <span className="text-xl">ℹ️</span>
                <p className="text-sm font-bold text-blue-800 leading-relaxed">
                    月末日18:00までに、翌々月の予定数を入力してください。<br/>
                    <span className="text-blue-600 font-medium">例: 5月末日までに7月分の予定数を送信。</span>
                </p>
            </div>

            <div className="space-y-4">
                {storeGroups.map(group => {
                    if (group.staffs.length === 0) return null;
                    const isExpanded = expandedStores.includes(group.store.id);
                    
                    // 店舗内の合計を計算
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
                        <div key={group.store.id} className="bg-white/80 border border-gray-200 rounded-3xl overflow-hidden shadow-sm transition-all">
                            <div 
                                onClick={() => toggleStore(group.store.id)}
                                className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-white transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-black text-gray-800">{group.store.name}</h3>
                                    <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-bold text-gray-500">
                                        スタッフ {group.staffs.length}名
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                                    <div className="flex bg-paradise-ocean/10 px-3 py-1.5 rounded-xl gap-3">
                                        <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">有休</span><span className="text-sm font-black text-paradise-ocean">{storeTotals.paidLeave}</span></div>
                                        <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">公出</span><span className="text-sm font-black text-paradise-ocean">{storeTotals.publicWork}</span></div>
                                        <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">研修</span><span className="text-sm font-black text-paradise-ocean">{storeTotals.training}</span></div>
                                        <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">会議</span><span className="text-sm font-black text-paradise-ocean">{storeTotals.meeting}</span></div>
                                    </div>
                                    <ChevronDown className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={20} />
                                </div>
                            </div>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden border-t border-gray-100 bg-gray-50/50"
                                    >
                                        <div className="p-4 sm:p-5 grid gap-3">
                                            {group.staffs.map((staff:any) => {
                                                const plan = leavePlans.find(p => p.staffId === staff.id);
                                                const isEditing = editingStaffId === staff.id;
                                                const staffName = `${staff.lastName} ${staff.firstName || ''}`.trim() + (staff.role ? ` (${staff.role})` : '');

                                                return (
                                                    <div key={staff.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 justify-between shadow-sm">
                                                        <div className="flex items-center gap-3 w-full md:w-auto font-bold text-gray-700">
                                                            {staffName}
                                                        </div>

                                                        {isEditing ? (
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full md:w-auto flex-1">
                                                                <div className="flex flex-col gap-1">
                                                                    <label className="text-[10px] uppercase font-bold text-gray-500 text-center">有休</label>
                                                                    <input type="number" min="0" value={editForm.paidLeave} onChange={e => setEditForm({...editForm, paidLeave: Number(e.target.value)})} className="w-full text-center p-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean" />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <label className="text-[10px] uppercase font-bold text-gray-500 text-center">公出</label>
                                                                    <input type="number" min="0" value={editForm.publicWork} onChange={e => setEditForm({...editForm, publicWork: Number(e.target.value)})} className="w-full text-center p-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean" />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <label className="text-[10px] uppercase font-bold text-gray-500 text-center">研修</label>
                                                                    <input type="number" min="0" value={editForm.training} onChange={e => setEditForm({...editForm, training: Number(e.target.value)})} className="w-full text-center p-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean" />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <label className="text-[10px] uppercase font-bold text-gray-500 text-center">会議</label>
                                                                    <input type="number" min="0" value={editForm.meeting} onChange={e => setEditForm({...editForm, meeting: Number(e.target.value)})} className="w-full text-center p-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean" />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-4 gap-4 w-full md:w-auto flex-1 max-w-sm ml-auto">
                                                                <div className="flex flex-col items-center bg-gray-50 py-2 rounded-xl"><span className="text-[10px] text-gray-400 font-bold uppercase">有休</span><span className="font-black text-gray-700">{plan?.paidLeave || 0}</span></div>
                                                                <div className="flex flex-col items-center bg-gray-50 py-2 rounded-xl"><span className="text-[10px] text-gray-400 font-bold uppercase">公出</span><span className="font-black text-gray-700">{plan?.publicWork || 0}</span></div>
                                                                <div className="flex flex-col items-center bg-gray-50 py-2 rounded-xl"><span className="text-[10px] text-gray-400 font-bold uppercase">研修</span><span className="font-black text-gray-700">{plan?.training || 0}</span></div>
                                                                <div className="flex flex-col items-center bg-gray-50 py-2 rounded-xl"><span className="text-[10px] text-gray-400 font-bold uppercase">会議</span><span className="font-black text-gray-700">{plan?.meeting || 0}</span></div>
                                                            </div>
                                                        )}

                                                        <div className="w-full md:w-auto flex justify-end shrink-0">
                                                            {isEditing ? (
                                                                <button 
                                                                    onClick={() => saveEdit(staff.id, group.store.id)}
                                                                    className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center w-full md:w-auto"
                                                                >
                                                                    <Save size={18} className="md:mr-0" /> <span className="md:hidden ml-2 font-bold">保存</span>
                                                                </button>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => startEdit(staff.id, plan)}
                                                                    className="bg-white border-2 border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 p-3 rounded-xl transition-all active:scale-95 flex items-center justify-center w-full md:w-auto"
                                                                >
                                                                    <FileEdit size={18} className="md:mr-0" /> <span className="md:hidden ml-2 font-bold">編集</span>
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
