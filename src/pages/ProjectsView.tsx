import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { MultiUserSelect } from '../components/ui/MultiUserSelect';
import { MessageSquare, Plus, X, Send } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';

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
  
  const [messages, setMessages] = useState<any[]>([]);
  const [msgText, setMsgText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Projects
  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      // ユーザーがメンバーに含まれているか、作成者であるか、またはBM/AMなら全て見れるようにする
      const visibleProjects = allProjects.filter((p: any) => 
        user?.role === 'BM' || user?.role === 'AM' || 
        p.authorId === user?.uid || 
        (p.members && p.members.some((m: any) => m.uid === user?.uid))
      );
      setProjects(visibleProjects);
    }, (error) => {
      console.error('Projects snapshot error:', error);
    });
    return () => unsub();
  }, [user]);

  // Load Messages for active project
  useEffect(() => {
    if (!activeProject) return;
    const q = query(collection(db, `projects/${activeProject.id}/messages`), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      console.error('Messages snapshot error:', error);
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
      authorId: user?.uid,
      authorName: user?.name,
      createdAt: new Date().toISOString()
    });
    setNewProjectName('');
    setSelectedMembers([]);
    setShowAdd(false);
  };

  const handleDeleteProject = async (id: string, projectName: string) => {
    // 削除確認時にプロジェクト名を含める
    if(window.confirm(`「${projectName}」スレッドを削除しますか？`)) {
      await deleteDoc(doc(db, 'projects', id));
      if(activeProject?.id === id) setActiveProject(null);
    }
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
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 px-4 pt-6 pb-24 h-[90vh]">
      {/* Project List */}
      <div className={`md:w-1/3 w-full flex flex-col gap-4 ${activeProject ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex justify-between items-center bg-white/40 p-4 rounded-3xl border border-white/40">
          <h2 className="font-black text-gray-800 flex items-center gap-2"><MessageSquare size={20} className="text-paradise-ocean"/> プロジェクト</h2>
          <button onClick={() => setShowAdd(!showAdd)} className="bg-paradise-ocean text-white p-2 text-sm rounded-full shadow-md"><Plus size={16}/></button>
        </div>

        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="glass p-4 rounded-3xl flex flex-col gap-3">
              <input type="text" value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} placeholder="グループ名..." className="flex-1 p-2 rounded-xl text-base border outline-none font-bold text-gray-700 w-full" />
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">メンバー選択</div>
              <MultiUserSelect selectedUsers={selectedMembers} onChange={setSelectedMembers} placeholder="メンバーを追加..." />
              <button 
                onClick={handleCreateProject} 
                disabled={!newProjectName}
                className="bg-paradise-mint text-white py-2 rounded-xl font-bold text-base disabled:opacity-50 mt-1"
              >
                作成
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pb-10">
          {projects.map(p => (
            <div key={p.id} onClick={() => setActiveProject(p)} className={`p-4 rounded-3xl cursor-pointer transition-all border ${activeProject?.id === p.id ? 'bg-paradise-ocean/10 border-paradise-ocean shadow-inner' : 'bg-white/60 border-white/50 hover:bg-white/80'} flex justify-between items-center group`}>
              <div>
                <div className="font-bold text-gray-800">{p.name}</div>
                <div className="text-xs text-gray-400 font-bold mt-1 max-w-[150px] truncate">
                  {p.members ? p.members.map((m: any) => m.name).join(', ') : 'メンバーなし'}
                </div>
              </div>
              {(user?.role === 'BM' || user?.role === 'AM' || p.authorId === user?.uid) && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id, p.name); }} 
                  className="text-gray-400 hover:text-red-500 bg-white/50 p-2 rounded-full transition-all shadow-sm active:scale-95 ml-2 shrink-0"
                  title="スレッド削除"
                >
                  <X size={14}/>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {activeProject ? (
        <div className="flex-1 flex flex-col glass rounded-[2rem] border border-white/50 overflow-hidden relative shadow-2xl">
          <div className="bg-white/80 backdrop-blur-md p-4 border-b border-white/50 flex justify-between items-center z-10 sticky top-0">
             <div className="flex items-center gap-2">
               <button onClick={() => setActiveProject(null)} className="md:hidden text-gray-500 mr-2 hover:bg-gray-100 p-1 rounded-full px-3 text-sm font-bold">戻る</button>
               <h3 className="font-black text-gray-800">{activeProject.name}</h3>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
            {messages.map(m => {
              const isMine = m.authorId === user?.uid;
              return (
                <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs font-bold text-gray-400 mb-1 px-2">{m.authorName} ({m.authorRole})</span>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-base leading-relaxed shadow-sm ${isMine ? 'bg-paradise-ocean text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm border border-white/50'}`}>
                    {m.text}
                  </div>
                  <span className="text-[10px] text-gray-300 mt-1">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white/60 backdrop-blur-md border-t border-white/50">
            <div className="flex gap-2 relative">
              <input 
                type="text" 
                value={msgText} 
                onChange={e=>setMsgText(e.target.value)} 
                onKeyPress={e=>e.key === 'Enter' && handleSendMessage()}
                placeholder="メッセージを入力..."
                className="flex-1 p-3 rounded-full bg-white border-2 border-white/80 focus:border-paradise-ocean outline-none shadow-inner"
              />
              <button onClick={handleSendMessage} className="bg-paradise-ocean text-white p-3 px-4 rounded-full shadow-lg active:scale-95"><Send size={20}/></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center bg-white/30 rounded-[2rem] border border-white/30 text-gray-400 font-bold border-dashed">
          プロジェクトを選択してください
        </div>
      )}
    </div>
  );
};
