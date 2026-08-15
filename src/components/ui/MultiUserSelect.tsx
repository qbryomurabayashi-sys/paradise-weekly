import React, { useState, useRef, useEffect } from 'react';
import { useUsersStore } from '../../store/useUsersStore';
import { GlassCard } from './GlassCard';
import { X, Search } from 'lucide-react';

interface AppUser {
  uid: string;
  name: string;
  role: string;
  storeName: string;
}

interface MultiUserSelectProps {
  selectedUsers: AppUser[];
  onChange: (users: AppUser[]) => void;
  placeholder?: string;
}

export const MultiUserSelect: React.FC<MultiUserSelectProps> = ({ selectedUsers, onChange, placeholder = "担当者を追加..." }) => {
  const { users } = useUsersStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredUsers = users.filter(u => 
    (u.name.includes(search) || u.storeName.includes(search) || u.role.includes(search)) &&
    !selectedUsers.find(su => su.uid === u.uid)
  );

  const handleSelect = (u: AppUser) => {
    onChange([...selectedUsers, u]);
    setSearch('');
  };

  const handleRemove = (uid: string) => {
    onChange(selectedUsers.filter(u => u.uid !== uid));
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className="min-h-[40px] px-2 py-1 w-full bg-white/50 border rounded-xl outline-none focus-within:border-paradise-ocean flex flex-wrap gap-1 items-center cursor-text"
        onClick={() => setIsOpen(true)}
      >
        {selectedUsers.map(u => (
          <span key={u.uid} className="flex items-center gap-1 bg-paradise-ocean/10 text-paradise-ocean px-2 py-1 border border-paradise-ocean/20 rounded-md text-xs font-bold">
            {u.name}
            <button onClick={(e) => { e.stopPropagation(); handleRemove(u.uid); }} className="hover:text-paradise-sunset transition-colors">
              <X size={12} />
            </button>
          </span>
        ))}
        <input 
          type="text" 
          value={search}
          onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
          placeholder={selectedUsers.length === 0 ? placeholder : ""}
          className="flex-1 bg-transparent shrink-0 min-w[60px] outline-none text-sm text-gray-700 py-1 px-1"
        />
      </div>

      {isOpen && (
        <GlassCard className="absolute top-full left-0 right-0 z-[100] mt-2 p-2 max-h-48 overflow-y-auto no-scrollbar shadow-xl border border-white/60">
          {filteredUsers.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-2 font-bold">該当ユーザーがいません</div>
          ) : (
            filteredUsers.map(u => (
              <div 
                key={u.uid} 
                onClick={() => handleSelect(u)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 px-3 py-2 hover:bg-white/60 cursor-pointer rounded-lg transition-colors border-b border-gray-100 last:border-0"
              >
                <div className="font-bold text-base text-gray-800 whitespace-nowrap">{u.name}</div>
                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md text-left truncate max-w-full">{u.storeName} ({u.role})</div>
              </div>
            ))
          )}
        </GlassCard>
      )}
    </div>
  );
};
