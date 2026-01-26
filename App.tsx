import React, { useState, useEffect, useMemo, useRef } from 'react';
import CircularProgress from './components/CircularProgress';
import DataCard from './components/DataCard';
import { subscribeToDeviceData } from './services/firebase';
import { BMSData, Device, AppView } from './types';

const FloatingHexagons = () => {
  const hexData = useMemo(() => {
    const colors = ['#06b6d4', '#a855f7', '#22c55e', '#3b82f6'];
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 20 + Math.random() * 50,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 20 + Math.random() * 30,
      delay: Math.random() * -30,
      opacity: 0.1 + Math.random() * 0.3,
      rotation: Math.random() * 360,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-[2] overflow-hidden">
      {hexData.map((h) => (
        <svg
          key={h.id}
          className="floating-hex"
          width={h.size}
          height={h.size}
          viewBox="0 0 60 104"
          style={{
            left: `${h.x}%`,
            top: `${h.y}%`,
            color: h.color,
            opacity: h.opacity,
            animationDuration: `${h.duration}s`,
            animationDelay: `${h.delay}s`,
            position: 'absolute',
            filter: `drop-shadow(0 0 ${h.size / 6}px ${h.color})`,
            transform: `rotate(${h.rotation}deg)`,
          }}
        >
          <path d="M30 0l25.98 15v30L30 60 4.02 45V15z" stroke="currentColor" fill="none" />
        </svg>
      ))}
    </div>
  );
};

const HistoryChart = ({ data }: { data: number[] }) => {
  if (data.length < 2) return <div className="h-40 flex items-center justify-center text-slate-400 font-sans text-xs italic">Awaiting data stream...</div>;
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data, -1);
  const range = (max - min) || 1;
  const height = 150;
  const width = 300;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 overflow-visible">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M0,${height} L${points} L${width},${height} Z`} fill="url(#chartGrad)" />
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          style={{ transition: 'all 0.5s ease' }}
        />
        <line x1="0" y1={height - ((-min) / range) * height} x2={width} y2={height - ((-min) / range) * height} stroke="#E2E8F0" strokeDasharray="4" />
      </svg>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('splash');
  const [activeTab, setActiveTab] = useState<'live' | 'analytics'>('live');
  const [devices, setDevices] = useState<Device[]>(() => {
    const saved = localStorage.getItem('dms_devices');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [data, setData] = useState<BMSData | null>(null);
  const [currentHistory, setCurrentHistory] = useState<number[]>([]);
  const [cumulativeWh, setCumulativeWh] = useState<number>(() => {
    const saved = localStorage.getItem('bms_energy_total');
    return saved ? parseFloat(saved) : 0;
  });
  
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    localStorage.setItem('dms_devices', JSON.stringify(devices));
  }, [devices]);

  useEffect(() => {
    if (data) {
      const now = Date.now();
      const deltaHours = (now - lastUpdateRef.current) / (1000 * 60 * 60);
      lastUpdateRef.current = now;
      
      const watts = data.voltage * data.current;
      const deltaWh = Math.abs(watts * deltaHours);
      
      if (deltaWh > 0) {
        setCumulativeWh(prev => {
          const next = prev + deltaWh;
          localStorage.setItem('bms_energy_total', next.toString());
          return next;
        });
      }

      setCurrentHistory(prev => {
        const next = [...prev, data.current].slice(-40);
        return next;
      });
    }
  }, [data]);

  useEffect(() => {
    if (['device-list', 'add-device', 'dashboard'].includes(view)) {
      document.body.classList.add('internal-active');
    } else {
      document.body.classList.remove('internal-active');
    }
  }, [view]);

  useEffect(() => {
    if (view === 'splash') {
      const timer = setTimeout(() => setView('home'), 2500);
      return () => clearTimeout(timer);
    }
  }, [view]);

  useEffect(() => {
    if (activeDeviceId && view === 'dashboard') {
      const unsubscribe = subscribeToDeviceData(activeDeviceId, (newData) => {
        setData(newData);
      });
      return () => unsubscribe();
    }
  }, [activeDeviceId, view]);

  const [newDeviceMac, setNewDeviceMac] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');

  const addDevice = () => {
    if (!newDeviceMac.trim() || !newDeviceName.trim()) return;
    const cleanMac = newDeviceMac.trim().replace(/:/g, '').toUpperCase();
    const newDev: Device = { id: cleanMac, name: newDeviceName.trim(), lastConnected: Date.now() };
    setDevices([...devices, newDev]);
    setActiveDeviceId(newDev.id);
    setView('dashboard');
    setNewDeviceMac('');
    setNewDeviceName('');
  };

  const removeDevice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('Are you sure you want to unlink this unit?')) {
      setDevices(devices.filter(d => d.id !== id));
      if (activeDeviceId === id) setActiveDeviceId(null);
    }
  };

  if (view === 'splash') {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center p-6 safe-top safe-bottom">
        <div className="relative flex flex-col items-center animate-pulse">
          <div className="w-32 h-32 border-[3px] border-neonBlue rounded-[40px] rotate-45 flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.5)]">
            <div className="w-24 h-24 border-[2px] border-neonGreen rounded-full -rotate-45 flex items-center justify-center">
                <span className="text-4xl font-cyber font-black text-white tracking-widest">BMS</span>
            </div>
          </div>
          <div className="mt-16 text-center">
            <h1 className="text-neonCyan text-[10px] font-cyber tracking-[0.8em] uppercase opacity-70 font-bold">Initializing Core</h1>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="h-full w-full bg-black relative flex flex-col items-center justify-between view-entry overflow-hidden pb-12 pt-20">
        <div className="bloom-container">
          <div className="bloom bloom-purple"></div>
          <div className="bloom bloom-cyan"></div>
          <div className="bloom bloom-green"></div>
          <div className="hex-mesh-static"></div>
        </div>
        <FloatingHexagons />
        
        <div className="relative z-10 flex flex-col items-center justify-center px-6">
          <div className="flex flex-col items-center logo-glow-wrapper mb-8">
            <svg width="280" height="110" viewBox="0 0 340 130">
              <defs>
                <linearGradient id="bmsGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <text x="50%" y="100" textAnchor="middle" className="bms-text-hollow">BMS</text>
            </svg>
            <p className="monitor-text-sharp uppercase text-2xl">Monitor</p>
          </div>
        </div>

        <div className="relative z-20 flex flex-col items-center gap-12 w-full px-6">
          <button 
            onClick={() => setView('device-list')}
            className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-4xl text-neonCyan active:scale-90 transition-all shadow-[0_0_30px_rgba(6,182,212,0.4)]"
          >
            <i className="fa-solid fa-power-off"></i>
          </button>
          
          <div className="text-center">
            <span className="text-[12px] font-cyber text-white/80 tracking-[0.8em] uppercase font-bold block">
              CV Creation System
            </span>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-blue-500 shadow-[0_0_20px_#3b82f6] rounded-t-full"></div>
      </div>
    );
  }

  if (view === 'device-list') {
    const colors = ['bg-blue-500', 'bg-purple-600', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500'];
    return (
      <div className="h-full w-full flex flex-col relative overflow-hidden view-entry safe-top safe-bottom bg-[#F8FAFC]">
        <header className="px-8 py-6 flex justify-between items-center shrink-0">
          <button onClick={() => setView('home')} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-500 shadow-lg shadow-slate-200 border border-slate-50 active:scale-90 transition-transform">
             <i className="fa-solid fa-house"></i>
          </button>
          <div className="text-center">
            <h2 className="text-xs font-cyber font-bold text-slate-800 tracking-[0.3em] uppercase">Your Network</h2>
            <div className="w-10 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 mx-auto mt-1 rounded-full"></div>
          </div>
          <button onClick={() => setView('add-device')} className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 active:scale-90 transition-transform">
            <i className="fa-solid fa-plus"></i>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 no-scrollbar">
          {devices.map((device, idx) => (
            <div 
              key={device.id}
              onClick={() => { setActiveDeviceId(device.id); setView('dashboard'); }}
              className="bg-white p-5 rounded-[28px] flex justify-between items-center border border-slate-100 shadow-xl shadow-slate-200/40 active:scale-[0.97] transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl ${colors[idx % colors.length]} flex items-center justify-center text-white shadow-lg`}>
                  <i className="fa-solid fa-bolt-lightning"></i>
                </div>
                <div>
                  <h3 className="font-sans font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600">{device.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-0.5">{device.id}</p>
                </div>
              </div>
              <button onClick={(e) => removeDevice(device.id, e)} className="text-slate-200 hover:text-rose-500 p-2 transition-colors">
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          ))}
          {devices.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20 opacity-30">
              <i className="fa-solid fa-wifi text-6xl mb-6 text-slate-200"></i>
              <p className="font-sans text-sm font-medium px-12 leading-relaxed">No active hardware linked. Tap the plus button to integrate your first BMS unit.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'add-device') {
    return (
      <div className="h-full w-full flex flex-col relative overflow-hidden view-entry safe-top safe-bottom bg-[#F8FAFC]">
        <header className="px-8 py-6 shrink-0">
          <button onClick={() => setView('device-list')} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-500 shadow-lg shadow-slate-200 border border-slate-50 active:scale-90 transition-transform">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
        </header>
        
        <div className="flex-1 px-8 pt-4 overflow-y-auto no-scrollbar pb-10">
          <h2 className="text-4xl font-sans font-black text-slate-800 tracking-tight leading-tight mb-2">Configure <span className="text-blue-600">Unit</span></h2>
          <p className="text-slate-500 font-sans text-sm font-medium mb-10">Enter hardware credentials to initiate sync.</p>
          
          <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-indigo-100 border border-white space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-cyber text-slate-400 uppercase tracking-[0.4em] font-bold ml-2">Display Name</label>
              <input 
                type="text" 
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="e.g. Battery Bank A"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-sans text-lg text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] font-cyber text-slate-400 uppercase tracking-[0.4em] font-bold ml-2">Device MAC ID</label>
              <input 
                type="text" 
                value={newDeviceMac}
                onChange={(e) => setNewDeviceMac(e.target.value)}
                placeholder="XX:XX:XX:XX:XX:XX"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-mono text-lg text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all text-center tracking-widest"
              />
            </div>
            <button 
              onClick={addDevice}
              disabled={!newDeviceMac.trim() || !newDeviceName.trim()}
              className="w-full mt-2 bg-slate-900 text-white font-cyber py-6 rounded-3xl font-bold tracking-[0.4em] active:scale-95 transition-all uppercase text-[10px] shadow-xl disabled:opacity-20"
            >
              Finalize Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bms = data || { voltage: 0, current: 0, soc: 0, uptime: 0, cycles: 0, temp_battery: 0, temp_mos: 0, temp_box: 0 };
  const activeDevice = devices.find(d => d.id === activeDeviceId);

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden view-entry safe-top safe-bottom bg-[#F8FAFC]">
      <header className="px-6 py-4 flex justify-between items-center bg-white/60 backdrop-blur-xl border-b border-white z-20 shrink-0">
        <button onClick={() => setView('device-list')} className="w-10 h-10 rounded-xl bg-white shadow-md flex items-center justify-center text-slate-400 border border-slate-100 active:scale-90 transition-transform">
           <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div className="text-center overflow-hidden">
           <h2 className="text-slate-800 font-sans font-black text-lg truncate px-4">{activeDevice?.name}</h2>
           <div className="flex items-center justify-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${data ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
              <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase font-bold">
                {data ? 'System Online' : 'Signal Lost'}
              </p>
           </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white shadow-md flex items-center justify-center text-slate-300 border border-slate-100">
           <i className="fa-solid fa-shield-halved"></i>
        </div>
      </header>

      <nav className="flex px-10 gap-10 bg-transparent pt-6 shrink-0">
        <button onClick={() => setActiveTab('live')} className={`pb-2 font-cyber text-[10px] tracking-[0.2em] uppercase font-black transition-all ${activeTab === 'live' ? 'tab-active' : 'text-slate-300'}`}>Status</button>
        <button onClick={() => setActiveTab('analytics')} className={`pb-2 font-cyber text-[10px] tracking-[0.2em] uppercase font-black transition-all ${activeTab === 'analytics' ? 'tab-active' : 'text-slate-300'}`}>Trends</button>
      </nav>

      <main className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar">
        {activeTab === 'live' ? (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8">
            <div className="flex justify-center py-4">
              <div className="relative p-8 bg-white/60 rounded-full shadow-[0_20px_60px_-15px_rgba(59,130,246,0.1)] border-[6px] border-white">
                <CircularProgress value={bms.soc} size={200} strokeWidth={16} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DataCard label="Voltage" value={bms.voltage} unit="V" color="#0ea5e9" icon={<i className="fa-solid fa-bolt"></i>} />
              <DataCard label="Current" value={bms.current} unit="A" color="#6366f1" icon={<i className="fa-solid fa-wave-square"></i>} />
              <DataCard label="Cycles" value={bms.cycles} unit="cyc" color="#d946ef" icon={<i className="fa-solid fa-recycle"></i>} />
              <DataCard label="Watts" value={Math.abs(bms.current * bms.voltage)} unit="W" color="#10b981" icon={<i className="fa-solid fa-plug-circle-bolt"></i>} />
            </div>

            <div className="glass-light p-6 rounded-[32px] space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-500 flex items-center justify-center text-xs"><i className="fa-solid fa-thermometer"></i></div>
                <h4 className="font-cyber text-[10px] text-slate-800 uppercase tracking-widest font-black">Thermal Array</h4>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Cell Temp', value: bms.temp_battery, color: 'text-rose-500' },
                  { label: 'MOS Node', value: bms.temp_mos, color: 'text-amber-500' },
                  { label: 'Air Probe', value: bms.temp_box, color: 'text-blue-500' }
                ].map((t, i) => (
                  <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-white/50 border border-slate-50">
                    <span className="text-xs font-sans font-bold text-slate-500">{t.label}</span>
                    <span className={`font-mono font-bold ${t.color}`}>{t.value.toFixed(1)}°C</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-6 duration-500 space-y-6">
            <div className="glass-light p-8 rounded-[36px]">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="font-cyber text-[10px] text-slate-800 uppercase tracking-widest font-black">Live Current (A)</h3>
                 <span className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[9px] font-bold">STREAMING</span>
               </div>
               <HistoryChart data={currentHistory} />
               <div className="flex justify-between mt-6 text-[9px] font-mono font-bold text-slate-400 uppercase">
                  <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Charging</span>
                  <span className="flex items-center gap-1.5">Load <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div></span>
               </div>
            </div>

            <div className="glass-light p-8 rounded-[36px]">
               <h3 className="font-cyber text-[10px] text-slate-800 uppercase tracking-widest font-black mb-8">Monthly Energy Accumulation</h3>
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-100 shrink-0">
                    <i className="fa-solid fa-chart-simple text-2xl"></i>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-mono font-black text-slate-800 tracking-tighter">{(cumulativeWh / 1000).toFixed(2)}</span>
                      <span className="text-sm font-sans font-bold text-slate-400">kWh</span>
                    </div>
                    <p className="text-[10px] font-cyber text-slate-400 uppercase mt-1.5 font-bold tracking-[0.1em]">Estimated Throughput</p>
                  </div>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-full mt-8 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (cumulativeWh / 1000) * 8)}%` }}></div>
               </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[36px] text-white shadow-2xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-cyber text-[9px] tracking-widest uppercase opacity-40 font-black">System AI Digest</h4>
                    <p className="text-xl font-sans font-black mt-1 text-emerald-400">
                      {bms.current > 0.1 ? 'Charging Active' : bms.current < -0.1 ? 'Battery Under Load' : 'Dormant State'}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${bms.current > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    <i className={`fa-solid ${bms.current > 0 ? 'fa-sun' : 'fa-house-bolt'}`}></i>
                  </div>
                </div>
                <p className="text-xs font-sans opacity-50 leading-relaxed font-medium">BMS core is reporting high energy retention. Temperatures are stable across all monitored nodes. System operating at peak efficiency.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 text-center shrink-0 border-t border-slate-50 bg-white/30 backdrop-blur-md">
        <span className="text-[9px] font-cyber tracking-[0.6em] uppercase font-black text-slate-400 drop-shadow-sm italic">CV creation systems • Pro v2.2</span>
      </footer>
    </div>
  );
};

export default App;