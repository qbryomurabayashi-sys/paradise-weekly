import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = "", hoverEffect = true }) => {
  return (
    <div className={`
      glass rounded-[2rem] p-6 
      transition-all duration-500 
      ${hoverEffect ? 'hover:translate-y-[-8px] hover:bg-white/50 hover:shadow-2xl' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};
