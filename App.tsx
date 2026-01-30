
import React, { useState, useEffect, useMemo } from 'react';
import CircularProgress from './components/CircularProgress';
import DataCard from './components/DataCard';
import { 
  subscribeToDeviceData, 
  dbLogin, 
  dbRegister, 
  saveUserDevice, 
  deleteUserDevice,
  subscribeToUserDevices
} from './services/firebase';
import { BMSData, Device, AppView } from './types';

interface DBUser {
  uid: string;
  username: string;
}

const FloatingHexagons = () => {
  const hexData = useMemo(() => {
    const colors = ['#06b6d4', '#3b82f6', '#10b981', '#6366f1'];
    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 40 + Math.random() * 80,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 20 + Math.random() * 30,
      delay: Math.random() * -20,
      opacity: 0.15,
      rotation: Math.random() * 360,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
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
            filter: `blur(1px)`,
            transform: `rotate(${h.rotation}deg)`,
          }}
        >
          <path d="M30 0l25.98 15v30L30 60 4.02 45V15z" stroke="currentColor" fill="none" strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
};

const HistoryChart = ({ data }: { data: number[] }) => {
  const safeData = useMemo(() => data.filter(v => typeof v === 'number' && !isNaN(v)), [data]);
  if (safeData.length < 2) return <div className="h-40 flex items-center justify-center text-slate-400 font-sans text-xs italic">Awaiting data stream...</div>;
  const max = Math.max(...safeData, 0.1);
  const min = Math.min(...safeData, -0.1);
  const range = (max - min) || 1;
  const height = 150, width = 400;
  const points = safeData.map((val, i) => {
    const x = (i / (safeData.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-slate-50/50 p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M0,${height} L${points} L${width},${height} Z`} fill="url(#chartGrad)" />
        <polyline fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('splash');
  const [activeTab, setActiveTab] = useState<'live' | 'analytics'>('live');
  const [user, setUser] = useState<DBUser | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [data, setData] = useState<BMSData | null>(null);
  const [currentHistory, setCurrentHistory] = useState<number[]>([]);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceMac, setNewDeviceMac] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('bms_user_session');
    if (savedUser) try { setUser(JSON.parse(savedUser)); } catch (e) { localStorage.removeItem('bms_user_session'); }
  }, []);

  useEffect(() => {
    if (activeDeviceId && view === 'dashboard') {
      return subscribeToDeviceData(activeDeviceId, (newData) => {
        if (newData) {
          setData(newData);
          setCurrentHistory(prev => [...prev, newData.current || 0].slice(-50));
        }
      });
    }
  }, [activeDeviceId, view]);

  useEffect(() => {
    if (user) return subscribeToUserDevices(user.uid, setDevices);
  }, [user]);

  useEffect(() => {
    const internalViews = ['device-list', 'add-device', 'dashboard', 'auth'];
    document.body.classList.toggle('internal-active', internalViews.includes(view));
  }, [view]);

  useEffect(() => {
    if (view === 'splash') {
      const timer = setTimeout(() => setView('home'), 2000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  const handleAuth = async () => {
    const username = authUsername.trim(), pass = authPass.trim();
    if (!username || !pass) { setAuthError("Credentials required."); return; }
    setLoading(true); setAuthError('');
    try {
      const loggedUser = authMode === 'login' ? await dbLogin(username, pass) : await dbRegister(username, pass);
      setUser(loggedUser);
      localStorage.setItem('bms_user_session', JSON.stringify(loggedUser));
      setView('device-list');
    } catch (e: any) { setAuthError(e.message); } finally { setLoading(false); }
  };

  const handleAddDevice = async () => {
    if (user && newDeviceName && newDeviceMac) {
      await saveUserDevice(user.uid, newDeviceMac.toUpperCase(), newDeviceName);
      setNewDeviceName(''); setNewDeviceMac(''); setView('device-list');
    }
  };

  if (view === 'splash') {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center p-6 transition-all duration-1000 overflow-hidden">
        <div className="bloom-container"><div className="bloom bloom-cyan"></div></div>
        <div className="relative flex flex-col items-center z-10">
          <div className="w-24 h-24 border-2 border-neonBlue rounded-3xl rotate-45 flex items-center justify-center animate-pulse">
            <span className="text-2xl font-cyber font-black text-white -rotate-45">BMS</span>
          </div>
          <div className="mt-12 text-center">
            <h1 className="text-neonCyan text-[8px] font-cyber tracking-[0.8em] uppercase opacity-90 font-bold">Connecting To Core</h1>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="h-full w-full bg-black relative flex flex-col items-center view-entry overflow-hidden pb-12 pt-36">
        <div className="bloom-container"><div className="bloom bloom-purple"></div><div className="bloom bloom-cyan"></div><div className="bloom bloom-green"></div></div>
        <FloatingHexagons />
        <div className="relative z-10 flex flex-col items-center justify-center px-6 shrink-0 mb-10">
          <div className="flex flex-col items-center logo-glow-wrapper">
            <svg width="240" height="90" viewBox="0 0 340 130">
              <defs><linearGradient id="bmsGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#c084fc" /></linearGradient></defs>
              <text x="50%" y="100" textAnchor="middle" className="bms-text-hollow">BMS</text>
            </svg>
            <p className="monitor-text-sharp uppercase text-xl drop-shadow-lg -mt-2">PRO MONITOR</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center relative z-20 w-full px-6">
          <button onClick={() => user ? setView('device-list') : setView('auth')} className="group relative w-32 h-32 rounded-full flex items-center justify-center active:scale-95 transition-all">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 blur-2xl opacity-40 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute inset-1 rounded-full bg-black/40 border border-white/20 backdrop-blur-xl"></div>
            <i className="fa-solid fa-power-off text-4xl text-white relative z-10"></i>
          </button>
          <p className="mt-8 text-[9px] font-cyber text-white/40 tracking-[0.4em] uppercase font-bold">Authorized Access Only</p>
        </div>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="h-full w-full bg-black relative flex flex-col items-center justify-center view-entry overflow-hidden px-8">
        <div className="bloom-container"><div className="bloom bloom-purple"></div><div className="bloom bloom-cyan"></div></div>
        <div className="relative z-20 w-full max-w-sm space-y-8 bg-white/5 p-8 rounded-[40px] border border-white/10 backdrop-blur-xl">
          <div className="text-center">
            <h2 className="text-xl font-cyber font-black text-neonCyan uppercase tracking-widest">{authMode === 'login' ? 'Authentication' : 'Registration'}</h2>
          </div>
          <div className="space-y-4">
            <input type="text" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 font-sans text-white focus:border-neonCyan outline-none text-sm" placeholder="Username" />
            <input type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 font-sans text-white focus:border-neonCyan outline-none text-sm" placeholder="Password" />
          </div>
          {authError && <div className="text-rose-500 text-[10px] text-center p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">{authError}</div>}
          <button onClick={handleAuth} disabled={loading} className="w-full bg-neonCyan text-black font-cyber py-5 rounded-2xl font-black tracking-widest active:scale-95 transition-all">{loading ? '...' : authMode.toUpperCase()}</button>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full text-[9px] font-cyber text-white/40 uppercase tracking-widest">{authMode === 'login' ? "Create Account" : "Return to Login"}</button>
        </div>
      </div>
    );
  }

  if (view === 'device-list') {
    return (
      <div className="h-full w-full flex flex-col relative overflow-hidden view-entry safe-top safe-bottom bg-[#F8FAFC]">
        <header className="px-8 py-8 flex justify-between items-center shrink-0">
          <button onClick={() => setView('home')} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-md border border-slate-50"><i className="fa-solid fa-house"></i></button>
          <h2 className="text-xs font-cyber font-black text-slate-800 tracking-[0.3em] uppercase">Control Center</h2>
          <button onClick={() => setView('add-device')} className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200"><i className="fa-solid fa-plus"></i></button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 space-y-4 no-scrollbar">
          {devices.map((device) => (
            <div key={device.id} onClick={() => { setActiveDeviceId(device.id); setView('dashboard'); }} className="bg-white p-5 rounded-3xl flex justify-between items-center border border-slate-100 shadow-sm active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-500 text-lg border border-slate-100"><i className="fa-solid fa-server"></i></div>
                <div>
                  <h3 className="font-sans font-black text-slate-800 text-base leading-tight">{device.name}</h3>
                  <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">{device.id}</p>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteUserDevice(user!.uid, device.id); }} className="text-slate-200 hover:text-rose-400 p-2"><i className="fa-solid fa-trash"></i></button>
            </div>
          ))}
          {devices.length === 0 && <div className="text-center py-20 opacity-30 font-cyber text-[10px] tracking-[0.2em] uppercase">No Nodes Detected</div>}
        </div>
      </div>
    );
  }

  if (view === 'add-device') {
    return (
      <div className="h-full w-full flex flex-col relative overflow-hidden view-entry safe-top safe-bottom bg-[#F8FAFC]">
        <header className="px-8 py-8 shrink-0">
          <button onClick={() => setView('device-list')} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-md border border-slate-50"><i className="fa-solid fa-arrow-left"></i></button>
        </header>
        <div className="flex-1 px-8">
          <h2 className="text-3xl font-sans font-black text-slate-800 mb-8">Register Node</h2>
          <div className="bg-white p-8 rounded-[40px] shadow-sm space-y-6 border border-slate-100">
            <input type="text" value={newDeviceName} onChange={(e) => setNewDeviceName(e.target.value)} placeholder="Node Name (e.g. Battery A)" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm" />
            <input type="text" value={newDeviceMac} onChange={(e) => setNewDeviceMac(e.target.value.toUpperCase())} placeholder="MAC ID (XX:XX...)" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-mono text-center tracking-widest text-sm" />
            <button onClick={handleAddDevice} disabled={!newDeviceName || !newDeviceMac} className="w-full bg-slate-900 text-white font-cyber py-5 rounded-2xl font-black tracking-[0.3em] disabled:opacity-20 active:scale-95 transition-all">LINK MODULE</button>
          </div>
        </div>
      </div>
    );
  }

  const isOnline = data && (Date.now() - (data.last_seen || 0) < 60000);
  const bms = data || { voltage: 0, current: 0, soc: 0, uptime: 0, cycles: 0, temp_battery: 0, temp_power: 0, temp_box: 0, capacity_total: 0, capacity_remain: 0, cells: [], warning_text: 'None', cell_count: 0 };
  const activeDevice = devices.find(d => d.id === activeDeviceId);
  const hasWarning = bms.warning_text && bms.warning_text !== 'None';
  
  // Advanced Cell Metrics
  const cellVoltages = bms.cells.filter(v => v > 0);
  const maxCell = cellVoltages.length > 0 ? Math.max(...cellVoltages) : 0;
  const minCell = cellVoltages.length > 0 ? Math.min(...cellVoltages) : 0;
  const deltaCell = maxCell - minCell;
  const avgCell = cellVoltages.length > 0 ? cellVoltages.reduce((a, b) => a + b, 0) / cellVoltages.length : 0;

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden view-entry safe-top safe-bottom bg-[#F8FAFC]">
      <header className="px-5 py-4 flex justify-between items-center bg-white/80 backdrop-blur-xl border-b border-slate-100 shrink-0">
        <button onClick={() => setView('device-list')} className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-400"><i className="fa-solid fa-chevron-left"></i></button>
        <div className="text-center">
          <h2 className="text-slate-800 font-sans font-black text-sm leading-none">{activeDevice?.name}</h2>
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`}></div>
            <p className="text-[7px] text-slate-400 font-cyber tracking-widest uppercase font-bold">{isOnline ? 'ACTIVE LINK' : 'LINK LOST'}</p>
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-blue-500"><i className="fa-solid fa-sliders"></i></div>
      </header>

      <nav className="flex px-10 gap-10 bg-transparent pt-6 shrink-0">
        <button onClick={() => setActiveTab('live')} className={`pb-2 font-cyber text-[10px] tracking-[0.3em] uppercase font-black transition-all ${activeTab === 'live' ? 'tab-active' : 'text-slate-300'}`}>Status</button>
        <button onClick={() => setActiveTab('analytics')} className={`pb-2 font-cyber text-[10px] tracking-[0.3em] uppercase font-black transition-all ${activeTab === 'analytics' ? 'tab-active' : 'text-slate-300'}`}>Detailed</button>
      </nav>

      <main className="flex-1 overflow-y-auto px-5 py-5 no-scrollbar">
        {activeTab === 'live' ? (
          <div className="space-y-6 pb-10">
            {hasWarning && (
              <div className="bg-rose-50 border-2 border-rose-100 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white text-lg"><i className="fa-solid fa-triangle-exclamation"></i></div>
                <div>
                   <p className="text-[8px] font-cyber text-rose-400 uppercase tracking-widest font-black">Warning Event</p>
                   <p className="text-xs font-sans font-bold text-rose-700">{bms.warning_text}</p>
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <div className="relative p-8 bg-white rounded-[50px] shadow-sm border border-slate-100">
                <CircularProgress value={bms.soc} size={180} strokeWidth={14} />
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[9px] font-cyber text-slate-400 uppercase tracking-widest font-black">Energy Matrix</span>
                <span className="font-mono text-[10px] font-bold text-slate-600">
                  {bms.soc}% | {((bms.soc / 100) * (bms.capacity_total || 0)).toFixed(1)} / {bms.capacity_total} Ah
                </span>
              </div>
              <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden p-0.5 border border-slate-100">
                 <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-1000" style={{ width: `${bms.soc}%` }}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DataCard label="Voltage" value={bms.voltage} unit="V" color="#0ea5e9" icon={<i className="fa-solid fa-bolt"></i>} />
              <DataCard label="Current" value={bms.current} unit="A" color="#6366f1" icon={<i className="fa-solid fa-gauge"></i>} />
              <DataCard label="Cycles" value={bms.cycles} unit="cyc" color="#d946ef" icon={<i className="fa-solid fa-rotate"></i>} />
              <DataCard label="Avg Cell" value={avgCell} unit="V" color="#10b981" icon={<i className="fa-solid fa-microchip"></i>} />
            </div>

            <div className="bg-white p-6 rounded-3xl space-y-5 border border-slate-100 shadow-sm">
              <h4 className="font-cyber text-[9px] text-slate-800 uppercase tracking-[0.3em] font-black flex items-center gap-2">
                <div className="w-1.5 h-3 bg-blue-500 rounded-sm"></div> Thermal Status
              </h4>
              <div className="grid grid-cols-3 gap-3">
                 {[
                   { label: 'Battery', val: bms.temp_battery }, 
                   { label: 'MOSFET', val: bms.temp_power }, 
                   { label: 'Ambient', val: bms.temp_box }
                 ].map((t, i) => (
                   <div key={i} className="bg-slate-50 p-3 rounded-2xl text-center border border-white">
                     <p className="text-[7px] font-cyber text-slate-400 uppercase mb-1 tracking-tighter">{t.label}</p>
                     <p className="font-mono font-black text-slate-700 text-xs">{t.val.toFixed(1)}°C</p>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-10">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="font-cyber text-[9px] text-slate-800 uppercase tracking-[0.3em] font-black flex items-center gap-2">
                   <div className="w-1.5 h-3 bg-emerald-500 rounded-sm"></div> Balancer Grid
                 </h3>
                 <span className="bg-emerald-50 text-[9px] font-black text-emerald-600 px-3 py-1 rounded-full">{bms.cell_count} Cells Active</span>
               </div>

               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-slate-50 p-3 rounded-2xl border border-white text-center">
                    <p className="text-[8px] font-cyber text-slate-400 uppercase mb-1">Max Delta</p>
                    <p className="font-mono font-black text-slate-800 text-base">{(deltaCell * 1000).toFixed(0)} <span className="text-[10px]">mV</span></p>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-2xl border border-white text-center">
                    <p className="text-[8px] font-cyber text-slate-400 uppercase mb-1">Avg Volts</p>
                    <p className="font-mono font-black text-slate-800 text-base">{avgCell.toFixed(3)} <span className="text-[10px]">V</span></p>
                 </div>
               </div>

               <div className="grid grid-cols-3 gap-3">
                 {bms.cells.map((volt, i) => {
                    const diff = Math.abs(volt - avgCell);
                    const isBad = diff > 0.05;
                    return (
                      <div key={i} className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${isBad ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-white'}`}>
                        <span className="text-[7px] font-cyber text-slate-300 mb-1 font-black uppercase">Cell {i+1}</span>
                        <span className={`font-mono text-xs font-black ${isBad ? 'text-rose-600' : 'text-slate-700'}`}>{volt.toFixed(3)}</span>
                        <div className="w-full h-1 bg-slate-200 mt-2 rounded-full overflow-hidden">
                           <div className={`h-full ${isBad ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(5, Math.min(100, (volt - 2.8) / 1.4 * 100))}%` }}></div>
                        </div>
                      </div>
                    );
                 })}
                 {bms.cells.length === 0 && <p className="col-span-3 text-center py-6 text-[8px] text-slate-300 font-cyber tracking-widest uppercase">Syncing Cells...</p>}
               </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
               <h3 className="font-cyber text-[9px] text-slate-800 uppercase tracking-[0.3em] font-black mb-6">Load Profile (Amps)</h3>
               <HistoryChart data={currentHistory} />
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
               <h3 className="font-cyber text-[9px] text-slate-800 uppercase tracking-[0.3em] font-black mb-5">Hardware Summary</h3>
               <div className="space-y-3">
                 {[
                   { label: 'System Uptime', val: `${Math.floor(bms.uptime / 60)}m ${bms.uptime % 60}s` },
                   { label: 'Pack Capacity', val: `${bms.capacity_total} Ah` },
                   { label: 'Charge Cycles', val: `${bms.cycles} Cycles` },
                   { label: 'Cell Balance', val: deltaCell < 0.03 ? 'EXCELLENT' : 'DEVIATED' }
                 ].map((item, idx) => (
                   <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-white">
                     <span className="text-[8px] text-slate-400 font-cyber uppercase tracking-widest font-bold">{item.label}</span>
                     <span className="text-[10px] font-mono font-black text-slate-700">{item.val}</span>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 text-center shrink-0 bg-white/40 backdrop-blur-md">
        <span className="text-[8px] font-cyber tracking-[0.5em] uppercase font-bold text-slate-300">INDUSTRIAL DATA LINK V3.0</span>
      </footer>
    </div>
  );
};

export default App;
