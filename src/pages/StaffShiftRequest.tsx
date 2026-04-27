import React, { useState, useEffect, useMemo } from 'react';
import { useShiftStore, ShiftRequestType } from '../store/useShiftStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAnnouncementStore } from '../store/useAnnouncementStore';
import { format, startOfMonth, addMonths, subMonths, eachDayOfInterval, endOfMonth, getDay, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle, User as UserIcon, Store as StoreIcon, AlertTriangle, AlertCircle } from 'lucide-react';
import * as JapaneseHolidays from 'japanese-holidays';

const isHoliday = (date: Date) => getDay(date) === 0 || JapaneseHolidays.isHoliday(date) !== undefined;

export const StaffShiftRequest = () => {
    const { user } = useAuthStore();
    const { stores, staffs, shiftRequests, initStores, initStaffs, initShiftRequests, saveShiftRequest, deleteShiftRequest } = useShiftStore();
    const { addAnnouncement } = useAnnouncementStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<ShiftRequestType>('希望休');

    // Keyed by staffId -> dateStr -> type
    const [draftRequests, setDraftRequests] = useState<Record<string, Record<string, ShiftRequestType | null>>>({});
    const [isManagerApproved, setIsManagerApproved] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

    useEffect(() => {
        const unsubStores = initStores();
        const unsubStaffs = initStaffs();
        return () => {
            unsubStores();
            unsubStaffs();
        };
    }, []);

    useEffect(() => {
        const prefix = format(currentDate, 'yyyy-MM');
        const unsub = initShiftRequests(prefix);
        return () => unsub();
    }, [currentDate]);

    useEffect(() => {
        if (user && stores.length > 0) {
            if (user.role === '店長' || user.role === 'AM') {
                const uStore = stores.find(s => s.name === user.storeName);
                if (uStore && !selectedStoreId) {
                    setSelectedStoreId(uStore.id);
                }
            }
        }
    }, [user, stores, selectedStoreId]);

    const filteredStaffs = staffs.filter(s => s.storeId === selectedStoreId);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Effective requests for the *selected staff*
    const effectiveRequests = useMemo(() => {
        const map = new Map<string, { id?: string; type: ShiftRequestType | null; status?: string; isNew: boolean }>();
        if (!selectedStaffId) return map;
        
        shiftRequests.forEach(r => {
            if (r.staffId === selectedStaffId) {
                map.set(r.date, { id: r.id, type: r.type, status: r.status, isNew: false });
            }
        });

        const drafts = draftRequests[selectedStaffId] || {};
        Object.entries(drafts).forEach(([dateStr, t]) => {
            const reqType = t as ShiftRequestType | null;
            const existing = map.get(dateStr);
            if (existing) {
                map.set(dateStr, { ...existing, type: reqType, isNew: true });
            } else {
                map.set(dateStr, { type: reqType, isNew: true });
            }
        });

        return map;
    }, [shiftRequests, draftRequests, selectedStaffId]);

    const limitTypes = ['希望休', '有休'];
    
    // Count only limited types for the *selected staff*
    const limitCount = useMemo(() => {
        let count = 0;
        effectiveRequests.forEach((val, key) => {
            const dateObj = new Date(key);
            if (dateObj >= monthStart && dateObj <= monthEnd) {
                if (val.type && limitTypes.includes(val.type)) {
                    count++;
                }
            }
        });
        return count;
    }, [effectiveRequests, monthStart, monthEnd]);

    const isOverLimit = limitCount > 3;

    // Helper: calculate available off slots for a store
    const getStoreAvailableOffSlots = (storeId: string, dateObj: Date) => {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        const dayOfWeek = getDay(dateObj);
        const st = stores.find(s => s.id === storeId);
        if (!st) return { allowed: 0, used: 0, remaining: 0, reqCount: 0 };

        const isClosed = st.closedDaysOfWeek?.includes(dayOfWeek) || st.closedDates?.includes(dateStr);

        const req = st.requiredStaffing;
        let reqCount = 0;
        
        if (isClosed) {
            reqCount = 0;
        } else if (isHoliday(dateObj)) {
            reqCount = req.sundayHoliday || 0;
        } else if (dayOfWeek === 1) {
            reqCount = req.monday || 0;
        } else if (dayOfWeek === 5) {
            reqCount = req.friday || 0;
        } else if (dayOfWeek === 6) {
            reqCount = req.saturday || 0;
        } else {
            reqCount = req.weekday || 0;
        }

        const stStaffs = staffs.filter((s:any) => s.storeId === storeId && (s.employmentType !== 'parttime' || s.defaultPtShiftType !== 'short'));
        let potential = 0;
        let alreadyOff = 0;

        stStaffs.forEach((s:any) => {
            const draftType = draftRequests[s.id]?.[dateStr];
            const existingReq = shiftRequests.find((r:any) => r.staffId === s.id && r.date === dateStr);
            const type = draftType !== undefined ? draftType : existingReq?.type;

            if (type === '公出') {
                potential++; // Always available when 公出
            } else {
                if (s.closedDaysOfWeek?.includes(dayOfWeek) || s.closedDates?.includes(dateStr)) {
                    // native absent
                } else {
                    potential++;
                    if (type && ['希望休', '有休', '特休', 'フリー有休', '会議', '研修', 'その他'].includes(type)) {
                        alreadyOff++;
                    }
                }
            }
        });
        
        return {
            allowed: potential - reqCount,
            used: alreadyOff,
            remaining: potential - reqCount - alreadyOff,
            reqCount
        };
    };

    const getBlockAvailableOffSlots = (dateObj: Date) => {
        let allowed = 0;
        let used = 0;
        stores.forEach(st => {
            const res = getStoreAvailableOffSlots(st.id, dateObj);
            if (res.allowed !== 999) {
                allowed += res.allowed;
                used += res.used;
            }
        });
        return { allowed, used, remaining: allowed - used };
    };

    const handleDateClick = (date: Date) => {
        if (!selectedStaffId) {
            setStatusMessage({type: 'error', text: '先にスタッフを選択してください'});
            setTimeout(() => setStatusMessage(null), 3000);
            return;
        }

        const dateStr = format(date, 'yyyy-MM-dd');
        const effective = effectiveRequests.get(dateStr);
        
        let nextType: ShiftRequestType | null = selectedType as ShiftRequestType;
        if (selectedType === '取消(クリア)' as any) {
            nextType = null;
        } else if (effective?.type === selectedType) {
            nextType = null;
        }

        setDraftRequests(prev => ({
            ...prev,
            [selectedStaffId]: {
                ...(prev[selectedStaffId] || {}),
                [dateStr]: nextType
            }
        }));
    };

    const hasAnyChanges = Object.keys(draftRequests).some(sid => Object.keys(draftRequests[sid]).length > 0);

    const handleSubmitAll = async () => {
        // Validation: loop through drafts to see if any staff exceeds limit without approval
        let overLimitStaffName = "";
        for (const [staffId, drafts] of Object.entries(draftRequests)) {
            let count = 0;
            // Existing requests
            const existing = shiftRequests.filter(r => r.staffId === staffId);
            const map = new Map<string, ShiftRequestType | null>();
            existing.forEach(r => map.set(r.date, r.type));
            // Apply drafts
            Object.entries(drafts).forEach(([dStr, t]) => map.set(dStr, t));

            map.forEach((t, dStr) => {
                const dObj = new Date(dStr);
                if (dObj >= monthStart && dObj <= monthEnd) {
                    if (t && limitTypes.includes(t)) count++;
                }
            });

            if (count > 3 && !isManagerApproved) {
                const s = staffs.find(st => st.id === staffId);
                overLimitStaffName = s ? `${s.lastName} ${s.firstName}` : staffId;
                break;
            }
        }

        if (overLimitStaffName && !isManagerApproved) {
            setStatusMessage({type: 'error', text: `${overLimitStaffName}さんの希望休・有休が3日を超えています。上長の承認確認にチェックを入れてください。`});
            setTimeout(() => setStatusMessage(null), 5000);
            return;
        }

        setIsSubmitting(true);
        try {
            // Check for negative slots to send announcements
            const updatedDates = new Set<string>();
            Object.entries(draftRequests).forEach(([sid, drafts]) => {
                Object.keys(drafts).forEach(d => updatedDates.add(d));
            });

            // For each store and block, check if it becomes minus
            for (const dStr of Array.from(updatedDates)) {
                const dayObj = new Date(dStr);
                const blockSlots = getBlockAvailableOffSlots(dayObj);

                stores.forEach(async (store) => {
                    const stSlots = getStoreAvailableOffSlots(store.id, dayObj);
                    if (stSlots.remaining < 0 && stSlots.allowed !== 999) {
                        // Store is minus
                        const content = `<p><strong>${store.name}</strong> にて、<strong>${format(dayObj, 'M/d (E)', { locale: ja })}</strong> の休可枠がマイナス（不足 ${Math.abs(stSlots.remaining)}名）になりました。</p><p>他店舗からの応援など調整をお願いします。</p>`;
                        await addAnnouncement({
                            title: `【警告】${store.name}の稼働不足`,
                            content,
                            authorId: user?.uid || 'system',
                            authorName: 'システム自動通知',
                            authorRole: 'system',
                            isImportant: true,
                            displayUntil: new Date(dayObj.getTime() + 86400000).toISOString()
                        });
                    }
                });

                if (blockSlots.remaining < 0) {
                    // Block is minus
                    const content = `<p><strong>ブロック全体</strong> にて、<strong>${format(dayObj, 'M/d (E)', { locale: ja })}</strong> の休可枠がマイナス（全体不足 ${Math.abs(blockSlots.remaining)}名）になりました。</p><p>全店舗でのシフト再調整が必要です。</p>`;
                    // Need to generate ID? addAnnouncement probably handles it.
                    await addAnnouncement({
                        title: `【緊急】ブロック全体の稼働不足`,
                        content,
                        authorId: user?.uid || 'system',
                        authorName: 'システム自動通知',
                        authorRole: 'system',
                        isImportant: true,
                        displayUntil: new Date(dayObj.getTime() + 86400000).toISOString()
                    });
                }
            }

            // Save requests
            for (const [staffId, drafts] of Object.entries(draftRequests)) {
                const sStoreId = staffs.find(s => s.id === staffId)?.storeId || selectedStoreId;
                for (const [dateStr, type] of Object.entries(drafts)) {
                    const existing = shiftRequests.find(r => r.staffId === staffId && r.date === dateStr);
                    if (type === null) {
                        if (existing) {
                            await deleteShiftRequest(existing.id);
                        }
                    } else {
                        if (existing) {
                            if (existing.type !== type) {
                                await saveShiftRequest({ ...existing, type, status: 'pending' });
                            }
                        } else {
                            await saveShiftRequest({
                                id: '',
                                staffId,
                                storeId: sStoreId,
                                date: dateStr,
                                type,
                                status: 'pending',
                                submittedBy: user?.uid || '',
                                notes: ''
                            });
                        }
                    }
                }
            }

            setStatusMessage({type: 'success', text: '全スタッフの一括申請を完了しました！'});
            setTimeout(() => setStatusMessage(null), 3000);
            setDraftRequests({});
            setIsManagerApproved(false);
        } catch (e) {
            console.error(e);
            setStatusMessage({type: 'error', text: '申請中にエラーが発生しました'});
            setTimeout(() => setStatusMessage(null), 3000);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStaffDraftCount = (sId: string) => Object.keys(draftRequests[sId] || {}).length;

    return (
        <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
            <h1 className="text-xl font-black text-gray-800 tracking-wider flex items-center gap-2">
                <Calendar size={24} className="text-paradise-ocean"/> 希望休かんたん登録
            </h1>
            
            {statusMessage && (
                <div className={`p-4 rounded-2xl flex items-start gap-3 font-bold text-base ${statusMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    <AlertCircle size={20} className="shrink-0"/>
                    <p>{statusMessage.text}</p>
                </div>
            )}

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <div>
                    <label className="text-sm font-bold text-gray-500 mb-1 flex items-center gap-1"><StoreIcon size={14}/> 店舗を選択</label>
                    <select 
                        value={selectedStoreId} 
                        onChange={(e) => { setSelectedStoreId(e.target.value); setSelectedStaffId(''); }}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-paradise-ocean focus:outline-none font-bold text-gray-800"
                    >
                        <option value="">店舗を選択してください</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                {selectedStoreId && (
                    <div>
                        <label className="text-sm font-bold text-gray-500 mb-1 flex items-center gap-1"><UserIcon size={14}/> スタッフを選択</label>
                        <select 
                            value={selectedStaffId} 
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-paradise-ocean focus:outline-none font-bold text-gray-800"
                        >
                            <option value="">お名前を選択してください</option>
                            {filteredStaffs.map(s => {
                                const draftCount = getStaffDraftCount(s.id);
                                return (
                                    <option key={s.id} value={s.id}>
                                        {s.lastName} {s.firstName} {draftCount > 0 ? `(未申請 ${draftCount})` : ''}
                                    </option>
                                );
                            })}
                        </select>
                        {selectedStaffId && (
                            <div className="flex justify-end mt-3">
                                <button
                                    onClick={() => {
                                        const dateStr = format(monthStart, 'yyyy-MM-01');
                                        setDraftRequests(prev => ({
                                            ...prev,
                                            [selectedStaffId]: {
                                                [dateStr]: '希望休なし'
                                            }
                                        }));
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl border border-gray-200 hover:bg-gray-200 transition"
                                >
                                    「今月は希望休なし」として一括送信リストに追加
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedStaffId ? (
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-6 relative overflow-hidden">
                    <div className="flex justify-between items-center relative z-10">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded-full transition">
                            <ChevronLeft size={20} />
                        </button>
                        <h2 className="text-lg font-black text-gray-800 tracking-wider">
                            {format(currentDate, 'yyyy年 M月', { locale: ja })}
                        </h2>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded-full transition">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="relative z-10">
                        <label className="text-sm font-bold text-gray-500 mb-2 block">登録する種類を選択してカレンダーをタップ</label>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {['希望休', '有休', 'フリー有休', '特休', '会議', '研修', 'その他', '公出', '取消(クリア)'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setSelectedType(type as any)}
                                    className={`px-3 py-2 rounded-xl font-bold text-base transition-all flex-grow ${
                                        selectedType === type 
                                        ? type === '取消(クリア)' ? 'bg-red-500 text-white shadow-md transform scale-105' : 'bg-paradise-ocean text-white shadow-md transform scale-105' 
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        
                        <p className="text-xs text-gray-400 font-bold mb-4 bg-blue-50/50 p-2 rounded-lg leading-relaxed text-center">
                            日をタップで「{selectedType}」を追加・解除。<br/>全スタッフの編集が終わったら下部から一括申請できます。
                        </p>

                        <div className="grid grid-cols-7 gap-1">
                            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                                <div key={d} className={`text-center font-bold text-xs py-1 rounded border border-transparent ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
                                    {d}
                                </div>
                            ))}
                            
                            {Array.from({ length: getDay(monthStart) }).map((_, i) => (
                                <div key={`empty-${i}`} className="h-12 bg-transparent" />
                            ))}

                            {days.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const effective = effectiveRequests.get(dateStr);
                                const isToday = isSameDay(day, new Date());
                                
                                const stSlots = getStoreAvailableOffSlots(selectedStoreId, day);
                                const bkSlots = getBlockAvailableOffSlots(day);

                                let bgColor = 'bg-gray-50 hover:bg-gray-100';
                                let textColor = 'text-gray-700';
                                let borderColor = 'border-transparent';
                                let shadow = '';
                                
                                if (effective && effective.type) {
                                    if (effective.isNew) {
                                        shadow = 'ring-2 ring-paradise-sunset ring-offset-1';
                                    }
                                    if (effective.type === '希望休') { bgColor = 'bg-blue-100'; textColor = 'text-blue-700'; borderColor = 'border-blue-200'; }
                                    else if (effective.type === '有休') { bgColor = 'bg-orange-100'; textColor = 'text-orange-700'; borderColor = 'border-orange-200'; }
                                    else if (effective.type === 'フリー有休') { bgColor = 'bg-green-100'; textColor = 'text-green-700'; borderColor = 'border-green-200'; }
                                    else if (effective.type === '特休') { bgColor = 'bg-purple-100'; textColor = 'text-purple-700'; borderColor = 'border-purple-200'; }
                                    else if (effective.type === '公出') { bgColor = 'bg-pink-100'; textColor = 'text-pink-700'; borderColor = 'border-pink-200'; }
                                    else if (effective.type === '希望休なし') { bgColor = 'bg-gray-100'; textColor = 'text-gray-500'; borderColor = 'border-gray-300'; }
                                    else if (effective.type) { bgColor = 'bg-gray-200'; textColor = 'text-gray-700'; borderColor = 'border-gray-300'; }
                                } else if (isToday) {
                                    borderColor = 'border-paradise-sunset/30';
                                }

                                return (
                                    <div key={day.toString()} className="flex flex-col gap-0.5">
                                        <button
                                            onClick={() => handleDateClick(day)}
                                            className={`h-12 w-full flex flex-col items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${bgColor} ${textColor} ${borderColor} ${shadow}`}
                                        >
                                            <span className={`text-sm font-black ${isToday ? 'bg-paradise-sunset text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                                                {format(day, 'd')}
                                            </span>
                                            {effective?.type && (
                                                <div className="flex items-center gap-0.5 mt-0.5">
                                                    <span className="text-[10px] font-bold tracking-tighter truncate max-w-full px-1">
                                                        {effective.type === 'フリー有休' ? 'ﾌﾘｰ' : effective.type === '希望休なし' ? 'なし' : effective.type === '取消(クリア)' ? '' : effective.type.slice(0, 2)}
                                                    </span>
                                                    {!effective.isNew && effective.status === 'pending' && <span className="text-[7px] bg-yellow-400 text-white px-0.5 rounded" title="承認待ち">待</span>}
                                                    {!effective.isNew && effective.status === 'approved' && <span className="text-[7px] bg-green-500 text-white px-0.5 rounded" title="承認済">済</span>}
                                                    {!effective.isNew && effective.status === 'rejected' && <span className="text-[7px] bg-gray-500 text-white px-0.5 rounded" title="却下">却</span>}
                                                </div>
                                            )}
                                        </button>
                                        <div className="flex flex-col">
                                            {stSlots.allowed !== 999 && (
                                                <div className={`text-[7px] text-center font-bold tracking-tighter truncate ${stSlots.remaining < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                    店休枠:{stSlots.remaining}
                                                </div>
                                            )}
                                            {bkSlots.allowed !== 999 && stSlots.allowed !== 999 && (
                                                <div className={`text-[7px] text-center font-bold tracking-tighter truncate ${bkSlots.remaining < 0 ? 'text-red-500' : 'text-blue-400'}`}>
                                                    B休枠:{bkSlots.remaining}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Bottom Action Area (Always visible if any drafts or if staff selected) */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col gap-2 mb-2">
                    <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-gray-600">
                            {selectedStaffId && `選択中のスタッフ: 希望休・有休 ${limitCount} 日`}
                            {!selectedStaffId && `一括申請の準備`}
                        </span>
                        {hasAnyChanges && (
                            <span className="bg-orange-100 text-orange-700 text-sm font-bold px-3 py-1 rounded-full animate-pulse">
                                未申請の項目があります
                            </span>
                        )}
                    </div>
                    {hasAnyChanges && Object.keys(draftRequests).length > 0 && (
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span className="text-sm font-bold text-gray-500 mb-2 block">一括送信対象スタッフ:</span>
                            <div className="flex flex-wrap gap-2">
                                {Object.keys(draftRequests).filter(sid => Object.keys(draftRequests[sid]).length > 0).map(sid => {
                                    const s = staffs.find(st => st.id === sid);
                                    if (!s) return null;
                                    const count = Object.keys(draftRequests[sid]).length;
                                    return (
                                        <span key={sid} className="bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1">
                                            {s.lastName} {s.firstName}
                                            <span className="bg-paradise-ocean/10 text-paradise-ocean px-1.5 py-0.5 rounded-md text-xs">{count}変更</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {isOverLimit && selectedStaffId && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-4 border border-red-100 hover:border-red-300 transition-colors cursor-pointer" onClick={() => setIsManagerApproved(!isManagerApproved)}>
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                            <div className="flex-1">
                                <p className="text-sm font-bold leading-relaxed">
                                    3日を超過しています。事前に上長の承認が必要です。<br/>
                                    承認を得ている場合は、以下にチェックを入れてください。
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 bg-white p-2 rounded-lg border border-red-100">
                            <input 
                                type="checkbox" 
                                id="managerApprove"
                                checked={isManagerApproved} 
                                onChange={(e) => setIsManagerApproved(e.target.checked)}
                                className="w-5 h-5 rounded text-red-500 focus:ring-red-500 cursor-pointer"
                            />
                            <label htmlFor="managerApprove" className="text-base font-bold cursor-pointer select-none">上長の承認確認済み</label>
                        </div>
                    </div>
                )}

                <button 
                    onClick={handleSubmitAll}
                    disabled={!hasAnyChanges || isSubmitting}
                    className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-md
                        ${!hasAnyChanges || isSubmitting
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
                            : 'bg-gradient-to-r from-paradise-ocean to-paradise-blue text-white hover:shadow-lg hover:scale-[1.02] active:scale-95'
                        }
                    `}
                >
                    {isSubmitting ? '処理中...' : hasAnyChanges ? '全スタッフ分を一括申請する' : '変更がありません'}
                    {hasAnyChanges && !isSubmitting && <CheckCircle size={20} />}
                </button>
            </div>
        </div>
    );
};
