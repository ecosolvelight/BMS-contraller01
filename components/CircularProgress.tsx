import React from 'react';

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ 
  value = 0, 
  size = 200, 
  strokeWidth = 14 
}) => {
  const safeValue = isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (safeValue / 100) * circumference;

  const getStyle = () => {
    if (safeValue > 60) return { color: '#10b981', glow: 'rgba(16, 185, 129, 0.2)' };
    if (safeValue > 20) return { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.2)' };
    return { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.2)' };
  };

  const style = getStyle();

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div 
        className="absolute inset-0 rounded-full blur-3xl opacity-20 scale-125 transition-all duration-1000"
        style={{ backgroundColor: style.color }}
      />
      
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F8FAFC"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={style.color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          style={{ 
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
            filter: `drop-shadow(0 0 8px ${style.glow})`
          }}
        />
      </svg>
      
      <div className="absolute flex flex-col items-center">
        <span className="text-6xl font-sans font-black text-slate-800 tracking-tighter leading-none">
          {Math.round(safeValue)}
          <span className="text-xl ml-1 text-slate-300 font-bold">%</span>
        </span>
        <div className="w-12 h-1.5 bg-slate-100 rounded-full my-4 overflow-hidden">
           <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${safeValue}%`, backgroundColor: style.color }}></div>
        </div>
        <span className="text-[10px] uppercase tracking-[0.5em] font-cyber text-slate-400 font-black">
          Capacity
        </span>
      </div>
    </div>
  );
};

export default CircularProgress;