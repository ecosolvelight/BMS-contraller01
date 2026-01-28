
import React, { useState, useEffect, useMemo } from 'react';
// Importing Gemini API client according to guidelines
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
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
    const colors = ['#06b6d4', '#a855f7', '#22c55e', '#3b82f6'];
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 30 + Math.random() * 70,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 15 + Math.random() * 25,
      delay: Math.random() * -20,
      opacity: 0.2 + Math.random() * 0.4,
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
            filter: `blur(1px) drop-shadow(0 0 ${h.size / 4}px ${h.color}44)`,
            transform: `rotate(${h.rotation}deg)`,
          }}
        >
          <path d="M30 0l25.98 15v30L30 60 4.02 45V15z" stroke="currentColor" fill="none" strokeWidth="1.5" />
        </svg>
      ))}
    </div>
  );
};

const HistoryChart = ({ data }: { data: number[] }) => {
  const safeData = useMemo(() => data.filter(v => typeof v === 'number' && !isNaN(v)), [data]);
  
  if (safeData.length < 2) return <div className="h-40 flex items-center justify-center text-slate-400 font-sans text-xs italic">Syncing stream...</div>;
  
  const max = Math.max(...safeData, 1);
  const min = Math.min(...safeData, -1);
  const range = (max - min) || 1;
  const height = 150;
  const width = 300;
  
  const points = safeData.map((val, i) => {
    const x = (i / (safeData.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M0,${height} L${points} L${width},${height} Z`} fill="url(#chartGrad)" />
        <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
        <line x1="0" y1={height - ((-min) / range) * height} x2={width} y2={height - ((-min) / range) * height} stroke="#E2E8F0" strokeDasharray="4" />
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

  // AI Insight state management
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('bms_user_session');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('bms_user_session');
      }
    }
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
    if (user) {
      return subscribeToUserDevices(user.uid, (deviceList) => {
        setDevices(deviceList);
      });
    }
  }, [user]);

  useEffect(() => {
    const internalViews = ['device-list', 'add-device', 'dashboard', 'auth'];
    if (internalViews.includes(view)) {
      document.body.classList.add('internal-active');
    } else {
      document.body.classList.remove('internal-active');
    }
  }, [view]);

  useEffect(() => {
    if (view === 'splash') {
      const timer = setTimeout(() => setView('home'), 3000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  // Handler for Gemini AI battery analysis using latest pro model and reasoning budget
  const handleAiInsight = async () => {
    if (!data) return;
    setIsAiLoading(true);
    try {
      // Create a fresh instance of GoogleGenAI to ensure latest environment context as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Use gemini-3-pro-preview for complex battery engineering reasoning with thinkingConfig
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analyze this BMS telemetry as a senior battery engineer. Provide a very concise status summary and one specific optimization tip. 
        Data: Voltage ${data.voltage}V, Current ${data.current}A, SOC ${data.soc}%, Temp ${data.temp_battery}°C, Cycles ${data.cycles}.`,
        config: {
          thinkingConfig: { thinkingBudget: 4000 }
        }
      });
      // Extracting output text property directly from the response object
      setAiInsight(response.text || 'Analysis unavailable.');
    } catch (error: any) {
      console.error("AI Analysis Failed:", error);
      // Graceful error handling for common API key or model availability issues
      if (error?.message?.includes("Requested entity was not found")) {
        setAiInsight('Neural Core Link mismatch. Re-verifying key configuration...');
      } else {
        setAiInsight('Intelligence core disconnected. Try again later.');
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAuth = async () => {
    const username = authUsername.trim();
    const pass = authPass.trim();
    if (!username || !pass) { setAuthError("Identity credentials required."); return; }
    setLoading(true); setAuthError('');
    try {
      let loggedUser: DBUser;
      if (authMode === 'login') loggedUser = await dbLogin(username, pass);
      else loggedUser = await dbRegister(username, pass);
      setUser(loggedUser);
      localStorage.setItem('bms_user_session', JSON.stringify(loggedUser));
      setView('device-list');
    } catch (e: any) { setAuthError(e.message); } finally { setLoading(false); }
  };

  const handleAddDevice = async () => {
    if (user && newDeviceName && newDeviceMac) {
      try {
        await saveUserDevice(user.uid, newDeviceMac.toUpperCase(), newDeviceName);
        setNewDeviceName(''); setNewDeviceMac(''); setView('device-list');
      } catch (e) { console.error("Binding error:", e); }
    }
  };

  const logout = () => { setUser(null); localStorage.removeItem('bms_user_session'); setView('home'); };
  const onPowerClick = () => { if (user) setView('device-list'); else setView('auth'); };

  if (view === 'splash') {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center p-6 transition-all duration-1000 overflow-hidden">
        <div className="bloom-container"><div className="bloom bloom-cyan"></div></div>
        <div className="relative flex flex-col items-center z-10">
          <div className="w-32 h-32 border-[3px] border-neonBlue rounded-[40px] rotate-45 flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.3)] animate-pulse">
            <div className="w-24 h-24 border-[2px] border-neonGreen rounded-full -rotate-45 flex items-center justify-center">
                <span className="text-4xl font-cyber font-black text-white tracking-widest">BMS</span>
            </div>
          </div>
          <div className="mt-16 text-center space-y-2">
            <h1 className="text-neonCyan text-[10px] font-cyber tracking-[0.8em] uppercase opacity-90 font-bold">Initializing Kernel</h1>
            <div className="w-48 h-[2px] bg-white/10 mx-auto rounded-full overflow-hidden">
                <div className="h-full bg-neonCyan w-1/2 animate-[loading_2s_ease-in-out_infinite]"></div>
            </div>
          </div>
        </div>
        <style>{`@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="h-full w-full bg-black relative flex flex-col items-center view-entry overflow-hidden pb-12 pt-36">
        <div className="bloom-container"><div className="bloom bloom-purple"></div><div className="bloom bloom-cyan"></div><div className="bloom bloom-green"></div><div className="hex-mesh-static"></div></div>
        <FloatingHexagons />
        <div className="relative z-10 flex flex-col items-center justify-center px-6 shrink-0 mb-10">
          <div className="flex flex-col items-center logo-glow-wrapper">
            <svg width="280" height="110" viewBox="0 0 340 130">
              <defs><linearGradient id="bmsGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#c084fc" /></linearGradient></defs>
              <text x="50%" y="100" textAnchor="middle" className="bms-text-hollow">BMS</text>
            </svg>
            <p className="monitor-text-sharp uppercase text-2xl drop-shadow-lg -mt-4">Monitor</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center relative z-20 w-full px-6">
          <button 
            onClick={onPowerClick} 
            className="group relative w-32 h-32 rounded-full flex items-center justify-center active:scale-90 transition-all duration-300"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 blur-xl opacity-40 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute inset-2 rounded-full bg-black/40 border border-white/20 backdrop-blur-md"></div>
            <i className="fa-solid fa-power-off text-5xl text-white relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"></i>
          </button>
          <p className="mt-8 text-[10px] font-cyber text-white/40 tracking-[0.4em] uppercase">Initialize Link</p>
        </div>
        <div className="relative z-20 w-full px-6 text-center mt-10">
           <span className="text-[8px] font-cyber text-white/30 tracking-[0.8em] uppercase font-black block mb-4">Industrial Automation Interface</span>
           {user && (<button onClick={logout} className="text-[9px] font-cyber text-rose-400/60 uppercase tracking-[0.4em] mt-4 hover:text-rose-400 transition-colors">Terminate Session</button>)}
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_-5px_25px_#3b82f6] rounded-t-full"></div>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="h-full w-full bg-black relative flex flex-col items-center justify-center view-entry overflow-hidden px-8">
        <div className="bloom-container"><div className="bloom bloom-purple"></div><div className="bloom bloom-cyan"></div></div>
        <FloatingHexagons />
        <div className="relative z-20 w-full max-w-sm space-y-6 bg-white/5 p-8 rounded-[40px] border border-white/10 backdrop-blur-xl shadow-2xl">
          <div className="text-center">
            <h2 className="text-2xl font-cyber font-black text-neonCyan uppercase tracking-widest">{authMode === 'login' ? 'Authentication' : 'Core Registration'}</h2>
            <p className="text-[9px] text-white/40 font-cyber tracking-[0.4em] uppercase mt-2">Secure Node Access</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-cyber text-white/40 uppercase tracking-widest ml-2">Operator ID</label>
              <input type="text" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 font-sans text-white focus:border-neonCyan outline-none transition-all" placeholder="Username" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-cyber text-white/40 uppercase tracking-widest ml-2">Access Key</label>
              <input type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 font-sans text-white focus:border-neonCyan outline-none transition-all" placeholder="••••••••" />
            </div>
          </div>
          {authError && <div className="text-rose-500 text-[10px] font-medium text-center leading-relaxed px-4 py-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 font-sans uppercase tracking-widest">{authError}</div>}
          <button onClick={handleAuth} disabled={loading} className="w-full bg-neonCyan text-black font-cyber py-5 rounded-2xl font-black tracking-widest active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50">{loading ? 'SYNCING...' : authMode === 'login' ? 'AUTHORIZE' : 'REGISTER'}</button>
          <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }} className="w-full text-[10px] font-cyber text-white/40 uppercase tracking-widest hover:text-white transition-colors">{authMode === 'login' ? "Register New Node" : "Existing Operator Login"}</button>
          <button onClick={() => setView('home')} className="w-full text-[9px] font-cyber text-white/20 uppercase tracking-[0.4em]">Abort</button>
        </div>
      </div>
    );
  }

  if (view === 'device-list') {
    const colors = ['bg-blue-500', 'bg-purple-600', 'bg-emerald-500', 'bg-amber-500'];
    return (
      <div className="h-full w-full flex flex-col relative overflow-hidden view-entry safe-top safe-bottom bg-[#F8FAFC]">
        <header className="px-8 py-8 flex justify-between items-center shrink-0">
          <button onClick={() => setView('home')} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-500 shadow-lg border border-slate-50 active:scale-90 transition-transform"><i className="fa-solid fa-house"></i></button>
          <div className="text-center">
            <h2 className="text-xs font-cyber font-black text-slate-800 tracking-[0.4em] uppercase">Control Center</h2>
            <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 mx-auto mt-2 rounded-full"></div>
          </div>
          <button onClick={() => setView('add-device')} className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 active:scale-90 transition-transform"><i className="fa-solid fa-plus"></i></button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 no-scrollbar">
          {devices.map((device, idx) => (
            <div key={device.id} onClick={() => { setActiveDeviceId(device.id); setView('dashboard'); }} className="bg-white p-5 rounded-[32px] flex justify-between items-center border border-slate-100 shadow-xl shadow-slate-200/40 active:scale-[0.98] transition-all group">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${colors[idx % colors.length]} flex items-center justify-center text-white shadow-lg text-xl`}><i className="fa-solid fa-microchip"></i></div>
                <div>
                  <h3 className="font-sans font-black text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">{device.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-1">{device.id}</p>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); if(confirm('Disconnect this unit?')) deleteUserDevice(user!.uid, device.id); }} className="text-slate-200 hover:text-rose-500 p-3 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
            </div>
          ))}
          {devices.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20 opacity-40">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <i className="fa-solid fa-satellite-dish text-4xl text-slate-300"></i>
              </div>
              <p className="font-sans text-sm font-bold px-12 leading-relaxed text-slate-500">No active nodes detected.<br/>Tap (+) to pair new hardware.</p>
            </div>
          )}
        </div>
        <footer className="p-8 text-center text-[9px] font-cyber text-slate-300 tracking-[0.5em] uppercase">Status: Connected to Grid</footer>
      </div>
    );
  }

  if (view === 'add-device') {
    return (
      <div className="h-full w-full flex flex-col relative overflow-hidden view-entry safe-top safe-bottom bg-[#F8FAFC]">
        <header className="px-8 py-8 shrink-0">
          <button onClick={() => setView('device-list')} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-500 shadow-lg border border-slate-50 active:scale-90 transition-transform"><i className="fa-solid fa-arrow-left"></i></button>
        </header>
        <div className="flex-1 px-8 pt-4 overflow-y-auto no-scrollbar pb-10">
          <h2 className="text-4xl font-sans font-black text-slate-800 tracking-tight leading-tight mb-3">Sync <span className="text-blue-600">Module</span></h2>
          <p className="text-slate-500 font-sans text-sm font-medium mb-10 leading-relaxed">Map your physical hardware to the digital console using the unique MAC identifier.</p>
          <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-slate-200 border border-white space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-cyber text-slate-400 uppercase tracking-[0.4em] font-black ml-2">Module Designation</label>
              <input type="text" value={newDeviceName} onChange={(e) => setNewDeviceName(e.target.value)} placeholder="e.g. Master Bank A" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-sans text-lg text-slate-700 focus:border-blue-500 outline-none transition-all shadow-inner" />
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] font-cyber text-slate-400 uppercase tracking-[0.4em] font-black ml-2">Hardware MAC ID</label>
              <input type="text" value={newDeviceMac} onChange={(e) => setNewDeviceMac(e.target.value.toUpperCase())} placeholder="XX:XX:XX:XX:XX:XX" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-mono text-lg text-slate-700 focus:border-emerald-500 outline-none transition-all text-center tracking-widest shadow-inner" />
            </div>
            <button onClick={handleAddDevice} disabled={!newDeviceName || !newDeviceMac} className="w-full mt-4 bg-slate-900 text-white font-cyber py-6 rounded-3xl font-black tracking-[0.5em] active:scale-95 transition-all uppercase text-[10px] shadow-2xl disabled:opacity-20">Initialize Sync</button>
          </div>
        </div>
      </div>
    );
  }

  const isOnline = data && (Date.now() - (data.last_seen || 0) < 60000);
  const bms = data || { voltage: 0, current: 0, soc: 0, uptime: 0, cycles: 0, temp_battery: 0, temp_mos: 0, temp_box: 0, capacity_total: 0, capacity_remain: 0, cells: [] };
  const activeDevice = devices.find(d => d.id === activeDeviceId);

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden view-entry safe-top safe-bottom bg-[#F8FAFC]">
      <header className="px-6 py-5 flex justify-between items-center bg-white/70 backdrop-blur-2xl border-b border-slate-100 z-20 shrink-0">
        <button onClick={() => setView('device-list')} className="w-10 h-10 rounded-xl bg-white shadow-md flex items-center justify-center text-slate-400 border border-slate-50 active:scale-90 transition-transform"><i className="fa-solid fa-chevron-left"></i></button>
        <div className="text-center overflow-hidden flex-1">
           <h2 className="text-slate-800 font-sans font-black text-lg truncate px-4 leading-none mb-1">{activeDevice?.name}</h2>
           <div className="flex items-center justify-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-rose-400'}`}></div>
              <p className="text-[8px] text-slate-400 font-cyber tracking-widest uppercase font-black">{isOnline ? 'Live Link' : 'Signal Lost'}</p>
           </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white shadow-md flex items-center justify-center text-blue-500 border border-slate-50"><i className="fa-solid fa-shield-halved"></i></div>
      </header>

      <nav className="flex px-10 gap-10 bg-transparent pt-8 shrink-0">
        <button onClick={() => setActiveTab('live')} className={`pb-3 font-cyber text-[10px] tracking-[0.3em] uppercase font-black transition-all ${activeTab === 'live' ? 'tab-active' : 'text-slate-300'}`}>Status</button>
        <button onClick={() => setActiveTab('analytics')} className={`pb-3 font-cyber text-[10px] tracking-[0.3em] uppercase font-black transition-all ${activeTab === 'analytics' ? 'tab-active' : 'text-slate-300'}`}>Telemetry</button>
      </nav>

      <main className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
        {activeTab === 'live' ? (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
            <div className="flex justify-center py-6">
              <div className="relative p-10 bg-white rounded-[60px] shadow-2xl shadow-slate-200 border-b-[8px] border-slate-100">
                <CircularProgress value={bms.soc} size={220} strokeWidth={18} />
              </div>
            </div>

            {/* AI Assistant Section powered by Gemini */}
            <div className="bg-white p-7 rounded-[40px] border border-slate-50 shadow-lg relative overflow-hidden group">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-cyber text-[10px] text-slate-800 uppercase tracking-[0.3em] font-black flex items-center gap-3">
                  <div className="w-2 h-4 bg-purple-500 rounded-sm"></div> Predictive Analysis
                </h4>
                <button 
                  onClick={handleAiInsight}
                  disabled={isAiLoading || !isOnline}
                  className="px-3 py-1 bg-purple-50 rounded-full text-[9px] font-cyber text-purple-600 uppercase font-black active:scale-95 transition-all disabled:opacity-20"
                >
                  {isAiLoading ? 'Synthesizing...' : 'Get Insights'}
                </button>
              </div>
              {aiInsight ? (
                <div className="p-4 bg-slate-50/50 rounded-3xl border border-white">
                   <p className="text-xs font-sans text-slate-700 leading-relaxed font-medium">"{aiInsight}"</p>
                </div>
              ) : (
                <div className="text-center py-6">
                   <i className="fa-solid fa-brain text-purple-200 text-3xl mb-3"></i>
                   <p className="text-[10px] font-cyber text-slate-400 uppercase tracking-widest leading-relaxed">Neural Core Ready. Request telemetry analysis for live hardware profiling.</p>
                </div>
              )}
            </div>
            
            <div className="bg-white p-7 rounded-[32px] border border-slate-50 shadow-lg">
              <div className="flex justify-between items-center mb-5">
                <span className="text-[10px] font-cyber text-slate-400 uppercase tracking-widest font-black">Stored Energy</span>
                <span className="font-mono text-sm font-bold text-slate-700">{bms.capacity_remain?.toFixed(1) || '0.0'} / {bms.capacity_total?.toFixed(1) || '0.0'} Ah</span>
              </div>
              <div className="w-full h-4 bg-slate-50 rounded-full overflow-hidden shadow-inner p-1 border border-slate-100">
                 <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-1000 shadow-lg" style={{ width: `${Math.min(100, (bms.capacity_remain || 0) / (bms.capacity_total || 1) * 100)}%` }}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <DataCard label="Voltage" value={bms.voltage} unit="V" color="#0ea5e9" icon={<i className="fa-solid fa-bolt-lightning"></i>} />
              <DataCard label="Current" value={bms.current} unit="A" color="#6366f1" icon={<i className="fa-solid fa-wave-square"></i>} />
              <DataCard label="Cycles" value={bms.cycles} unit="cyc" color="#d946ef" icon={<i className="fa-solid fa-recycle"></i>} />
              <DataCard label="Output" value={Math.abs(bms.current * bms.voltage)} unit="W" color="#10b981" icon={<i className="fa-solid fa-plug-circle-bolt"></i>} />
            </div>

            <div className="bg-white p-7 rounded-[40px] space-y-6 border border-slate-50 shadow-lg">
              <h4 className="font-cyber text-[10px] text-slate-800 uppercase tracking-[0.3em] font-black flex items-center gap-3">
                <div className="w-2 h-4 bg-blue-500 rounded-sm"></div> Thermal Array
              </h4>
              <div className="grid grid-cols-3 gap-4">
                 {[{ label: 'Pack', val: bms.temp_battery }, { label: 'MOS', val: bms.temp_mos }, { label: 'Internal', val: bms.temp_box }].map((t, i) => (
                   <div key={i} className="bg-slate-50/50 p-4 rounded-3xl border border-white text-center shadow-sm">
                     <p className="text-[9px] font-cyber text-slate-400 uppercase mb-2 tracking-tighter">{t.label}</p>
                     <p className="font-mono font-black text-slate-800 text-sm">{(t.val || 0).toFixed(1)}°C</p>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-8 duration-700 space-y-8 pb-10">
            <div className="bg-white p-8 rounded-[40px] shadow-lg border border-slate-50">
               <h3 className="font-cyber text-[10px] text-slate-800 uppercase tracking-[0.3em] font-black mb-8 flex items-center gap-3">
                 <div className="w-2 h-4 bg-emerald-500 rounded-sm"></div> Cell Differential
               </h3>
               <div className="grid grid-cols-4 gap-4">
                 {(bms.cells || []).map((volt, i) => (
                   <div key={i} className="flex flex-col items-center bg-slate-50 p-3 rounded-2xl border border-white shadow-inner">
                     <span className="text-[8px] font-cyber text-slate-300 mb-2 font-black">C{i+1}</span>
                     <span className="font-mono text-[11px] font-black text-slate-700 leading-none">{(volt || 0).toFixed(3)}</span>
                     <div className="w-full h-1.5 bg-slate-200 mt-3 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 shadow-[0_0_5px_#10b981]" style={{ width: `${Math.max(5, Math.min(100, ((volt || 0) - 2.5) / 1.7 * 100))}%` }}></div>
                     </div>
                   </div>
                 ))}
                 {(bms.cells || []).length === 0 && <p className="col-span-4 text-center py-6 text-[10px] text-slate-400 font-cyber italic tracking-widest uppercase">Awaiting cell synchronization...</p>}
               </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-lg border border-slate-50">
               <h3 className="font-cyber text-[10px] text-slate-800 uppercase tracking-[0.3em] font-black mb-8">Current Magnitude History</h3>
               <HistoryChart data={currentHistory} />
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-lg border border-slate-50">
               <h3 className="font-cyber text-[10px] text-slate-800 uppercase tracking-[0.3em] font-black mb-6">Hardware Integrity</h3>
               <div className="space-y-4">
                 <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-white">
                   <span className="text-[10px] text-slate-400 font-cyber uppercase tracking-widest font-black">Designation ID</span>
                   <span className="text-[11px] font-mono font-black text-slate-700">{activeDevice?.id || 'UNSET'}</span>
                 </div>
                 <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-white">
                   <span className="text-[10px] text-slate-400 font-cyber uppercase tracking-widest font-black">Uptime Count</span>
                   <span className="text-[11px] font-mono font-black text-slate-700">{Math.floor((bms.uptime || 0) / 60)}m {(bms.uptime || 0) % 60}s</span>
                 </div>
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 text-center shrink-0 border-t border-slate-50 bg-white/40 backdrop-blur-md">
        <span className="text-[9px] font-cyber tracking-[0.6em] uppercase font-black text-slate-400 drop-shadow-sm">System Ops • CV Control v2.1.0</span>
      </footer>
    </div>
  );
};

export default App;
