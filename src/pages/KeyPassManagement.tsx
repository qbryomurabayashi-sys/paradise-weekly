import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useShiftStore } from '../store/useShiftStore';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { GlassCard } from '../components/ui/GlassCard';
import { Key, ShieldCheck, Mail, Lock, AlertTriangle, CheckCircle, ChevronLeft, ChevronDown, Stars, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Possession {
  type: 'key' | 'pass' | 'safe_pwd' | 'post_pwd';
  storeName: string;
  lastCheckedAt?: string;
  checkMethod?: 'photo' | 'physical';
  lastCheckedByName?: string;
}

interface KeyPassRecord {
  id: string; // userId
  userName: string;
  possessions: Possession[];
  lastCheckedAt: string;
}

interface StoreKeyPass {
  id: string; // storeId
  storeName: string;
  items: { text: string; id: string }[];
  lastCheckedAt: string;
  lastCheckedByName?: string;
  checkMethod?: 'photo' | 'physical';
}

export const KeyPassManagement = () => {
  const { user, viewMode, setViewMode } = useAuthStore();
  const navigate = useNavigate();
  const { stores, initStores, staffs, initStaffs } = useShiftStore();
  
  const [records, setRecords] = useState<KeyPassRecord[]>([]);
  const [storeRecords, setStoreRecords] = useState<StoreKeyPass[]>([]);
  
  // Form State
  const [selectedFilterStoreId, setSelectedFilterStoreId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [possessions, setPossessions] = useState<Possession[]>([]);
  const [storeInputs, setStoreInputs] = useState<Record<string, string>>({});
  const [staffTab, setStaffTab] = useState<'registered' | 'unregistered'>('registered');
  const [mainTab, setMainTab] = useState<'list' | 'edit' | 'store'>('list');
  const [expandedStores, setExpandedStores] = useState<string[]>([]);

  useEffect(() => {
    const unsubStores = initStores();
    const unsubStaffs = initStaffs();
    
    const unsubPersonal = onSnapshot(collection(db, 'key_passes'), (snapshot) => {
      const data: KeyPassRecord[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as KeyPassRecord);
      });
      setRecords(data);
    });

    const unsubStore = onSnapshot(collection(db, 'store_key_passes'), (snapshot) => {
      const data: StoreKeyPass[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as StoreKeyPass);
      });
      setStoreRecords(data);
    });

    return () => {
      unsubStores();
      unsubStaffs();
      unsubPersonal();
      unsubStore();
    };
  }, []);

  useEffect(() => {
    if (selectedStaffId && records) {
      const record = records.find(r => r.id === selectedStaffId);
      setPossessions(record?.possessions || []);
    } else {
      setPossessions([]);
    }
  }, [selectedStaffId, records]);

  // BM should only check?
  const isActuallyBM = user?.role === 'BM';
  const activeRole = isActuallyBM && viewMode ? viewMode : user?.role;
  const isBM = activeRole === 'BM';

  const handleUpdateCheck = async () => {
    if (!selectedStaffId) return;
    const staff = staffs.find(s => s.id === selectedStaffId);
    if (!staff) return;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'key_passes', selectedStaffId), {
        userName: `${staff.lastName} ${staff.firstName}`,
        possessions,
        lastCheckedAt: now
      }, { merge: true });
      alert('現物確認を更新しました！');
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました');
    }
  };

  const handleUpdateStoreCheck = async (storeId: string, storeName: string, method: 'photo' | 'physical') => {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'store_key_passes', storeId), {
        storeName,
        lastCheckedAt: now,
        lastCheckedByName: user.name,
        checkMethod: method
      }, { merge: true });
      alert(`${storeName}の店舗保管分を${method === 'photo' ? '写真' : '現物'}確認しました！`);
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました');
    }
  };

  const addStoreItem = async (storeId: string, storeName: string, text: string) => {
    if (!text.trim()) return;
    try {
      const existing = storeRecords.find(r => r.id === storeId);
      const items = existing?.items || [];
      const newItems = [...items, { id: Date.now().toString(), text }];
      
      await setDoc(doc(db, 'store_key_passes', storeId), {
        storeName,
        items: newItems
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const removeStoreItem = async (storeId: string, itemId: string) => {
     try {
      const existing = storeRecords.find(r => r.id === storeId);
      if (!existing) return;
      const newItems = existing.items.filter(i => i.id !== itemId);
      await setDoc(doc(db, 'store_key_passes', storeId), {
        items: newItems
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const togglePossession = (storeName: string, type: 'key' | 'pass' | 'safe_pwd' | 'post_pwd') => {
    const exists = possessions.some(p => p.storeName === storeName && p.type === type);
    if (exists) {
      setPossessions(possessions.filter(p => !(p.storeName === storeName && p.type === type)));
    } else {
      setPossessions([...possessions, { type, storeName }]);
    }
  };

  const getAlertStatus = (record?: KeyPassRecord) => {
    if (!record) return false;
    const hasPhysical = record.possessions?.some(p => p.type === 'key' || p.type === 'pass');
    if (!hasPhysical) return false; 

    if (!record.lastCheckedAt) return true;
    
    const lastCheck = new Date(record.lastCheckedAt);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return lastCheck < oneMonthAgo;
  };

  const translateType = (type: string) => {
    switch(type) {
      case 'key': return '鍵所持';
      case 'pass': return '入館証所持';
      case 'safe_pwd': return '金庫番号把握';
      case 'post_pwd': return 'ポスト番号把握';
      default: return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'key': return <Key size={14} className="text-yellow-600" />;
      case 'pass': return <ShieldCheck size={14} className="text-blue-600" />;
      case 'safe_pwd': return <Lock size={14} className="text-purple-600" />;
      case 'post_pwd': return <Mail size={14} className="text-pink-600" />;
      default: return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 px-4 animate-fade-in pt-6">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-white/80 font-bold hover:text-white transition-all group p-2"
      >
        <ChevronLeft className="group-hover:-translate-x-1 transition-transform" /> 戻る
      </button>

      <div className="flex items-center gap-3">
        <Key className="text-white fill-white/20" size={32} />
        <h2 className="text-2xl font-black text-white drop-shadow-md tracking-widest uppercase">鍵・入館証管理</h2>
      </div>

      {isActuallyBM && (
        <div className="mb-6 px-4 py-3 mx-2 bg-gradient-to-r from-paradise-blue/20 to-paradise-lavender/20 border-2 border-white/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <span className="text-sm font-black text-gray-600 uppercase tracking-widest flex items-center gap-2"><Stars size={16} className="text-paradise-ocean"/> 【BM専用】視点シミュレーション</span>
            <div className="flex flex-wrap justify-center gap-2">
                <button 
                  onClick={() => setViewMode(null)} 
                  className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-colors ${!viewMode ? 'bg-paradise-sunset text-white shadow' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
                >
                    BM視点
                </button>
                <button 
                  onClick={() => setViewMode('AM')} 
                  className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-colors ${viewMode === 'AM' ? 'bg-paradise-ocean text-white shadow' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
                >
                    AM視点
                </button>
                <button 
                  onClick={() => setViewMode('店長')} 
                  className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-colors ${viewMode === '店長' ? 'bg-emerald-500 text-white shadow' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
                >
                    店長視点
                </button>
            </div>
        </div>
      )}

      <div className="flex bg-white/40 p-1.5 rounded-2xl mx-1 overflow-x-auto no-scrollbar shadow-inner border border-white/20">
        <button
           onClick={() => setMainTab('list')}
           className={`flex-1 min-w-[120px] py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${mainTab === 'list' ? 'bg-white text-gray-800 shadow-md' : 'text-gray-600 hover:bg-white/60'}`}
        >
          スタッフ一覧確認
        </button>
        {!isBM && (
           <button
             onClick={() => setMainTab('edit')}
             className={`flex-1 min-w-[120px] py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${mainTab === 'edit' ? 'bg-white text-gray-800 shadow-md' : 'text-gray-600 hover:bg-white/60'}`}
           >
             所持状況登録
           </button>
        )}
        <button
           onClick={() => setMainTab('store')}
           className={`flex-1 min-w-[120px] py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${mainTab === 'store' ? 'bg-white text-gray-800 shadow-md' : 'text-gray-600 hover:bg-white/60'}`}
        >
          店舗保管分管理
        </button>
      </div>

      {!isBM && mainTab === 'edit' && (
        <GlassCard className="p-6 space-y-6">
          <h3 className="text-xl font-bold text-gray-800 border-b border-gray-100 pb-2">スタッフの所持状況登録・確認</h3>
          
          <div className="bg-white/50 p-4 rounded-xl border border-white/40 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">店舗を選択</label>
                <select 
                  value={selectedFilterStoreId}
                  onChange={(e) => {
                    setSelectedFilterStoreId(e.target.value);
                    setSelectedStaffId(''); // Reset staff selection on store change
                  }}
                  className="w-full p-3 rounded-xl bg-white focus:outline-none border border-gray-200 text-gray-700"
                >
                  <option value="">すべての店舗</option>
                  {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">スタッフを選択</label>
                <select 
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white focus:outline-none border border-gray-200 text-gray-700"
                >
                  <option value="">スタッフを選択...</option>
                  {staffs
                    .filter(s => selectedFilterStoreId ? s.storeId === selectedFilterStoreId : true)
                    .map(s => <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>)}
                </select>
              </div>
            </div>

            {selectedStaffId && (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">登録アイテムの編集（タップで追加・解除）</label>
                <div className="grid grid-cols-1 gap-3">
                  {stores.map(store => {
                     const keyActive = possessions.some(p => p.storeName === store.name && p.type === 'key');
                     const passActive = possessions.some(p => p.storeName === store.name && p.type === 'pass');
                     const safeActive = possessions.some(p => p.storeName === store.name && p.type === 'safe_pwd');
                     const postActive = possessions.some(p => p.storeName === store.name && p.type === 'post_pwd');

                     return (
                       <div key={store.id} className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                           <div className="font-bold text-gray-800 text-base border-b border-gray-50 pb-2 flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-paradise-ocean"></span>
                             {store.name}
                           </div>
                           <div className="grid grid-cols-2 md:grid-cols-4 w-full gap-2">
                             <button
                               onClick={() => togglePossession(store.name, 'key')}
                               className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 rounded-lg text-xs sm:text-sm font-bold transition-all border-2 ${keyActive ? 'bg-yellow-50 border-yellow-300 text-yellow-700 shadow-sm' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}
                             >
                                <Key size={18} className="mb-1 sm:mb-0"/> <span>鍵所持</span>
                             </button>
                             <button
                               onClick={() => togglePossession(store.name, 'pass')}
                               className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 rounded-lg text-xs sm:text-sm font-bold transition-all border-2 ${passActive ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}
                             >
                                <ShieldCheck size={18} className="mb-1 sm:mb-0"/> <span>入館証所持</span>
                             </button>
                             <button
                               onClick={() => togglePossession(store.name, 'safe_pwd')}
                               className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 rounded-lg text-xs sm:text-sm font-bold transition-all border-2 ${safeActive ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}
                             >
                                <Lock size={18} className="mb-1 sm:mb-0"/> <span>金庫番号把握</span>
                             </button>
                             <button
                               onClick={() => togglePossession(store.name, 'post_pwd')}
                               className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-3 rounded-lg text-xs sm:text-sm font-bold transition-all border-2 ${postActive ? 'bg-pink-50 border-pink-300 text-pink-700 shadow-sm' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}
                             >
                                <Mail size={18} className="mb-1 sm:mb-0"/> <span>ポスト番号把握</span>
                             </button>
                           </div>
                       </div>
                     )
                  })}
                </div>

                <div className="pt-4 border-t border-gray-100 mt-4 flex justify-between items-center flex-wrap gap-4 bg-gray-50 p-4 rounded-xl">
                   <div>
                     <p className="text-xs font-bold text-gray-500">最終確認日時</p>
                     <p className="font-bold text-gray-800">
                       {records.find(r => r.id === selectedStaffId)?.lastCheckedAt ? new Date(records.find(r => r.id === selectedStaffId)!.lastCheckedAt).toLocaleString() : '未確認'}
                     </p>
                   </div>
                   <button 
                     onClick={handleUpdateCheck}
                     className="bg-paradise-ocean text-white px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-paradise-ocean/50 flex items-center gap-2 transition-all active:scale-95 w-full sm:w-auto justify-center"
                   >
                     <CheckCircle size={20} />
                     当月の現物確認を保存して完了する
                   </button>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {mainTab === 'store' && (
        <GlassCard className="p-6 space-y-6">
          <h3 className="text-xl font-bold text-gray-800 border-b border-gray-100 pb-2">店舗保管分の管理</h3>
        <div className="space-y-6">
          {[...stores].sort((a, b) => {
            const aRec = storeRecords.find(r => r.id === a.id);
            const bRec = storeRecords.find(r => r.id === b.id);
            const aHasItems = aRec?.items && aRec.items.length > 0 ? 1 : 0;
            const bHasItems = bRec?.items && bRec.items.length > 0 ? 1 : 0;
            return bHasItems - aHasItems;
          }).map(store => {
            const storeRec = storeRecords.find(r => r.id === store.id);
            const items = storeRec?.items || [];
            const hasItems = items.length > 0;
            
            return (
              <div key={store.id} className={`p-4 rounded-2xl border transition-all ${hasItems ? 'bg-blue-50/60 border-blue-200 shadow-sm' : 'bg-white/60 border-white/40'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                  <h4 className="font-bold text-gray-800 text-lg">{store.name}</h4>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-bold text-gray-500">
                        {storeRec?.checkMethod === 'photo' ? '写真で最終確認: ' : storeRec?.checkMethod === 'physical' ? '現物で最終確認: ' : '最終確認: '} 
                        {storeRec?.lastCheckedByName || '未確認'}
                      </p>
                      <p className="text-sm font-black text-gray-700">{storeRec?.lastCheckedAt ? new Date(storeRec.lastCheckedAt).toLocaleDateString() : '-'}</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                          onClick={() => handleUpdateStoreCheck(store.id, store.name, 'photo')}
                          className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 transition-all border border-blue-200"
                        >
                          <Camera size={14}/> 写真確認
                        </button>
                        <button 
                          onClick={() => handleUpdateStoreCheck(store.id, store.name, 'physical')}
                          className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 transition-all border border-emerald-200"
                        >
                          <CheckCircle size={14}/> 現物確認
                        </button>
                      </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-gray-400">保管アイテムなし</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map(item => (
                         <li key={item.id} className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl text-sm font-medium border border-gray-100 relative group">
                           <span className="flex-1 text-gray-700">{item.text}</span>
                           {!isBM && (
                             <button onClick={() => removeStoreItem(store.id, item.id)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 w-7 h-7 rounded-full flex items-center justify-center transition-colors">×</button>
                           )}
                         </li>
                      ))}
                    </ul>
                  )}
                  
                  {!isBM && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <input 
                        type="text" 
                        value={storeInputs[store.id] || ''}
                        onChange={(e) => setStoreInputs({ ...storeInputs, [store.id]: e.target.value })}
                        placeholder="例：鍵1点（緊急用）" 
                        className="flex-1 p-3 sm:p-2 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none"
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
                        className="bg-gray-800 text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                      >
                        追加
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
      )}

      {mainTab === 'list' && (
      <GlassCard className="p-6 space-y-6">
        <h3 className="text-xl font-bold text-gray-800 border-b border-gray-100 pb-2">スタッフ一覧状況</h3>
        
        <div className="flex gap-2">
          <button
             onClick={() => setStaffTab('registered')}
             className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${staffTab === 'registered' ? 'bg-paradise-ocean text-white shadow-md' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
          >
            登録済みスタッフ
          </button>
          <button
             onClick={() => setStaffTab('unregistered')}
             className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${staffTab === 'unregistered' ? 'bg-gray-800 text-white shadow-md' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
          >
            未登録スタッフ
          </button>
        </div>

        <div className="grid gap-4">
          {(() => {
            const filteredStaffs = staffs.filter((staff) => {
              const record = records.find(r => r.id === staff.id);
              const hasPossessions = record && record.possessions && record.possessions.length > 0;
              return staffTab === 'registered' ? hasPossessions : !hasPossessions;
            });

            if (filteredStaffs.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  該当するスタッフがいません
                </div>
              );
            }

            const toggleStoreAccordion = (storeId: string) => {
              setExpandedStores(prev => 
                 prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
              );
            };

            const groupedStaffs = filteredStaffs.reduce((acc, staff) => {
              const store = stores.find(s => s.id === staff.storeId);
              const storeName = store ? store.name : '所属店舗なし';
              const sId = store ? store.id : 'unassigned';
              if (!acc[sId]) acc[sId] = { name: storeName, staffs: [] };
              acc[sId].staffs.push(staff);
              return acc;
            }, {} as Record<string, { name: string, staffs: typeof staffs }>);

            const groupedStaffsArray = Object.entries(groupedStaffs).sort(([storeIdA], [storeIdB]) => {
              if (storeIdA === 'unassigned') return 1;
              if (storeIdB === 'unassigned') return -1;
              const indexA = stores.findIndex(s => s.id === storeIdA);
              const indexB = stores.findIndex(s => s.id === storeIdB);
              return (indexA !== -1 ? indexA : Infinity) - (indexB !== -1 ? indexB : Infinity);
            });

            return groupedStaffsArray.map(([storeId, group]) => {
               const isExpanded = expandedStores.includes(storeId);
               
               return (
                 <div key={storeId} className="bg-white/80 rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                   <div 
                     className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                     onClick={() => toggleStoreAccordion(storeId)}
                   >
                     <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                       {group.name}
                       <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                         {group.staffs.length}名
                       </span>
                     </h4>
                     <ChevronDown className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={20} />
                   </div>
                   
                   {isExpanded && (
                     <div className="p-4 pt-0 grid gap-4 border-t border-gray-100 bg-gray-50/30">
                       <div className="mt-4 grid gap-4">
                         {group.staffs.map((staff) => {
                           const record = records.find(r => r.id === staff.id);
                           const isAlert = getAlertStatus(record);
                           
                           return (
                             <div key={staff.id} 
                                  className={`p-4 rounded-2xl border-2 transition-all shadow-sm flex flex-col gap-4 cursor-pointer hover:scale-[1.01] ${isAlert ? 'bg-red-50/50 border-red-200' : 'bg-white border-white/40'} ${selectedStaffId === staff.id ? 'ring-2 ring-paradise-ocean' : ''}`}
                                  onClick={() => {
                                      if (!isBM) {
                                        setSelectedStaffId(staff.id);
                                        setMainTab('edit');
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }
                                  }}
                             >
                             <div className="w-full">
                               <div className="flex items-center gap-3">
                                 <h4 className="font-bold text-gray-800 text-lg">{staff.lastName} {staff.firstName} <span className="text-xs text-gray-400 font-normal">({staff.employmentType === 'parttime' ? 'パート' : '正社員'})</span></h4>
                                 {isAlert && (
                                   <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-md animate-pulse">
                                     <AlertTriangle size={14} /> 1ヶ月未確認
                                   </span>
                                 )}
                               </div>
                               <div className="flex flex-col gap-2 mt-3 w-full">
                                 {record?.possessions?.map((p, i) => (
                                   <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/80 px-3 py-2.5 rounded-xl border border-gray-100 w-full">
                                     <div className="flex flex-wrap items-center gap-2">
                                       {getTypeIcon(p.type)}
                                       <span className="text-sm font-bold text-gray-700">{p.storeName} <span className="text-xs text-gray-500">({translateType(p.type)})</span></span>
                                       {p.lastCheckedAt && (
                                         <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-medium whitespace-nowrap">
                                           {p.checkMethod === 'photo' ? '写真' : p.checkMethod === 'physical' ? '現物' : ''} {new Date(p.lastCheckedAt).toLocaleDateString()}
                                           {p.lastCheckedByName && ` (確認者: ${p.lastCheckedByName})`}
                                         </span>
                                       )}
                                     </div>
                                     {!isBM && staffTab === 'registered' && (
                                       <div className="flex gap-1.5 shrink-0 w-full sm:w-auto">
                                         <button
                                           onClick={async (e) => {
                                             e.stopPropagation();
                                             try {
                                               const now = new Date().toISOString();
                                               const newPossessions = [...(record?.possessions || [])];
                                               newPossessions[i] = { ...p, lastCheckedAt: now, checkMethod: 'photo', lastCheckedByName: user?.name };
                                               await setDoc(doc(db, 'key_passes', staff.id), {
                                                 userName: `${staff.lastName} ${staff.firstName}`,
                                                 possessions: newPossessions,
                                                 lastCheckedAt: now
                                               }, { merge: true });
                                             } catch (err) {
                                               console.error(err);
                                             }
                                           }}
                                           className="flex-1 sm:flex-none justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-blue-200 shadow-sm flex items-center gap-1"
                                         >
                                           <Camera size={14}/> 写真確認
                                         </button>
                                         <button
                                           onClick={async (e) => {
                                             e.stopPropagation();
                                             try {
                                               const now = new Date().toISOString();
                                               const newPossessions = [...(record?.possessions || [])];
                                               newPossessions[i] = { ...p, lastCheckedAt: now, checkMethod: 'physical', lastCheckedByName: user?.name };
                                               await setDoc(doc(db, 'key_passes', staff.id), {
                                                 userName: `${staff.lastName} ${staff.firstName}`,
                                                 possessions: newPossessions,
                                                 lastCheckedAt: now
                                               }, { merge: true });
                                             } catch (err) {
                                               console.error(err);
                                             }
                                           }}
                                           className="flex-1 sm:flex-none justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-emerald-200 shadow-sm flex items-center gap-1"
                                         >
                                           <CheckCircle size={14}/> 現物確認
                                         </button>
                                       </div>
                                     )}
                                   </div>
                                 )) || <span className="text-xs text-gray-400">所持品なし</span>}
                               </div>
                             </div>
                           </div>
                           );
                         })}
                       </div>
                     </div>
                   )}
                 </div>
               );
            });
          })()}
        </div>
      </GlassCard>
      )}
    </div>
  );
};

