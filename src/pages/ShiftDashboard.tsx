import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useUsersStore } from '../store/useUsersStore';
import { useShiftStore, Store, Staff, ShiftRequest, ShiftRequestType } from '../store/useShiftStore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar, Settings, Users, ChevronLeft, ChevronRight, Plus, X, AlertCircle, Megaphone, ChevronDown, Stars, CheckCircle, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnnouncementStore } from '../store/useAnnouncementStore';
import * as JapaneseHolidays from 'japanese-holidays';
import { displayRole, formatStaffName } from '../lib/formatUtils';
import { MetricBar, DeltaBadge } from '../components/ui/Indicators';

const isHoliday = (date: Date) => getDay(date) === 0 || JapaneseHolidays.isHoliday(date) !== undefined;

export const ShiftDashboard = () => {
    const { user, viewMode, setViewMode } = useAuthStore();
    const { users, init: initUsers } = useUsersStore();
    const { stores, staffs, shiftRequests, initStores, initStaffs, initShiftRequests, saveStore, saveStaff, saveShiftRequest, deleteShiftRequest, deleteStore, deleteStaff } = useShiftStore();
    const [currentDate, setCurrentDate] = useState(addMonths(new Date(), 1));
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'calendar' | 'approvals' | 'all-requests' | 'stores' | 'staffs'>('calendar');

    useEffect(() => {
        const unsubStores = initStores();
        const unsubStaffs = initStaffs();
        const unsubUsers = initUsers();
        return () => {
            unsubStores();
            unsubStaffs();
            unsubUsers();
        };
    }, []);

    useEffect(() => {
        const prefix = format(currentDate, 'yyyy-MM');
        const unsub = initShiftRequests(prefix, user ? {role: user.role, storeName: user.storeName, uid: user.uid} : undefined);
        return () => unsub();
    }, [currentDate, user?.uid]);

    // Ensure a store is selected by default if available
    useEffect(() => {
        if (!selectedStoreId) {
            setSelectedStoreId('all');
        }
    }, [selectedStoreId]);

    const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;
    const isAdmin = activeRole === 'BM';
    const isBMTrue = user?.role === 'BM';

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
            <h1 className="text-xl font-bold text-ink flex items-center gap-2">
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-qb-blue to-qb-cyan text-white shrink-0">
                    <Calendar size={18} />
                </span>
                シフト希望・稼働管理
            </h1>

            {/* View Selector */}
            {/* View Selector */}
            <div className="flex overflow-x-auto no-scrollbar bg-white/50 p-1 rounded-2xl glass w-full sm:w-fit mb-4">
                <button 
                    onClick={() => setActiveTab('calendar')}
                    className={`flex whitespace-nowrap items-center justify-center gap-1.5 px-3 py-2.5 sm:px-6 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all flex-1 sm:flex-none ${activeTab === 'calendar' ? 'bg-paradise-ocean text-white shadow-lg' : 'text-gray-600 hover:bg-white/50'}`}
                >
                    <Calendar size={16} /> <span className="hidden sm:inline">稼働カレンダー</span><span className="sm:hidden">稼働</span>
                </button>
                <button 
                    onClick={() => setActiveTab('approvals')}
                    className={`flex whitespace-nowrap items-center justify-center gap-1.5 px-3 py-2.5 sm:px-6 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all flex-1 sm:flex-none ${activeTab === 'approvals' ? 'bg-paradise-ocean text-white shadow-lg' : 'text-gray-600 hover:bg-white/50'}`}
                >
                    <CheckCircle size={16} /> 承認
                    {shiftRequests.some((r:any) => r.status === 'pending') && <span className="bg-qb-red text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse">!</span>}
                </button>
                {(activeRole === 'BM' || activeRole === 'AM' || activeRole === '店長') && (
                    <button 
                        onClick={() => setActiveTab('all-requests')}
                        className={`flex whitespace-nowrap items-center justify-center gap-1.5 px-3 py-2.5 sm:px-6 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all flex-1 sm:flex-none ${activeTab === 'all-requests' ? 'bg-paradise-ocean text-white shadow-lg' : 'text-gray-600 hover:bg-white/50'}`}
                    >
                        <List size={16} /> <span className="hidden sm:inline">希望休一覧</span><span className="sm:hidden">希望休</span>
                    </button>
                )}
                {isAdmin && (
                    <>
                        <button 
                            onClick={() => setActiveTab('stores')}
                            className={`flex whitespace-nowrap items-center justify-center gap-1.5 px-3 py-2.5 sm:px-6 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all flex-1 sm:flex-none ${activeTab === 'stores' ? 'bg-paradise-ocean text-white shadow-lg' : 'text-gray-600 hover:bg-white/50'}`}
                        >
                            <Settings size={16} /> 店舗
                        </button>
                        <button 
                            onClick={() => setActiveTab('staffs')}
                            className={`flex whitespace-nowrap items-center justify-center gap-1.5 px-3 py-2.5 sm:px-6 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all flex-1 sm:flex-none ${activeTab === 'staffs' ? 'bg-paradise-ocean text-white shadow-lg' : 'text-gray-600 hover:bg-white/50'}`}
                        >
                            <Users size={16} /> スタッフ
                        </button>
                    </>
                )}
            </div>

            {/* Main Content */}
            <div className="glass p-6 rounded-[2rem] border border-white/40 shadow-xl overflow-hidden min-h-[500px]">
                <AnimatePresence mode="wait">
                    {activeTab === 'calendar' && (
                        <motion.div key="calendar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <ShiftCalendarView 
                                stores={stores} 
                                staffs={staffs} 
                                requests={shiftRequests} 
                                currentDate={currentDate} 
                                setCurrentDate={setCurrentDate}
                                selectedStoreId={selectedStoreId}
                                setSelectedStoreId={setSelectedStoreId}
                            />
                        </motion.div>
                    )}
                    {activeTab === 'approvals' && (
                        <motion.div key="approvals" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <PendingApprovalsView 
                                stores={stores} 
                                staffs={staffs} 
                                requests={shiftRequests} 
                                currentDate={currentDate}
                                setCurrentDate={setCurrentDate}
                            />
                        </motion.div>
                    )}
                    {activeTab === 'all-requests' && (
                        <motion.div key="all-requests" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <AllRequestsView 
                                stores={stores} 
                                staffs={staffs} 
                                requests={shiftRequests} 
                                currentDate={currentDate}
                                setCurrentDate={setCurrentDate}
                            />
                        </motion.div>
                    )}
                    {activeTab === 'stores' && isAdmin && (
                        <motion.div key="stores" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <StoreSettings stores={stores} onSave={saveStore} onDelete={deleteStore} />
                        </motion.div>
                    )}
                    {activeTab === 'staffs' && isAdmin && (
                        <motion.div key="staffs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <StaffSettings stores={stores} staffs={staffs} onSave={saveStaff} onDelete={deleteStaff} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

// --- Sub Components ---

const AllRequestsView = ({ stores, staffs, requests, currentDate, setCurrentDate }: any) => {
    const { user, viewMode } = useAuthStore();
    const { users } = useUsersStore();
    const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
    const [sortMode, setSortMode] = useState<'staff' | 'submission_asc' | 'submission_desc' | 'date' | 'conflict'>('staff');

    const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;
    
    // Filter requests based on role and selected store
    const visibleRequests = requests.filter((r: any) => {
        const isUserAcc = r.staffId.startsWith('user_');
        let targetRole = 'staff';
        
        if (isUserAcc) {
            const uStore = users.find((u:any) => `user_${u.uid}` === r.staffId);
            if (uStore) targetRole = uStore.role;
        }

        // Store filter
        if (selectedStoreId !== 'all' && r.storeId !== selectedStoreId) return false;

        if (activeRole === 'BM') return true;
        if (activeRole === 'AM') return true; 
        if (activeRole === '店長') {
            const myStore = stores.find((s:any) => s.name === user?.storeName);
            return myStore ? r.storeId === myStore.id : false;
        }
        
        return false;
    });

    const getStaffName = (staffId: string) => {
        const staff = staffs.find((s:any) => s.id === staffId);
        const uStore = users.find((u:any) => `user_${u.uid}` === staffId);
        if (staff) {
            return formatStaffName(`${staff.lastName} ${staff.firstName}`);
        } else if (uStore) {
            return `${formatStaffName(uStore.name)} (${displayRole(uStore.role)})`;
        }
        return '不明なスタッフ';
    };

    const getStoreName = (storeId: string) => {
        const store = stores.find((s:any) => s.id === storeId);
        return store ? store.name : '不明な店舗';
    };

    // Prepare lists depending on sort mode
    const renderContent = () => {
        if (visibleRequests.length === 0) {
            return (
                <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 shadow-sm text-gray-400 font-bold">
                    希望休の申請はありません
                </div>
            );
        }

        if (sortMode === 'staff') {
            const requestsByStaff = visibleRequests.reduce((acc: any, req: any) => {
                if (!acc[req.staffId]) acc[req.staffId] = [];
                acc[req.staffId].push(req);
                return acc;
            }, {});

            return (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Object.entries(requestsByStaff).map(([staffId, reqs]: [string, any]) => {
                        const displayName = getStaffName(staffId);
                        const storeName = getStoreName(reqs[0]?.storeId);

                        return (
                            <div key={staffId} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-2">
                                <div>
                                    <h3 className="font-black text-sm text-gray-800">{displayName}</h3>
                                    <p className="text-xs text-gray-500 font-bold">{storeName}</p>
                                </div>
                                <div className="text-xs text-gray-500 font-bold">総申請数: {reqs.length} 件</div>
                                <div className="space-y-1.5">
                                    {reqs.sort((a:any, b:any) => a.date.localeCompare(b.date)).map((req: any) => (
                                        <RequestListItem key={req.id} req={req} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // Flat list for other sort modes
        const sortedRequests = [...visibleRequests].sort((a: any, b: any) => {
            if (sortMode === 'conflict') {
                const timeA = a.updatedAt || a.createdAt || 0;
                const timeB = b.updatedAt || b.createdAt || 0;
                if (timeB !== timeA) return timeB - timeA; // Descending (most recently updated/processed)
                return a.date.localeCompare(b.date);
            } else if (sortMode === 'submission_desc') {
                const timeA = a.createdAt || 0;
                const timeB = b.createdAt || 0;
                if (timeB !== timeA) return timeB - timeA; // Descending (newest submitted first)
                return b.date.localeCompare(a.date);
            } else if (sortMode === 'submission_asc') {
                const timeA = a.createdAt || 0;
                const timeB = b.createdAt || 0;
                if (timeA !== timeB) return timeA - timeB; // Ascending (oldest submitted first)
                return a.date.localeCompare(b.date);
            } else if (sortMode === 'date') {
                return a.date.localeCompare(b.date); // Ascending date
            }
            return 0;
        });

        return (
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2">
                {sortedRequests.map((req: any) => (
                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-50 last:border-0 gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                            <div>
                                <span className="font-bold text-sm text-gray-700">{format(new Date(req.date), 'M/d (E)', { locale: ja })}</span>
                            </div>
                            <div>
                                <span className="text-sm font-black text-gray-800">{getStaffName(req.staffId)}</span>
                                <span className="text-xs text-gray-500 font-bold ml-2">{getStoreName(req.storeId)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                                req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                req.status === 'approved' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                            }`}>
                                {req.status === 'pending' ? '承認待ち' : req.status === 'approved' ? '承認済' : '却下'}
                            </span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                                req.type === '希望休' ? 'bg-blue-100 text-blue-700' :
                                req.type === '有休' ? 'bg-orange-100 text-orange-700' :
                                req.type === 'フリー有休' ? 'bg-green-100 text-green-700' :
                                req.type === '公出' ? 'bg-pink-100 text-pink-700' :
                                'bg-purple-100 text-purple-700'
                            }`}>
                                {req.type}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm flex-col md:flex-row gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
                    <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-black text-gray-800 tracking-wider">
                        {format(currentDate, 'yyyy年 M月', { locale: ja })} 全希望休一覧
                    </h2>
                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
                    {(activeRole === 'BM' || activeRole === 'AM') && (
                        <select
                            value={selectedStoreId}
                            onChange={(e) => setSelectedStoreId(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-paradise-ocean focus:border-paradise-ocean block p-2 font-bold outline-none"
                        >
                            <option value="all">全店舗</option>
                            {stores.map((s:any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                    <select
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as any)}
                        className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-paradise-ocean focus:border-paradise-ocean block p-2 font-bold outline-none"
                    >
                        <option value="staff">スタッフ毎表示</option>
                        <option value="date">日付順表示</option>
                        <option value="submission_desc">申請順表示(新着順)</option>
                        <option value="submission_asc">申請順表示(早い順)</option>
                        <option value="conflict">希望休などのかぶり(対応順)</option>
                    </select>
                </div>
            </div>

            {renderContent()}
        </div>
    );
};

const RequestListItem = ({ req }: { req: any }) => (
    <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
        <div>
            <span className="font-bold text-xs text-gray-700">{format(new Date(req.date), 'M/d (E)', { locale: ja })}</span>
        </div>
        <div className="flex items-center gap-1">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                req.status === 'approved' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
            }`}>
                {req.status === 'pending' ? '承認待ち' : req.status === 'approved' ? '承認済' : '却下'}
            </span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                req.type === '希望休' ? 'bg-blue-100 text-blue-700' :
                req.type === '有休' ? 'bg-orange-100 text-orange-700' :
                req.type === 'フリー有休' ? 'bg-green-100 text-green-700' :
                req.type === '公出' ? 'bg-pink-100 text-pink-700' :
                'bg-purple-100 text-purple-700'
            }`}>
                {req.type}
            </span>
        </div>
    </div>
);

const PendingApprovalsView = ({ stores, staffs, requests, currentDate, setCurrentDate }: any) => {
    const { user, viewMode } = useAuthStore();
    const { users } = useUsersStore();
    const { saveShiftRequest } = useShiftStore();

    const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;
    
    // Group pending requests by staff
    const pendingRequests = requests.filter((r: any) => {
        if (r.status !== 'pending') return false;
        
        // Find staff or user
        const isUserAcc = r.staffId.startsWith('user_');
        let targetRole = 'staff';
        
        if (isUserAcc) {
            const uStore = users.find((u:any) => `user_${u.uid}` === r.staffId);
            if (uStore) targetRole = uStore.role;
        }

        // Filtering logic based on activeRole
        if (activeRole === 'BM') return true; // BM can approve anyone
        if (activeRole === 'AM') {
            // AM can approve staff and 店長
            return targetRole === 'staff' || targetRole === '店長';
        }
        if (activeRole === '店長') {
            // 店長 can only approve staff in their store
            if (targetRole !== 'staff') return false; // cannot approve AM or other 店長
            
            // Check if store matches
            // If they are user, they have user.storeName
            const myStore = stores.find((s:any) => s.name === user?.storeName);
            return myStore ? r.storeId === myStore.id : false;
        }
        
        return false;
    });
    
    const requestsByStaff = pendingRequests.reduce((acc: any, req: any) => {
        if (!acc[req.staffId]) {
            acc[req.staffId] = [];
        }
        acc[req.staffId].push(req);
        return acc;
    }, {});

    const handleApproveAll = async (staffId: string) => {
        const staffReqs = pendingRequests.filter((r:any) => r.staffId === staffId);
        for (const req of staffReqs) {
            await saveShiftRequest({ ...req, status: 'approved' });
        }
    };

    const handleRejectAll = async (staffId: string) => {
        const staffReqs = pendingRequests.filter((r:any) => r.staffId === staffId);
        for (const req of staffReqs) {
            await saveShiftRequest({ ...req, status: 'rejected' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-black text-gray-800 tracking-wider">
                        {format(currentDate, 'yyyy年 M月', { locale: ja })} 承認待ち
                    </h2>
                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {Object.keys(requestsByStaff).length === 0 ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 shadow-sm text-gray-400 font-bold">
                    承認待ちの申請はありません
                </div>
            ) : (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Object.entries(requestsByStaff).map(([staffId, reqs]: [string, any]) => {
                        const staff = staffs.find((s:any) => s.id === staffId);
                        const uStore = users.find((u:any) => `user_${u.uid}` === staffId);
                        const displayName = staff ? formatStaffName(`${staff.lastName} ${staff.firstName}`) : uStore ? `${formatStaffName(uStore.name)} (${displayRole(uStore.role)})` : '不明なスタッフ';
                        const storeName = staff ? stores.find((s:any) => s.id === staff.storeId)?.name : uStore?.storeName;

                        return (
                            <div key={staffId} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-2">
                                <div>
                                    <h3 className="font-black text-sm text-gray-800">{displayName}</h3>
                                    <p className="text-xs text-gray-500 font-bold">{storeName}</p>
                                </div>
                                
                                <div className="space-y-1.5 pr-2">
                                    {reqs.map((req: any) => (
                                        <div key={req.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                                            <div>
                                                <span className="font-bold text-xs text-gray-700">{format(new Date(req.date), 'M/d (E)', { locale: ja })}</span>
                                            </div>
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                                req.type === '希望休' ? 'bg-blue-100 text-blue-700' :
                                                req.type === '有休' ? 'bg-orange-100 text-orange-700' :
                                                req.type === 'フリー有休' ? 'bg-green-100 text-green-700' :
                                                'bg-purple-100 text-purple-700'
                                            }`}>
                                                {req.type}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button 
                                        onClick={() => handleRejectAll(staffId)}
                                        className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-lg transition text-xs"
                                    >
                                        すべて却下
                                    </button>
                                    <button 
                                        onClick={() => handleApproveAll(staffId)}
                                        className="flex-1 py-1.5 bg-paradise-ocean hover:bg-paradise-ocean/90 text-white font-bold rounded-lg transition text-xs"
                                    >
                                        すべて承認
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ShiftCalendarView = ({ stores, staffs, requests, currentDate, setCurrentDate, selectedStoreId, setSelectedStoreId }: any) => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const { user, viewMode } = useAuthStore();
    const { users } = useUsersStore();
    const { saveShiftRequest, deleteShiftRequest } = useShiftStore();

    const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;

    const mixedStaffs = useMemo(() => {
        const userStaffs = users.filter(u => u.role === '店長' || u.role === 'AM').map(u => {
            const uStore = stores.find(st => st.name === u.storeName);
            return {
                id: `user_${u.uid}`,
                lastName: u.name,
                firstName: '',
                storeId: uStore ? uStore.id : (u.storeName === '全店' ? 'all' : ''),
                employmentType: 'fulltime',
                monthlyOffDays: 8,
                weeklyWorkDays: 5,
                closedDaysOfWeek: [],
                closedDates: [],
                isUser: true,
                role: u.role
            };
        }).filter(u => {
            // ネイティブのスタッフに同姓同名の人が既に登録されている場合は弾く（二重カウント防止）
            const nativeExists = staffs.some(s => (s.lastName + (s.firstName || '')).replace(/\s/g, '') === u.lastName.replace(/\s/g, ''));
            return !nativeExists;
        });
        return [...staffs, ...userStaffs];
    }, [staffs, users, stores]);

    const currentStore = selectedStoreId === 'all' ? null : stores.find((s: any) => s.id === selectedStoreId);
    const storeStaffs = selectedStoreId === 'all' ? mixedStaffs : mixedStaffs.filter((s: any) => s.storeId === selectedStoreId);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = monthStart; 
    const endDate = monthEnd;

    const dateFormat = "d";
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const getRequiredStaffingForDay = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const day = getDay(date);

        const getStoreReq = (store: any) => {
            if (store.closedDaysOfWeek?.includes(day)) return 0;
            if (store.closedDates?.includes(dateStr)) return 0;
            
            const req = store.requiredStaffing;
            if (isHoliday(date)) return req.sundayHoliday || 0;
            if (day === 1) return req.monday || 0;
            if (day === 5) return req.friday || 0;
            if (day === 6) return req.saturday || 0;
            return req.weekday || 0;
        };

        if (selectedStoreId === 'all') {
            return stores.reduce((total: number, store: any) => total + getStoreReq(store), 0);
        }

        if (!currentStore) return 0;
        return getStoreReq(currentStore);
    };

    // Calculate Summary Metrics
    const daysInMonthCount = days.length;
    const fullTimeStaffs = storeStaffs.filter((s:any) => s.employmentType !== 'parttime');
    const ptWorkingFull = storeStaffs.filter((s:any) => s.employmentType === 'parttime' && s.defaultPtShiftType !== 'short');
    const ptStaffs = storeStaffs.filter((s:any) => s.employmentType === 'parttime');
    
    // FT and Full-PT combined base for calculations
    const ftStaffCount = fullTimeStaffs.length;
    const ftAndFullPtStaffCount = ftStaffCount + ptWorkingFull.length;
    const totalManDays = ftAndFullPtStaffCount * daysInMonthCount;

    // 総公休数 (FT + Full-PT)
    const totalOffDays = fullTimeStaffs.reduce((sum: number, s: any) => sum + (s.monthlyOffDays || 8), 0) +
                         ptWorkingFull.reduce((sum: number, s: any) => sum + (s.monthlyOffDays || 8), 0);
    // 出勤可能人工 (full time + full-time parttimer base)
    const ftAvailableManDays = totalManDays - totalOffDays;

    let totalRequiredStaffing = 0;
    days.forEach((day: Date) => {
        totalRequiredStaffing += getRequiredStaffingForDay(day);
    });

    const getRequestsForDay = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return requests.filter((r: any) => (selectedStoreId === 'all' || r.storeId === selectedStoreId) && r.date === dateStr);
    };

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-6">
                    <button onClick={handlePrevMonth} className="p-2 bg-white/50 rounded-full hover:bg-white text-gray-700 transition">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-black text-gray-800">
                        {format(currentDate, 'yyyy年 M月', { locale: ja })}
                    </h2>
                    <button onClick={handleNextMonth} className="p-2 bg-white/50 rounded-full hover:bg-white text-gray-700 transition">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <label className="font-bold text-base text-gray-600">対象店舗:</label>
                    <select
                        value={selectedStoreId}
                        onChange={e => setSelectedStoreId(e.target.value)}
                        className="px-4 py-2 rounded-xl bg-white/80 border border-white/50 hover:bg-white transition focus:outline-none focus:ring-2 focus:ring-paradise-ocean/50 font-bold text-gray-800"
                    >
                        <option value="all">全店舗（ブロック全体）</option>
                        {stores.length === 0 && <option value="" disabled>店舗がありません</option>}
                        {stores.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Monthly Summary Statistics */}
            {(() => {
                const surplus = ftAvailableManDays - totalRequiredStaffing;
                const coverage = totalRequiredStaffing > 0 ? (ftAvailableManDays / totalRequiredStaffing) * 100 : 100;
                const shortage = surplus < 0;
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* 過不足 ヒーロー */}
                        <div className={`glass rounded-3xl p-5 flex flex-col justify-between border ${shortage ? 'border-red-300/60' : 'border-emerald-300/50'}`}>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-ink-soft">当月の人工 過不足</span>
                                <DeltaBadge value={surplus} suffix="人工" />
                            </div>
                            <div className="flex items-end gap-2 mt-2">
                                <span className={`tabular text-5xl font-black leading-none ${shortage ? 'text-qb-red' : 'text-success'}`}>
                                    {surplus > 0 ? '+' : ''}{surplus}
                                </span>
                                <span className="mb-1 text-sm font-bold text-ink-soft">人工</span>
                            </div>
                            <div className="mt-4 space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-ink-soft">
                                    <span>必要人工に対する充足率</span>
                                    <span className="tabular text-ink">{Math.round(coverage)}%</span>
                                </div>
                                <MetricBar value={coverage} max={140} />
                            </div>
                            <p className="mt-3 text-xs font-bold text-ink-soft">対象: 正社員 + フルパート</p>
                        </div>

                        {/* 内訳グリッド */}
                        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                                { label: '暦日', value: daysInMonthCount, unit: '日', tone: 'text-ink' },
                                { label: 'スタッフ数', value: ftStaffCount, unit: '名', tone: 'text-ink', sub: ptStaffs.length > 0 ? `パート ${ptStaffs.length}名` : undefined },
                                { label: `総人工 (${ftAndFullPtStaffCount}名)`, value: totalManDays, unit: '', tone: 'text-ink' },
                                { label: '公休数 合計', value: totalOffDays, unit: '', tone: 'text-qb-yellow-ink' },
                                { label: '出勤可能人工', value: ftAvailableManDays, unit: '', tone: 'text-qb-blue' },
                                { label: '必要人工 合計', value: totalRequiredStaffing, unit: '', tone: 'text-qb-cyan' },
                            ].map((c) => (
                                <div key={c.label} className="glass rounded-2xl p-3.5 flex flex-col justify-between">
                                    <span className="text-xs font-bold text-ink-soft leading-tight">{c.label}</span>
                                    <div className="mt-1 flex items-end gap-1">
                                        <span className={`tabular text-2xl font-black leading-none ${c.tone === 'text-qb-yellow-ink' ? 'text-amber-600' : c.tone}`}>{c.value}</span>
                                        {c.unit && <span className="mb-0.5 text-xs font-bold text-ink-soft">{c.unit}</span>}
                                    </div>
                                    {c.sub && <span className="mt-0.5 text-xs font-bold text-qb-gray">{c.sub}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            <div className="grid grid-cols-7 gap-1 md:gap-3">
                {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                    <div key={d} className={`text-center font-bold text-xs md:text-sm py-1 md:py-2 rounded-lg md:rounded-xl shadow-sm ${i === 0 ? 'bg-red-100 text-red-600' : i === 6 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100/50 text-gray-600'}`}>
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 md:gap-3 mt-1 md:mt-3">
                 {/* Offset for start of month */}
                 {Array.from({ length: getDay(startDate) }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-16 md:h-24 bg-transparent" />
                ))}

                {days.map(day => {
                    const reqStaffCount = getRequiredStaffingForDay(day);
                    const dayRequests = getRequestsForDay(day);
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayOfWeek = getDay(day);
                    
                    const isStaffAbsent = (staff: any) => {
                        const req = dayRequests.find((r:any) => r.staffId === staff.id && r.status !== 'rejected');
                        if (req && req.type === '公出') return false; // Overrides closed days
                        if (req && ['希望休', '有休', '特休', '会議', '研修', 'その他'].includes(req.type)) return true;

                        const sStore = selectedStoreId === 'all' ? stores.find((st:any) => st.id === staff.storeId) : currentStore;
                        if (sStore) {
                            if (sStore.closedDaysOfWeek?.includes(dayOfWeek)) return true;
                            if (sStore.closedDates?.includes(dateStr)) return true;
                        }

                        if (staff.closedDaysOfWeek?.includes(dayOfWeek)) return true;
                        if (staff.closedDates?.includes(dateStr)) return true;
                        return false;
                    };

                    const workingFullStaff = storeStaffs.filter((s:any) => !isStaffAbsent(s) && (s.employmentType !== 'parttime' || s.defaultPtShiftType !== 'short'));
                    const workingShortStaff = storeStaffs.filter((s:any) => !isStaffAbsent(s) && s.employmentType === 'parttime' && s.defaultPtShiftType === 'short');
                    const absentStaff = storeStaffs.filter((s:any) => isStaffAbsent(s));
                    
                    const availableStaff = workingFullStaff.length;
                    const deficiency = availableStaff - reqStaffCount;
                    const hasDeficiency = deficiency < 0 && reqStaffCount > 0;
                    
                    const totalPossibleWorkers = storeStaffs.filter((s:any) => s.employmentType !== 'parttime' || s.defaultPtShiftType !== 'short').length;
                    const maxLeaves = totalPossibleWorkers - reqStaffCount;

                    // 人工過不足を主役に。休業/必要なし日は中立表示にして誤アラートを防ぐ。
                    const isClosedDay = reqStaffCount === 0;
                    const surplusTone = hasDeficiency
                        ? { bg: 'bg-red-100', text: 'text-qb-red' }
                        : deficiency === 0
                            ? { bg: 'bg-amber-100', text: 'text-amber-600' }   // ちょうど＝余裕なし
                            : { bg: 'bg-emerald-100', text: 'text-success' };  // 余裕あり

                    return (
                        <div 
                            key={day.toString()} 
                            onClick={() => setSelectedDate(day)}
                            className={`min-h-[80px] md:min-h-[100px] bg-white hover:bg-blue-50/50 p-1 md:p-2 rounded-lg md:rounded-2xl border-2 ${hasDeficiency ? 'border-red-400 bg-red-50/30' : 'border-transparent'} shadow-sm cursor-pointer transition-all hover:-translate-y-1 overflow-hidden`}
                        >
                            <div className="flex items-center justify-between gap-0.5">
                                <span className={`text-xs md:text-base font-black w-5 h-5 md:w-7 md:h-7 flex items-center justify-center rounded-full shrink-0 ${isSameDay(day, new Date()) ? 'bg-paradise-sunset text-white' : isHoliday(day) ? 'text-red-500' : getDay(day) === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                                    {format(day, dateFormat)}
                                </span>
                                {hasDeficiency && (
                                    <AlertCircle size={14} className="text-red-500 animate-pulse shrink-0 md:w-4 md:h-4" />
                                )}
                            </div>

                            {isClosedDay ? (
                                <div className="mt-1 md:mt-2 flex items-center justify-center rounded-lg bg-gray-100 py-1.5">
                                    <span className="text-[11px] md:text-sm font-bold text-qb-gray">休業</span>
                                </div>
                            ) : (
                                <div className="mt-1 md:mt-2">
                                    {/* 人工過不足（主役）：+余裕 / −不足 を符号と色で即判別 */}
                                    <div className={`rounded-lg py-0.5 md:py-1 text-center leading-none ${surplusTone.bg}`}>
                                        <span className={`tabular text-lg md:text-2xl font-black ${surplusTone.text}`}>
                                            {deficiency > 0 ? '+' : ''}{deficiency}
                                        </span>
                                    </div>
                                    {/* 稼働 / 必要（補足） */}
                                    <div className="mt-0.5 text-center tabular text-[10px] md:text-xs font-bold text-ink-soft leading-none">
                                        稼{availableStaff}<span className="text-line mx-px">·</span>必{reqStaffCount}
                                    </div>
                                </div>
                            )}

                            {(maxLeaves > 0 || absentStaff.length > 0 || workingShortStaff.length > 0) && (
                                <div className="mt-0.5 md:mt-1 flex flex-wrap justify-center gap-x-1.5 leading-none">
                                    {maxLeaves > 0 && <span className="tabular text-[10px] md:text-xs font-bold text-qb-blue">休{maxLeaves}</span>}
                                    {absentStaff.length > 0 && <span className="tabular text-[10px] md:text-xs font-bold text-qb-gray">不{absentStaff.length}</span>}
                                    {workingShortStaff.length > 0 && <span className="tabular text-[10px] md:text-xs font-bold text-qb-gray">短{workingShortStaff.length}</span>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Request Input Modal */}
            <AnimatePresence>
                {selectedDate && (
                    <DayRequestsModal 
                        date={selectedDate} 
                        store={currentStore}
                        stores={stores}
                        isAllStores={selectedStoreId === 'all'}
                        allStaffs={mixedStaffs}
                        monthRequests={requests}
                        allRequests={requests.filter((r:any) => r.date === format(selectedDate, 'yyyy-MM-dd'))}
                        staffs={storeStaffs}
                        requests={getRequestsForDay(selectedDate)}
                        onClose={() => setSelectedDate(null)}
                        onSave={saveShiftRequest}
                        onDelete={deleteShiftRequest}
                        user={user}
                        reqCount={getRequiredStaffingForDay(selectedDate)}
                        isHoliday={isHoliday}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const DayRequestsModal = ({ date, store, staffs, requests, onClose, onSave, onDelete, user, reqCount, isAllStores, stores, allStaffs, allRequests, monthRequests, isHoliday }: any) => {
    const { users } = useUsersStore();
    const { viewMode } = useAuthStore();
    const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = getDay(date);
    const [staffId, setStaffId] = useState('');
    const [type, setType] = useState<ShiftRequestType>('希望休');
    const [notes, setNotes] = useState('');

    const isStaffAbsent = (staff: any) => {
        const req = requests.find((r:any) => r.staffId === staff.id && r.status !== 'rejected');
        if (req && req.type === '公出') return false; // Overrides closed days
        if (req && ['希望休', '有休', '特休', '会議', '研修', 'その他'].includes(req.type)) return true;

        const sStore = stores.find((st:any) => st.id === staff.storeId) || store;
        if (sStore) {
            if (sStore.closedDaysOfWeek?.includes(dayOfWeek)) return true;
            if (sStore.closedDates?.includes(dateStr)) return true;
        }

        if (staff.closedDaysOfWeek?.includes(dayOfWeek)) return true;
        if (staff.closedDates?.includes(dateStr)) return true;
        return false;
    };

    const workingFullStaff = staffs.filter((s:any) => !isStaffAbsent(s) && (s.employmentType !== 'parttime' || s.defaultPtShiftType !== 'short'));
    const availableStaff = workingFullStaff.length;
    const deficiency = availableStaff - reqCount;
    // Check if adding the selected staff to absence will cause deficiency
    const selectedStaffAbsentAlready = requests.some((r:any) => r.staffId === staffId);
    const willCauseDeficiency = staffId && !selectedStaffAbsentAlready && (availableStaff - 1 - reqCount < 0);

    const surplusStores = useMemo(() => {
        if (!stores || !allStaffs || !allRequests) return [];
        return stores.map((st: any) => {
            if (!isAllStores && st.id === store?.id) return null;
            
            const req = st.requiredStaffing;
            let stReqCount = 0;
            if (st.closedDaysOfWeek?.includes(dayOfWeek) || st.closedDates?.includes(dateStr)) {
                stReqCount = 0;
            } else if (isHoliday(date)) {
                stReqCount = req.sundayHoliday || 0;
            } else if (dayOfWeek === 1) { stReqCount = req.monday || 0; }
            else if (dayOfWeek === 5) { stReqCount = req.friday || 0; }
            else if (dayOfWeek === 6) { stReqCount = req.saturday || 0; }
            else { stReqCount = req.weekday || 0; }

            const stStaffs = allStaffs.filter((s:any) => s.storeId === st.id);
            const stReqs = allRequests.filter((r:any) => r.storeId === st.id);
            
            const isSStaffAbsent = (s: any) => {
                if (s.closedDaysOfWeek?.includes(dayOfWeek)) return true;
                if (s.closedDates?.includes(dateStr)) return true;
                return stReqs.some((r:any) => r.staffId === s.id);
            };

            const sWorkingFullStaff = stStaffs.filter((s:any) => !isSStaffAbsent(s) && (s.employmentType !== 'parttime' || s.defaultPtShiftType !== 'short'));
            const sAvailableStaff = sWorkingFullStaff.length;
            const sDeficiency = sAvailableStaff - stReqCount;
            
            if (sDeficiency > 0) {
                return { id: st.id, name: st.name, surplus: sDeficiency };
            }
            return null;
        }).filter(Boolean);
    }, [stores, allStaffs, allRequests, date, isAllStores, store, dayOfWeek, dateStr, isHoliday]);

    // Calculate selected staff leave balance for the month
    const staffBalance = useMemo(() => {
        if (!staffId) return null;

        const currentStaff = allStaffs.find((s:any) => s.id === staffId);
        if (!currentStaff) return null;

        // monthRequests has the entire month's requests for all staffs.
        // We only care about this staff's requests this month
        // Also need to count fixed off days for this month (which we can approximate if we just do it for 31 days or properly by looping current month dates? We don't have month 'days' inside modal directly, we can generate from 'date')
        const startOfMonthDate = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonthDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const monthDates = eachDayOfInterval({ start: startOfMonthDate, end: endOfMonthDate });

        let fixedOffCount = 0;
        monthDates.forEach(d => {
            const dDay = getDay(d);
            const dStr = format(d, 'yyyy-MM-dd');
            if (currentStaff.closedDaysOfWeek?.includes(dDay) || currentStaff.closedDates?.includes(dStr)) {
                fixedOffCount++;
            }
        });

        const reqOffCount = (monthRequests || []).filter((r:any) => {
            const reqDate = new Date(r.date);
            return r.staffId === staffId && 
                   reqDate >= startOfMonthDate && 
                   reqDate <= endOfMonthDate && 
                   ['希望休', '有休', '特休'].includes(r.type);
        }).length;

        const totalOff = fixedOffCount + reqOffCount;
        
        return {
            totalOff,
            contractOff: currentStaff.employmentType === 'parttime' ? null : (currentStaff.monthlyOffDays || 8),
            weeklyWorkDays: currentStaff.employmentType === 'parttime' ? (currentStaff.weeklyWorkDays || 3) : null,
            name: currentStaff.isUser ? `[${displayRole(currentStaff.role)}] ${formatStaffName(currentStaff.lastName)}` : formatStaffName(`${currentStaff.lastName} ${currentStaff.firstName}`)
        };
    }, [staffId, allStaffs, monthRequests, date]);

    const handleSubmit = async () => {
        if (!staffId) return;
        
        let derivedStoreId = store?.id || '';
        if (staffId.startsWith('user_')) {
            // It's a user, they don't have a specific storeId in shift requests usually or maybe they do?
            // Just use the currently selected store or 'unassigned' if it's 'all'
            derivedStoreId = isAllStores ? 'unassigned' : store?.id || '';
        } else {
            const selectedStaff = staffs.find((s:any) => s.id === staffId);
            derivedStoreId = isAllStores ? selectedStaff?.storeId : store.id;
        }

        const requestData: any = {
            id: '',
            staffId,
            storeId: derivedStoreId,
            date: dateStr,
            type,
            status: 'pending',
            submittedBy: user?.uid,
            notes
        };

        await onSave(requestData);
        
        setStaffId('');
        setNotes('');
    };

    const handleSendAnnouncement = async () => {
        const formattedDate = format(date, 'M月d日(E)', { locale: ja });
        const targetName = isAllStores ? '全店舗（ブロック全体）' : store.name;
        const title = `【急募】${targetName}の ${formattedDate} シフト調整のお願い`;
        const content = `<p><strong>${targetName}</strong> にて、<strong>${formattedDate}</strong> の稼働スタッフが <strong>${Math.abs(deficiency)}名</strong> 不足しています。</p><p>希望休を取得されている方で、もし出勤可能な方がいらっしゃいましたら、ご協力をお願いいたします。</p>`;
        
        await useAnnouncementStore.getState().addAnnouncement({
            title,
            content,
            isImportant: true,
            displayUntil: format(addDays(date, 1), "yyyy-MM-dd'T'HH:mm"),
            authorId: user!.uid,
            authorName: user!.name,
            authorRole: user!.role
        });
        
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl"
            >
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-black text-gray-800">{format(date, 'yyyy年M月d日 (E)', { locale: ja })}</h3>
                        <p className="text-base font-bold text-gray-500">{isAllStores ? '全店舗（ブロック全体）' : store?.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex gap-4 mb-6">
                   <div className="flex-1 bg-gray-50 rounded-2xl p-4 text-center">
                       <p className="text-sm text-gray-500 font-bold">必要席稼働</p>
                       <p className="text-2xl font-black text-gray-800">{reqCount}<span className="text-base font-bold ml-1">名</span></p>
                   </div>
                   <div className={`flex-1 rounded-2xl p-4 text-center ${deficiency < 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50'}`}>
                       <p className="text-sm font-bold mb-1">実稼働見込み</p>
                       <p className={`text-2xl font-black ${deficiency < 0 ? 'text-red-600' : 'text-green-600'}`}>{availableStaff}<span className="text-base font-bold ml-1">名</span></p>
                       {deficiency < 0 && <span className="block text-xs text-red-500 font-bold">不足: {Math.abs(deficiency)}名</span>}
                   </div>
                </div>

                {deficiency < 0 && (activeRole === 'BM' || activeRole === 'AM' || activeRole === '店長') && (
                    <div className="mb-6">
                        <button 
                            onClick={handleSendAnnouncement}
                            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition transform active:scale-95"
                        >
                            <Megaphone size={18} className="animate-pulse" /> 全体へ希望休調整のお願いを送信
                        </button>
                    </div>
                )}

                {/* Submit New Request */}
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-4 mb-6">
                    <h4 className="font-bold text-base text-gray-700">予定・希望休の追加</h4>
                    
                    {willCauseDeficiency && surplusStores.length > 0 && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-sm space-y-2">
                            <p className="text-red-700 font-bold flex items-center"><AlertCircle size={14} className="mr-1" />【要注意】休可枠を超過します</p>
                            <p className="text-red-600">この予定を追加すると稼働が不足します。以下の<strong>人員に余裕がある（＋状況）店舗</strong>へのヘルプ要請を推奨します：</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {surplusStores.map((st:any) => (
                                    <span key={st.id} className="bg-white border border-red-200 text-red-600 px-2 py-0.5 rounded flex items-center font-bold">{st.name} (+{st.surplus})</span>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {staffBalance && (
                        <div className="bg-white p-2 md:p-3 rounded-xl border border-blue-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center text-sm gap-2 md:gap-0">
                            <span className="font-bold text-gray-700">{staffBalance.name} の当月公休状況</span>
                            <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
                                {staffBalance.contractOff !== null ? (
                                    <>
                                        <div className="text-center">
                                            <div className="text-xs text-ink-soft font-bold">契約公休</div>
                                            <div className="font-black text-gray-800">{staffBalance.contractOff}日</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xs text-ink-soft font-bold">取得済(固定含)</div>
                                            <div className={`font-black ${staffBalance.totalOff > staffBalance.contractOff ? 'text-red-600' : 'text-blue-600'}`}>{staffBalance.totalOff}日</div>
                                        </div>
                                        <div className="text-center bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                            <div className="text-xs text-ink-soft font-bold">過不足</div>
                                            <div className={`font-black ${staffBalance.totalOff > staffBalance.contractOff ? 'text-red-600' : staffBalance.totalOff < staffBalance.contractOff ? 'text-orange-500' : 'text-green-600'}`}>
                                                {staffBalance.contractOff - staffBalance.totalOff > 0 ? '+' : ''}{staffBalance.contractOff - staffBalance.totalOff}日
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-center">
                                            <div className="text-xs text-ink-soft font-bold">週契約出勤</div>
                                            <div className="font-black text-gray-800">{staffBalance.weeklyWorkDays}日</div>
                                        </div>
                                        <div className="text-center bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                            <div className="text-xs text-ink-soft font-bold">当月総休数</div>
                                            <div className="font-black text-blue-600">{staffBalance.totalOff}日</div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-2">
                        <select value={staffId} onChange={e => setStaffId(e.target.value)} className="w-full md:flex-1 min-h-[44px] px-3 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-qb-cyan text-base font-bold text-ink">
                            <option value="">スタッフ選択...</option>
                            {[...stores, { id: 'unassigned', name: '未割り当て/全店舗対応' }]
                                .filter((st:any) => isAllStores || st.id === store?.id || st.id === 'unassigned')
                                .map((st:any) => {
                                    const stStaffs = staffs.filter((s:any) => s.storeId === st.id || (st.id === 'unassigned' && (!s.storeId || s.storeId === 'all')));
                                    if (stStaffs.length === 0) return null;
                                    return (
                                        <optgroup key={st.id} label={st.name}>
                                            {stStaffs.map((s:any) => (
                                                <option key={s.id} value={s.id} disabled={requests.some((r:any) => r.staffId === s.id)}>
                                                    {s.isUser ? `[${displayRole(s.role)}] ${formatStaffName(s.lastName)}` : formatStaffName(`${s.lastName} ${s.firstName}`)} {s.employmentType === 'parttime' ? `(${s.defaultPtShiftType === 'short' ? '時短' : 'フル'})` : ''}
                                                </option>
                                            ))}
                                        </optgroup>
                                    );
                                })
                            }
                        </select>
                        <select value={type} onChange={e => setType(e.target.value as any)} className="w-full md:w-1/3 min-h-[44px] px-3 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-qb-cyan text-base font-bold text-ink">
                            <option value="希望休">希望休</option>
                            <option value="有休">有休</option>
                            <option value="特休">特休</option>
                            <option value="会議">会議</option>
                            <option value="研修">研修</option>
                            <option value="その他">その他</option>
                            <option value="公出">公出</option>
                        </select>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2">
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="備考（任意）" className="w-full min-h-[44px] px-3 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-qb-cyan text-base text-ink" />
                        <button onClick={handleSubmit} className="tap w-full md:w-auto px-5 bg-qb-blue text-white font-bold rounded-xl hover:brightness-105 active:scale-95 transition shadow-sm text-base whitespace-nowrap">
                            追加
                        </button>
                    </div>
                </div>

                {/* List of Requests */}
                <div className="space-y-2">
                    <h4 className="font-bold text-base text-gray-700">当日の不在・予定 ({requests.length}件)</h4>
                    {requests.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">登録されていません</p>
                    ) : (
                        <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                            {requests.map((r: any) => {
                                const staff = staffs.find((s:any) => s.id === r.staffId);
                                const uStore = users.find(u => `user_${u.uid}` === r.staffId);
                                const displayName = staff ? formatStaffName(`${staff.lastName} ${staff.firstName}`) : uStore ? `${formatStaffName(uStore.name)} (${displayRole(uStore.role)})` : '不明';
                                const rStore = stores?.find((st:any) => st.id === r.storeId);
                                return (
                                    <div key={r.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 shadow-sm rounded-xl">
                                        <div>
                                            <span className="font-bold text-gray-800 text-base">
                                                {isAllStores && rStore && <span className="text-sm bg-gray-100 text-gray-500 px-1 py-0.5 rounded mr-1">{rStore.name}</span>}
                                                {displayName}
                                            </span>
                                            <span className={`ml-2 text-sm font-bold px-2 py-0.5 rounded-full ${r.type === '有休' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {r.type}
                                            </span>
                                            {r.status === 'pending' && <span className="ml-1 text-xs bg-yellow-400 text-white px-1.5 py-0.5 rounded-full" title="承認待ち">待</span>}
                                            {r.status === 'approved' && <span className="ml-1 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full" title="承認済">済</span>}
                                            {r.status === 'rejected' && <span className="ml-1 text-xs bg-gray-500 text-white px-1.5 py-0.5 rounded-full" title="却下">却</span>}
                                        </div>
                                        <button onClick={() => onDelete(r.id)} className="text-sm text-red-500 font-bold hover:underline">
                                            削除
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// --- Store & Staff Settings ---

const StoreSettings = ({ stores, onSave, onDelete }: any) => {
    const [editingId, setEditingId] = useState<string>('');
    const [name, setName] = useState('');
    const [req, setReq] = useState({ monday: 0, weekday: 0, friday: 0, saturday: 0, sundayHoliday: 0 });

    const [closedDaysOfWeek, setClosedDaysOfWeek] = useState<number[]>([]);
    const [closedDatesStr, setClosedDatesStr] = useState('');
    const [operatingHours, setOperatingHours] = useState(0);
    const [seats, setSeats] = useState(0);
    const [assignedAM, setAssignedAM] = useState<string>('');

    const handleEdit = (store: any) => {
        setEditingId(store.id);
        setName(store.name);
        setReq(store.requiredStaffing || { monday: 0, weekday: 0, friday: 0, saturday: 0, sundayHoliday: 0 });
        setClosedDaysOfWeek(store.closedDaysOfWeek || []);
        setClosedDatesStr((store.closedDates || []).join(', '));
        setOperatingHours(store.operatingHoursPerDay || 0);
        setSeats(store.availableSeats || 0);
        setAssignedAM(store.assignedAM || '');
    };

    const handleDelete = async (id: string) => {
        await onDelete(id);
    };

    const handleSubmit = async () => {
        if (!name) return;
        const closedDates = closedDatesStr.split(',').map(s => s.trim()).filter(s => s);
        await onSave({ id: editingId, name, requiredStaffing: req, closedDaysOfWeek, closedDates, operatingHoursPerDay: operatingHours, availableSeats: seats, assignedAM });
        setEditingId('');
        setName('');
        setReq({ monday: 0, weekday: 0, friday: 0, saturday: 0, sundayHoliday: 0 });
        setClosedDaysOfWeek([]);
        setClosedDatesStr('');
        setOperatingHours(0);
        setSeats(0);
        setAssignedAM('');
    };

    const handleDayOfWeekToggle = (day: number) => {
        setClosedDaysOfWeek(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-black text-gray-800 border-b border-white/40 pb-4">店舗・稼働モデルの設定</h2>
            
            <div className="bg-white/60 p-6 rounded-2xl border border-white space-y-4 shadow-sm">
                <h3 className="font-bold text-gray-700">{editingId ? '店舗の編集' : '新規店舗の追加'}</h3>
                <div>
                   <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="店舗名" className="px-4 py-2 w-full rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean/50" />
                </div>
                <div>
                    <select value={assignedAM} onChange={e => setAssignedAM(e.target.value)} className="px-4 py-2 w-full rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean/50">
                        <option value="">担当AM未設定</option>
                        <option value="松阪AM">松阪AM</option>
                        <option value="仲原AM">仲原AM</option>
                        <option value="越井AM">越井AM</option>
                    </select>
                </div>
                <div>
                    <label className="text-base font-bold text-gray-500 mb-2 block">必要稼働席数（人数）</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {['monday|月曜', 'weekday|火-木曜', 'friday|金曜', 'saturday|土曜', 'sundayHoliday|日祝'].map(item => {
                            const [key, label] = item.split('|');
                            return (
                                <div key={key}>
                                    <span className="text-sm font-bold mb-1 block">{label}</span>
                                    <input type="number" min="0" value={(req as any)[key]} onChange={e => setReq({...req, [key]: parseInt(e.target.value)||0})} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean/50" />
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div>
                    <label className="text-base font-bold text-gray-500 mb-2 block">店休日（曜日） <span className="text-sm font-normal">※稼働が0になります</span></label>
                    <div className="flex flex-wrap gap-2">
                        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                            <button
                                key={i}
                                onClick={() => handleDayOfWeekToggle(i)}
                                className={`px-3 py-1 text-base font-bold rounded-lg border transition ${
                                    closedDaysOfWeek.includes(i) ? 'bg-red-100 text-red-600 border-red-200' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-base font-bold text-gray-500 mb-2 block">店休日（特定日） <span className="text-sm font-normal">※カンマ区切りで入力 (例: 2024-05-01, 2024-05-02)</span></label>
                    <input 
                        type="text" 
                        value={closedDatesStr} 
                        onChange={e => setClosedDatesStr(e.target.value)} 
                        placeholder="2024-05-01, 2024-05-02" 
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean/50 text-base" 
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-base font-bold text-gray-500 mb-2 block">1日の営業時間 <span className="text-sm font-normal">※例: 10-19時なら9</span></label>
                        <input type="number" step="0.5" min="0" value={operatingHours} onChange={e => setOperatingHours(Number(e.target.value))} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean/50 text-base" />
                    </div>
                    <div>
                        <label className="text-base font-bold text-gray-500 mb-2 block">可動席数</label>
                        <input type="number" min="0" value={seats} onChange={e => setSeats(Number(e.target.value))} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean/50 text-base" />
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    {editingId && (
                        <button onClick={() => { setEditingId(''); setName(''); setReq({ monday: 0, weekday: 0, friday: 0, saturday: 0, sundayHoliday: 0 }); setAssignedAM(''); }} className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition">
                            キャンセル
                        </button>
                    )}
                    <button onClick={handleSubmit} className="px-6 py-2 bg-paradise-ocean text-white font-bold rounded-xl hover:bg-paradise-ocean/90 transition shadow-sm">
                        {editingId ? '更新する' : '店舗を登録'}
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="font-bold text-gray-700">登録済み店舗</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    {stores.map((s: any) => (
                        <div key={s.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between group transition-all hover:shadow-md">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="font-black text-lg text-gray-800">{s.name}</span>
                                    {s.assignedAM && <span className="ml-2 text-xs font-bold px-2 py-1 bg-paradise-lavender/50 text-paradise-ocean rounded-lg">{s.assignedAM}</span>}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit(s)} className="text-sm font-bold text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                                    <button onClick={() => handleDelete(s.id)} className="text-sm font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                                </div>
                            </div>
                            <div className="mt-3 text-sm text-gray-500 font-bold grid grid-cols-5 gap-1 text-center bg-gray-50 p-2 rounded-xl">
                                <div><span className="block text-xs text-qb-gray">月</span>{s.requiredStaffing?.monday}</div>
                                <div><span className="block text-xs text-qb-gray">火-木</span>{s.requiredStaffing?.weekday}</div>
                                <div><span className="block text-xs text-qb-gray">金</span>{s.requiredStaffing?.friday}</div>
                                <div><span className="block text-xs text-qb-gray">土</span>{s.requiredStaffing?.saturday}</div>
                                <div><span className="block text-xs text-qb-gray">日祝</span>{s.requiredStaffing?.sundayHoliday}</div>
                            </div>
                            {(s.closedDaysOfWeek?.length > 0 || s.closedDates?.length > 0) && (
                                <div className="mt-2 text-xs text-gray-500 bg-red-50 p-2 rounded-xl border border-red-100">
                                    {s.closedDaysOfWeek?.length > 0 && <div><span className="font-bold text-red-600 mr-1">定休曜日:</span>{s.closedDaysOfWeek.map((d:number) => ['日','月','火','水','木','金','土'][d]).join(', ')}</div>}
                                    {s.closedDates?.length > 0 && <div><span className="font-bold text-red-600 mr-1">特定休日:</span>{s.closedDates.join(', ')}</div>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const StaffSettings = ({ stores, staffs, onSave, onDelete }: any) => {
    const [editingId, setEditingId] = useState<string>('');
    const [lastName, setLastName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [storeId, setStoreId] = useState('');
    const [employmentType, setEmploymentType] = useState('fulltime');
    const [defaultPtShiftType, setDefaultPtShiftType] = useState('full');
    const [monthlyOffDays, setMonthlyOffDays] = useState(8);
    const [weeklyWorkDays, setWeeklyWorkDays] = useState(3);
    const [expandedStores, setExpandedStores] = useState<Record<string, boolean>>({});
    const [closedDaysOfWeek, setClosedDaysOfWeek] = useState<number[]>([]);
    const [closedDatesStr, setClosedDatesStr] = useState('');
    const [isLogisGrad, setIsLogisGrad] = useState(false);
    const [joinedDate, setJoinedDate] = useState('');
    const [assignedDate, setAssignedDate] = useState('');

    const isExpanded = (storeId: string) => expandedStores[storeId] !== false;
    const toggleStore = (storeId: string) => setExpandedStores(p => ({ ...p, [storeId]: !isExpanded(storeId) }));

    const handleEdit = (staff: any) => {
        setEditingId(staff.id);
        setLastName(staff.lastName || '');
        setFirstName(staff.firstName || '');
        setStoreId(staff.storeId || '');
        setEmploymentType(staff.employmentType || 'fulltime');
        setDefaultPtShiftType(staff.defaultPtShiftType || 'full');
        setMonthlyOffDays(staff.monthlyOffDays ?? 8);
        setWeeklyWorkDays(staff.weeklyWorkDays ?? 3);
        setClosedDaysOfWeek(staff.closedDaysOfWeek || []);
        setClosedDatesStr((staff.closedDates || []).join(', '));
        setIsLogisGrad(staff.isLogisGrad || false);
        setJoinedDate(staff.joinedDate || '');
        setAssignedDate(staff.assignedDate || '');
    };

    const handleDelete = async (id: string) => {
        await onDelete(id);
    };

    const handleSubmit = async () => {
        if (!lastName || !firstName || !storeId) return;
        const closedDates = closedDatesStr.split(',').map(s => s.trim()).filter(s => s);
        const staffData: any = { 
            id: editingId || '', 
            lastName: lastName || '', 
            firstName: firstName || '', 
            storeId: storeId || '', 
            employmentType: employmentType || 'fulltime', 
            monthlyOffDays: monthlyOffDays ?? 8, 
            weeklyWorkDays: weeklyWorkDays ?? 3,
            closedDaysOfWeek: closedDaysOfWeek || [],
            closedDates: closedDates || [],
            isLogisGrad: isLogisGrad || false,
            joinedDate: joinedDate || '',
            assignedDate: isLogisGrad ? (assignedDate || '') : ''
        };

        if (employmentType === 'parttime') {
            staffData.defaultPtShiftType = defaultPtShiftType || 'full';
        }

        await onSave(staffData);
        setEditingId('');
        setLastName('');
        setFirstName('');
        setDefaultPtShiftType('full');
        setClosedDaysOfWeek([]);
        setClosedDatesStr('');
        setIsLogisGrad(false);
        setJoinedDate('');
        setAssignedDate('');
    };

    const handleDayOfWeekToggle = (day: number) => {
        setClosedDaysOfWeek(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-black text-gray-800 border-b border-white/40 pb-4">スタッフ（マスタ）設定</h2>
            
            <div className="bg-white/60 p-6 rounded-2xl border border-white space-y-4 shadow-sm">
                <h3 className="font-bold text-gray-700">{editingId ? 'スタッフの編集' : '新規スタッフ追加'}</h3>
                <div className="flex flex-col md:flex-row gap-4">
                   <select value={storeId} onChange={e => setStoreId(e.target.value)} className="w-full md:w-1/4 px-4 py-2 rounded-xl border border-gray-200">
                       <option value="">所属店舗を選択...</option>
                       {stores.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                   <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className="w-full md:w-1/5 px-4 py-2 rounded-xl border border-gray-200">
                       <option value="fulltime">正社員</option>
                       <option value="parttime">パート</option>
                   </select>
                   {employmentType === 'parttime' && (
                       <select value={defaultPtShiftType} onChange={e => setDefaultPtShiftType(e.target.value)} className="w-full md:w-1/5 px-4 py-2 rounded-xl border border-gray-200">
                           <option value="full">標準: フル (+1)</option>
                           <option value="short">標準: 時短 (0)</option>
                       </select>
                   )}
                   <div className="flex-1 flex gap-2">
                       <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="氏" className="flex-1 px-4 py-2 rounded-xl border border-gray-200" />
                       <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="名" className="flex-1 px-4 py-2 rounded-xl border border-gray-200" />
                   </div>
                   <div className="w-full md:w-1/4 flex items-center justify-end gap-2 text-base">
                       {employmentType === 'fulltime' ? (
                           <>
                               <span className="font-bold text-gray-500">公休:</span>
                               <input type="number" min="0" value={monthlyOffDays} onChange={e => setMonthlyOffDays(parseInt(e.target.value)||0)} className="w-16 px-3 py-2 rounded-xl border border-gray-200" />
                               <span className="font-bold text-gray-500">日/月</span>
                           </>
                       ) : (
                           <>
                               <span className="font-bold text-gray-500">シフト:</span>
                               <input type="number" min="0" value={weeklyWorkDays} onChange={e => setWeeklyWorkDays(parseInt(e.target.value)||0)} className="w-16 px-3 py-2 rounded-xl border border-gray-200" />
                               <span className="font-bold text-gray-500">日/週</span>
                           </>
                       )}
                   </div>
                </div>
                
                <div className="flex flex-col gap-4 border-t border-white/50 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3 bg-white/50 border border-gray-200 px-4 py-2 rounded-xl">
                            <label className="text-base font-bold text-gray-500">ロジス卒（○/×）</label>
                            <input type="checkbox" checked={isLogisGrad} onChange={e => setIsLogisGrad(e.target.checked)} className="w-5 h-5" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-500 mb-1 block">入社日</label>
                            <input type="date" value={joinedDate} onChange={e => setJoinedDate(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-gray-200" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-500 mb-1 block">配属日（ロジス卒のみ）</label>
                            <input type="date" value={assignedDate} onChange={e => setAssignedDate(e.target.value)} disabled={!isLogisGrad} className="w-full px-4 py-2 rounded-xl border border-gray-200" />
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col gap-4 border-t border-white/50 pt-4">
                    <div>
                        <label className="text-base font-bold text-gray-500 mb-2 block">固定休・出勤不可（曜日） <span className="text-sm font-normal">※この曜日は稼働予定から除外されます</span></label>
                        <div className="flex flex-wrap gap-2">
                            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleDayOfWeekToggle(i)}
                                    className={`px-3 py-1 text-base font-bold rounded-lg border transition ${
                                        closedDaysOfWeek.includes(i) ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-base font-bold text-gray-500 mb-2 block">固定休・出勤不可（特定日） <span className="text-sm font-normal">※カンマ区切りで入力 (例: 2024-05-01, 2024-05-02)</span></label>
                        <input 
                            type="text" 
                            value={closedDatesStr} 
                            onChange={e => setClosedDatesStr(e.target.value)} 
                            placeholder="2024-05-01, 2024-05-02" 
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-paradise-ocean/50 text-base" 
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    {editingId && (
                        <button onClick={() => { setEditingId(''); setLastName(''); setFirstName(''); setIsLogisGrad(false); setJoinedDate(''); setAssignedDate(''); }} className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition">
                            キャンセル
                        </button>
                    )}
                    <button onClick={handleSubmit} className="px-6 py-2 bg-paradise-ocean text-white font-bold rounded-xl hover:bg-paradise-ocean/90 transition shadow-sm">
                        {editingId ? '更新する' : 'スタッフを登録'}
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="font-bold text-gray-700">登録済みスタッフ</h3>
                <div className="grid gap-3">
                    {[
                        ...stores.map((store:any) => ({ store, storeStaffs: staffs.filter((s:any) => s.storeId === store.id) })),
                        { store: { id: 'unassigned', name: '未割り当て' }, storeStaffs: staffs.filter((s:any) => !stores.some((st:any) => st.id === s.storeId)) }
                    ].filter(g => g.storeStaffs.length > 0)
                     .map(({ store, storeStaffs }) => (
                         <div key={store.id} className="bg-white/50 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                             <button 
                                 onClick={() => toggleStore(store.id)} 
                                 className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition border-b border-gray-100"
                             >
                                 <div className="flex items-center gap-3">
                                     <span className="font-black text-gray-800">{store.name}</span>
                                     <span className="text-sm font-bold text-paradise-ocean bg-paradise-ocean/10 px-2 py-0.5 rounded-full">{storeStaffs.length}名</span>
                                 </div>
                                 <ChevronDown size={20} className={`text-gray-400 transition-transform ${isExpanded(store.id) ? 'rotate-180' : ''}`} />
                             </button>
                             
                             <AnimatePresence initial={false}>
                                 {isExpanded(store.id) && (
                                     <motion.div
                                         initial={{ height: 0, opacity: 0 }}
                                         animate={{ height: 'auto', opacity: 1 }}
                                         exit={{ height: 0, opacity: 0 }}
                                         className="overflow-hidden"
                                     >
                                         <div className="p-3 grid gap-2 bg-gray-50/50">
                                             {storeStaffs.map((s: any) => (
                                                 <div key={s.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center group transition-all hover:shadow-md">
                                                     <div className="flex flex-col gap-1">
                                                         <div>
                                                             <span className={`text-xs font-bold px-2 py-0.5 rounded-md mr-3 ${s.employmentType === 'parttime' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                 {s.employmentType === 'parttime' ? 'パート' : '正社員'}
                                                             </span>
                                                             {s.employmentType === 'parttime' && (
                                                                 <span className="text-xs font-bold text-gray-500 mr-2 border border-gray-200 px-2 py-0.5 rounded-md">
                                                                     標準: {s.defaultPtShiftType === 'short' ? '時短' : 'フル'}
                                                                 </span>
                                                             )}
                                                             <span className="font-black text-gray-800">{formatStaffName(`${s.lastName} ${s.firstName}`)}</span>
                                                         </div>
                                                         {(s.closedDaysOfWeek?.length > 0 || s.closedDates?.length > 0) && (
                                                             <div className="text-xs text-gray-500">
                                                                 {s.closedDaysOfWeek?.length > 0 && <span className="mr-2"><span className="font-bold text-orange-600">固定休:</span> {s.closedDaysOfWeek.map((d:number) => ['日','月','火','水','木','金','土'][d]).join(', ')}</span>}
                                                                 {s.closedDates?.length > 0 && <span><span className="font-bold text-orange-600">特定休:</span> {s.closedDates.join(', ')}</span>}
                                                             </div>
                                                         )}
                                                     </div>
                                                     <div className="flex items-center gap-4">
                                                         <span className="text-base font-bold text-gray-500">
                                                             {s.employmentType === 'parttime' ? (
                                                                 <>週 {s.weeklyWorkDays}日 出勤</>
                                                             ) : (
                                                                 <>月間公休: {s.monthlyOffDays}日</>
                                                             )}
                                                         </span>
                                                         <div className="flex gap-2">
                                                             <button onClick={() => handleEdit(s)} className="text-sm font-bold text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition">編集</button>
                                                             <button onClick={() => handleDelete(s.id)} className="text-sm font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded transition">削除</button>
                                                         </div>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     </motion.div>
                                 )}
                             </AnimatePresence>
                         </div>
                     ))}
                </div>
            </div>
        </div>
    );
};
