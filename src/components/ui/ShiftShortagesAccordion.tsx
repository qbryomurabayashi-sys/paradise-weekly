import React, { useState, useEffect, useMemo } from 'react';
import { format, addDays, getDay, startOfMonth, endOfMonth, eachDayOfInterval, isAfter, isBefore } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronDown, ChevronUp, AlertCircle, Calendar } from 'lucide-react';
import { useShiftStore } from '../../store/useShiftStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useUsersStore } from '../../store/useUsersStore';
import * as JapaneseHolidays from 'japanese-holidays';
import { motion, AnimatePresence } from 'framer-motion';

const isHoliday = (date: Date) => getDay(date) === 0 || JapaneseHolidays.isHoliday(date) !== undefined;

export const ShiftShortagesAccordion = () => {
    const { user, viewMode } = useAuthStore();
    const { users } = useUsersStore();
    const { stores, staffs, shiftRequests, initShiftRequests } = useShiftStore();
    const [expanded, setExpanded] = useState(false);
    
    const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;

    useEffect(() => {
        const date = new Date();
        const prefix = format(date, 'yyyy-MM');
        const unsub = initShiftRequests(prefix, user ? {role: user.role, storeName: user.storeName, uid: user.uid} : undefined);
        return () => unsub();
    }, [initShiftRequests, user?.uid]);

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
            const nativeExists = staffs.some(s => (s.lastName + (s.firstName || '')).replace(/\s/g, '') === u.lastName.replace(/\s/g, ''));
            return !nativeExists;
        });
        return [...staffs, ...userStaffs];
    }, [staffs, users, stores]);

    const shortages = useMemo(() => {
        // Find visible stores
        let visibleStores = stores;
        if (activeRole === '店長') {
            visibleStores = stores.filter(s => s.name === user?.storeName);
        }

        const today = new Date();
        const endDate = addDays(today, 14); // Next 14 days
        const days = eachDayOfInterval({ start: today, end: endDate });

        const results: any[] = [];

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayOfWeek = getDay(day);

            visibleStores.forEach(store => {
                if (store.closedDaysOfWeek?.includes(dayOfWeek) || store.closedDates?.includes(dateStr)) return;

                const req = store.requiredStaffing;
                let reqStaffCount = 0;
                if (isHoliday(day)) reqStaffCount = req?.sundayHoliday || 0;
                else if (dayOfWeek === 1) reqStaffCount = req?.monday || 0;
                else if (dayOfWeek === 5) reqStaffCount = req?.friday || 0;
                else if (dayOfWeek === 6) reqStaffCount = req?.saturday || 0;
                else reqStaffCount = req?.weekday || 0;

                if (reqStaffCount === 0) return;

                const storeStaffs = mixedStaffs.filter(s => s.storeId === store.id);
                const dayRequests = shiftRequests.filter((r: any) => r.storeId === store.id && r.date === dateStr);

                const isStaffAbsent = (staff: any) => {
                    const req = dayRequests.find((r: any) => r.staffId === staff.id);
                    if (req && ['希望休', '有休', 'フリー有休', '特休', '会議', '研修', 'その他', '公出'].includes(req.type)) {
                        return req.status !== 'rejected';
                    }
                    if (staff.closedDaysOfWeek?.includes(dayOfWeek) || staff.closedDates?.includes(dateStr)) return true;
                    return false;
                };

                const workingFullStaff = storeStaffs.filter(s => !isStaffAbsent(s) && (s.employmentType !== 'parttime' || (s as any).defaultPtShiftType !== 'short'));
                const availableStaff = workingFullStaff.length;
                const deficiency = availableStaff - reqStaffCount;

                if (deficiency < 0) {
                    results.push({
                        date: day,
                        dateStr,
                        store,
                        deficiency: Math.abs(deficiency),
                        reqStaffCount,
                        availableStaff
                    });
                }
            });
        });

        // Sort by date, then by severity
        return results.sort((a, b) => {
            if (a.dateStr === b.dateStr) {
                return b.deficiency - a.deficiency; // higher deficiency first
            }
            return a.dateStr.localeCompare(b.dateStr);
        });

    }, [stores, mixedStaffs, shiftRequests, activeRole, user]);

    if (shortages.length === 0) return null;

    // Group shortages by date
    const groupedShortages = shortages.reduce((acc, curr) => {
        if (!acc[curr.dateStr]) acc[curr.dateStr] = [];
        acc[curr.dateStr].push(curr);
        return acc;
    }, {});

    return (
        <div className="mb-6 px-2">
            <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 backdrop-blur-md rounded-2xl border-2 border-red-200 shadow-lg relative overflow-hidden"
            >
                <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-red-50/50 transition-colors z-20 relative select-none"
                    onClick={() => setExpanded(!expanded)}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                            <AlertCircle size={24} className="animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-800 tracking-tight flex items-center gap-2 mb-0.5">
                                今後14日間のシフト過不足
                            </h3>
                            <p className="text-xs font-bold text-red-600 bg-red-100/80 px-2 py-0.5 rounded-md inline-block">
                                {shortages.length}件の稼働不足が見込まれます
                            </p>
                        </div>
                    </div>
                    <div>
                        {expanded ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                    </div>
                </div>

                <AnimatePresence>
                    {expanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-white px-4 pb-4 pt-1 z-20 relative max-h-[300px] overflow-y-auto no-scrollbar"
                        >
                            <div className="space-y-3 mt-2">
                                {Object.entries(groupedShortages).map(([dateStr, items]: [string, any]) => {
                                    const dateObj = new Date(dateStr);
                                    return (
                                        <div key={dateStr} className="border border-red-100 rounded-xl overflow-hidden">
                                            <div className="bg-red-50/50 px-3 py-2 border-b border-red-100 flex items-center gap-2">
                                                <Calendar size={14} className="text-red-500" />
                                                <span className="font-black text-sm text-gray-800">{format(dateObj, 'M/d (E)', { locale: ja })}</span>
                                            </div>
                                            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {items.map((item: any) => (
                                                    <div key={item.store.id} className="flex items-center justify-between bg-white border border-gray-100 p-2 rounded-lg text-sm">
                                                        <span className="font-bold text-gray-700">{item.store.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-500 font-bold">稼働 {item.availableStaff}/{item.reqStaffCount}</span>
                                                            <span className="text-xs font-black text-white bg-red-500 px-2 py-0.5 rounded-md">
                                                                不足 {item.deficiency}名
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full -mr-16 -mt-16 blur-2xl z-0" />
            </motion.div>
        </div>
    );
};
