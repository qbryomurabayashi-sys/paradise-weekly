import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { MultiUserSelect } from '../components/ui/MultiUserSelect';
import { MessageSquare, Plus, X, Send, Trash2, AlertTriangle } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, serverTimestamp, where, limit } from 'firebase/firestore';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { displayRole, formatStaffName } from '../lib/formatUtils';

interface AppUser {
  uid: string;
  name: string;
  role: string;
  storeName: string;
}

export const ProjectsView = () => {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<AppUser[]>([]);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [msgText, setMsgText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Projects
  useEffect(() => {
    let q;
    // SECURITY FIX: Query projects directly based on role to prevent data leak.
    if (user?.role === 'BM' || user?.role === 'AM') {
        q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'), limit(100));
    } else {
        q = query(collection(db, 'projects'), where('memberUids', 'array-contains', user?.uid), orderBy('createdAt', 'desc'), limit(100));
    }

    const unsub = onSnapshot(q, snap => {
      const visibleProjects = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setProjects(visibleProjects);
    }, (error) => {
      if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
        document.dispatchEvent(new CustomEvent('quota-exceeded'));
      } else {
      console.error('Projects snapshot error:', error);
      }
    });
    return () => unsub();
  }, [user]);

  // Load Messages for active project
  useEffect(() => {
    if (!activeProject) return;
    const q = query(collection(db, `projects/${activeProject.id}/messages`), orderBy('createdAt', 'asc'), limit(200));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
        document.dispatchEvent(new CustomEvent('quota-exceeded'));
      } else {
      console.error('Messages snapshot error:', error);
      }
    });
    return () => unsub();
  }, [activeProject]);

  const handleCreateProject = async () => {
    if(!newProjectName) return;

    // 自分を含める
    const members = selectedMembers.map(u => ({ uid: u.uid, name: u.name }));
    if (!members.find(m => m.uid === user?.uid)) {
      members.push({ uid: user!.uid, name: user!.name });
    }

    await addDoc(collection(db, 'projects'), {
      name: newProjectName,
      members,
      memberUids: members.map(m => m.uid),
      authorId: user?.uid,
      authorName: user?.name,
      createdAt: new Date().toISOString()
    });
    setNewProjectName('');
    setSelectedMembers([]);
    setShowAdd(false);
  };

  const performDeleteProject = async (id: string) => {
    await deleteDoc(doc(db, 'projects', id));
    if(activeProject?.id === id) setActiveProject(null);
    setConfirmDelete(null);
  };

  const handleSendMessage = async () => {
    if(!msgText.trim() || !activeProject) return;
    const text = msgText;
    setMsgText('');
    await addDoc(collection(db, `projects/${activeProject.id}/messages`), {
      text,
      authorId: user?.uid,
      authorName: user?.name,
      authorRole: user?.role,
      createdAt: new Date().toISOString()
    });

    if (activeProject.members) {
      activeProject.members.forEach(async (member: any) => {
        if (member.uid !== user?.uid) {
          try {
            await addDoc(collection(db, `users/${member.uid}/notifications`), {
              type: 'comment',
              fromUserId: user?.uid,
              fromUserName: user?.name,
              reportId: 'projects',
              message: `「${activeProject.name}」グループチャットでメッセージを受信しました。`,
              isRead: false,
              createdAt: new Date().toISOString()
            });
          } catch(e) {
            console.error('Failed to send notification to member:', e);
          }
        }
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 px-4 pt-6 pb-24 h-[90vh]">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-qb-navy/40 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface rounded-3xl shadow-2xl p-6 w-full max-w-sm space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="text-danger" size={28} />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-ink">グループチャットを削除</h3>
                <p className="text-sm font-bold text-ink-soft leading-relaxed">
                  「{confirmDelete.name}」を削除しますか？<br/>この操作は元に戻せません。
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="tap flex-1 py-3 rounded-xl bg-canvas border border-line text-ink-soft font-bold hover:bg-line transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => performDeleteProject(confirmDelete.id)}
                  className="tap flex-1 py-3 rounded-xl bg-danger text-white font-black shadow-lg shadow-danger/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> 削除する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project List */}
      <div className={`md:w-1/3 w-full flex flex-col gap-4 ${activeProject ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex justify-between items-center bg-surface/60 p-4 rounded-3xl border border-line">
          <h2 className="font-black text-ink flex items-center gap-2"><MessageSquare size={20} className="text-qb-blue"/> グループチャット</h2>
          <button onClick={() => setShowAdd(!showAdd)} className="tap bg-gradient-to-r from-qb-blue to-qb-cyan text-white p-2 rounded-full shadow-md shadow-qb-cyan/20 active:scale-95 transition-transform"><Plus size={18}/></button>
        </div>

        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="glass p-4 rounded-3xl flex flex-col gap-3">
              <input type="text" value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} placeholder="グループ名..." enterKeyHint="done" className="min-h-[44px] flex-1 p-3 rounded-xl text-base border border-line bg-surface outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan transition-all font-bold text-ink w-full" />
              <div className="text-xs font-bold text-ink-soft uppercase tracking-widest pl-1">メンバー選択</div>
              <MultiUserSelect selectedUsers={selectedMembers} onChange={setSelectedMembers} placeholder="メンバーを追加..." />
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName}
                className="tap bg-gradient-to-r from-qb-blue to-qb-cyan text-white py-3 rounded-xl font-black text-base shadow-lg shadow-qb-cyan/20 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 mt-1"
              >
                作成
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pb-10">
          {projects.map(p => (
            <div key={p.id} onClick={() => setActiveProject(p)} className={`p-4 rounded-3xl cursor-pointer transition-all border ${activeProject?.id === p.id ? 'bg-qb-blue/10 border-qb-blue shadow-inner' : 'bg-surface/60 border-line hover:bg-surface'} flex justify-between items-center group`}>
              <div className="min-w-0">
                <div className="font-bold text-ink truncate">{p.name}</div>
                <div className="text-xs text-ink-soft font-bold mt-1 max-w-[150px] truncate">
                  {p.members ? p.members.map((m: any) => formatStaffName(m.name || '')).join(', ') : 'メンバーなし'}
                </div>
              </div>
              {(user?.role === 'BM' || user?.role === 'AM' || p.authorId === user?.uid) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: p.id, name: p.name }); }}
                  className="tap text-qb-gray hover:text-danger bg-surface/70 p-2 rounded-full transition-all shadow-sm active:scale-95 ml-2 shrink-0"
                  title="スレッド削除"
                >
                  <X size={16}/>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {activeProject ? (
        <div className="flex-1 flex flex-col glass rounded-[2rem] border border-line overflow-hidden relative shadow-2xl">
          <div className="bg-surface/80 backdrop-blur-md p-4 border-b border-line flex justify-between items-center z-10 sticky top-0">
             <div className="flex items-center gap-2">
               <button onClick={() => setActiveProject(null)} className="tap md:hidden text-ink-soft mr-2 hover:bg-canvas p-1 rounded-full px-3 text-sm font-bold">戻る</button>
               <h3 className="font-black text-ink">{activeProject.name}</h3>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-canvas/40">
            {messages.map(m => {
              const isMine = m.authorId === user?.uid;
              return (
                <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs font-bold text-ink-soft mb-1 px-2">{formatStaffName(m.authorName)} ({displayRole(m.authorRole || '店長')})</span>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-base leading-relaxed shadow-sm ${isMine ? 'bg-qb-blue text-white rounded-tr-sm' : 'bg-surface text-ink rounded-tl-sm border border-line'}`}>
                    {m.text}
                  </div>
                  <span className="text-xs text-qb-gray mt-1 tabular">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-surface/60 backdrop-blur-md border-t border-line">
            <div className="flex gap-2 relative">
              <input
                type="text"
                value={msgText}
                onChange={e=>setMsgText(e.target.value)}
                onKeyPress={e=>e.key === 'Enter' && handleSendMessage()}
                placeholder="メッセージを入力..."
                enterKeyHint="send"
                className="min-h-[44px] flex-1 p-3 rounded-full bg-surface border-2 border-line focus:border-qb-cyan outline-none shadow-inner text-ink"
              />
              <button onClick={handleSendMessage} className="tap bg-gradient-to-r from-qb-blue to-qb-cyan text-white p-3 px-4 rounded-full shadow-lg shadow-qb-cyan/20 active:scale-95 transition-transform"><Send size={20}/></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center bg-surface/40 rounded-[2rem] border border-line text-ink-soft font-bold border-dashed">
          グループチャットを選択してください
        </div>
      )}
    </div>
  );
};
