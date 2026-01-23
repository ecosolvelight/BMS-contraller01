import React from 'react';

interface DataCardProps {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
}

const DataCard: React.FC<DataCardProps> = ({ label, value, unit, icon, color }) => {
  return (
    <div className="bg-white rounded-[40px] p-8 flex flex-col items-start gap-5 shadow-xl shadow-slate-200/40 border border-white transition-all hover:-translate-y-1 active:scale-95 group overflow-hidden relative">
      <div className="absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 rounded-full transition-transform group-hover:scale-150 opacity-10" style={{ backgroundColor: color }}></div>
      
      {/* Removed invalid 'shadowColor' property which is not a valid CSS property in React's CSSProperties */}
      <div className="w-14 h-14 rounded-3xl flex items-center justify-center text-xl shadow-lg transition-transform group-hover:rotate-12" style={{ backgroundColor: `${color}15`, color: color }}>
        {icon}
      </div>
      
      <div className="z-10">
        <div className="text-[11px] font-cyber text-slate-400 uppercase tracking-widest mb-1 font-black">
          {label}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-mono font-black text-slate-800 tracking-tighter leading-none">
            {value.toFixed(1)}
          </span>
          <span className="text-xs font-sans text-slate-400 font-bold uppercase">{unit}</span>
        </div>
      </div>
      
      <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden mt-2">
        <div 
          className="h-full transition-all duration-1500 cubic-bezier(0.16, 1, 0.3, 1)" 
          style={{ 
            width: `${Math.min(100, (value / (unit === 'V' ? 60 : 20)) * 100)}%`, 
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`
          }}
        />
      </div>
    </div>
  );
};

export default DataCard;