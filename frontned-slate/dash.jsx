import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  Plus, 
  Calendar, 
  MessageSquare, 
  CheckSquare, 
  Users, 
  Clock, 
  MoreVertical, 
  Search, 
  Bell, 
  Settings,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Circle,
  Zap,
  Square
} from 'lucide-react';

// --- DESIGN SYSTEM CONSTANTS ---
import { COLORS, TYPOGRAPHY } from './config/design';

// --- MOCK DATA ---
import { UPCOMING_MEETINGS, RECENT_MEETINGS, RECAPS, ACTION_ITEMS } from './data/mockData';

// --- COMPONENTS ---
import BrutalButton from './components/BrutalButton';
import RecapCard from './components/RecapCard';
import ActionItem from './components/ActionItem';
import LedgerWindow from './components/LedgerWindow';

const App = () => {
  const [feedType, setFeedType] = useState('UPCOMING');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const recapScrollRef = useRef(null);
  const feedScrollRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTimeIST = currentTime.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const handleScroll = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = ref === recapScrollRef ? 220 : 300;
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleRecapLoopScroll = () => {
    if (!recapScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = recapScrollRef.current;
    
    if (scrollLeft + clientWidth >= scrollWidth - 5) {
      recapScrollRef.current.scrollTo({ left: 5 });
    } else if (scrollLeft <= 0) {
      recapScrollRef.current.scrollTo({ left: scrollWidth - clientWidth - 10 });
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.CANVAS, color: COLORS.INK, fontFamily: TYPOGRAPHY.BODY }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;700;900&display=swap');
        
        @keyframes brutal-ping {
          0% { transform: scale(1); opacity: 1; }
          70%, 100% { transform: scale(2.8); opacity: 0; }
        }
        .animate-brutal-ping {
          animation: brutal-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <main className="max-w-[1440px] mx-auto p-6 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          <div className="lg:col-span-8 flex flex-col gap-8">
            
            {/* GREETING WITH LIVE IST CLOCK */}
            <div className="border-[3px] border-[#0a0a0a] bg-[#0a0a0a] text-[#ffe500] px-6 py-4 shadow-[6px_6px_0px_0px_#0a0a0a] flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-widest" style={{ fontFamily: TYPOGRAPHY.DISPLAY }}>
                Welcome back, Sana
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-brutal-ping absolute inline-flex h-full w-full rounded-full bg-[#c6ff3d] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c6ff3d]"></span>
                  </div>
                  <span className="text-[11px] font-black tracking-[0.2em]" style={{ fontFamily: TYPOGRAPHY.DISPLAY }}>
                    IST {formattedTimeIST}
                  </span>
                </div>
              </div>
            </div>
            
            {/* DASHBOARD OVERVIEW */}
            <LedgerWindow title="DASHBOARD OVERVIEW" headerColor={COLORS.WHITE}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
                {[
                  { label: 'TOTAL CALLS', value: '24', color: COLORS.YELLOW },
                  { label: 'UPCOMING', value: '03', color: COLORS.PINK },
                  { label: 'TOTAL HOURS', value: '18.5', color: COLORS.LIME },
                  { label: 'ATTENDEES', value: '142', color: COLORS.BLUE },
                ].map((card, i) => (
                  <div key={i} className="border-[3px] border-black p-6 bg-white shadow-[4px_4px_0px_0px_#0a0a0a] hover:-translate-y-1 transition-transform">
                    <div className="text-4xl font-black mb-1" style={{ fontFamily: TYPOGRAPHY.DISPLAY }}>{card.value}</div>
                    <div className="text-[10px] font-black text-black/40 uppercase tracking-widest" style={{ fontFamily: TYPOGRAPHY.DISPLAY }}>{card.label}</div>
                    <div className="mt-4 h-2 w-full bg-black/5 overflow-hidden">
                      <div className="h-full" style={{ backgroundColor: card.color, width: '65%' }}></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <h3 className="text-[11px] font-black text-black/30 uppercase tracking-[0.2em]" style={{ fontFamily: TYPOGRAPHY.DISPLAY }}>Quick Actions</h3>
              </div>

              <div className="flex flex-wrap gap-5">
                <BrutalButton className="flex-1 min-w-[160px] py-6">
                  <div className="flex flex-col items-center gap-3">
                    <Video size={24} strokeWidth={2.5} />
                    <span className="text-[11px]">New Meeting</span>
                  </div>
                </BrutalButton>
                <BrutalButton variant="outline" className="flex-1 min-w-[160px] py-6">
                  <div className="flex flex-col items-center gap-3">
                    <Plus size={24} strokeWidth={2.5} />
                    <span className="text-[11px]">Join Meeting</span>
                  </div>
                </BrutalButton>
                <BrutalButton variant="primary" className="flex-1 min-w-[160px] py-6">
                  <div className="flex flex-col items-center gap-3">
                    <Calendar size={24} strokeWidth={2.5} />
                    <span className="text-[11px]">Schedule</span>
                  </div>
                </BrutalButton>
              </div>
            </LedgerWindow>

            {/* ACTIVITY FEEDS */}
            <LedgerWindow title="ACTIVITY FEEDS" headerColor={COLORS.WHITE}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex border-2 border-black p-0.5 bg-slate-100">
                  <button 
                    onClick={() => setFeedType('UPCOMING')}
                    className={`px-6 py-2 text-[10px] font-black uppercase transition-all ${feedType === 'UPCOMING' ? 'bg-black text-[#ffe500]' : ''}`}
                  >UPCOMING</button>
                  <button 
                    onClick={() => setFeedType('RECENT')}
                    className={`px-6 py-2 text-[10px] font-black uppercase transition-all ${feedType === 'RECENT' ? 'bg-black text-[#ffe500]' : ''}`}
                  >RECENT</button>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleScroll(feedScrollRef, 'left')}
                    className="p-1.5 border-2 border-black bg-white active:scale-[1.1] transition-transform"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    onClick={() => handleScroll(feedScrollRef, 'right')}
                    className="p-1.5 border-2 border-black bg-white active:scale-[1.1] transition-transform"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <div 
                ref={feedScrollRef}
                className="grid grid-cols-1 md:flex md:gap-6 overflow-x-auto no-scrollbar pb-2"
              >
                {(feedType === 'UPCOMING' ? UPCOMING_MEETINGS : RECENT_MEETINGS).map((m) => (
                  <div key={m.id} className="border-[3px] border-black p-5 bg-white shadow-[4px_4px_0px_0px_#0a0a0a] hover:-translate-y-1 transition-transform cursor-pointer min-w-[280px]">
                    <div className="text-[9px] font-black bg-black text-white px-2 py-0.5 inline-block mb-4 tracking-widest">{m.type}</div>
                    <h3 className="text-sm font-black mb-1 uppercase leading-tight" style={{ fontFamily: TYPOGRAPHY.DISPLAY }}>{m.title}</h3>
                    <div className="text-[11px] font-bold text-black/40 mb-5 flex items-center gap-2">
                      <Clock size={12} /> {m.time} // {m.duration}
                    </div>
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map(j => (
                        <div key={j} className="w-8 h-8 border-2 border-black bg-white rounded-full overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.id + j + 5}`} alt="user" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </LedgerWindow>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-8">
            
            {/* RECENT MEETING RECAPS */}
            <LedgerWindow title="RECENT MEETING RECAPS">
              <div className="flex flex-col gap-6">
                <RecapCard data={RECAPS[0]} />
                
                <div className="h-[1px] bg-black/10 w-full"></div>

                <div className="relative group">
                  <button 
                    onClick={() => handleScroll(recapScrollRef, 'left')}
                    className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-[#ffe500] border-2 border-black shadow-[2px_2px_0px_0px_#0a0a0a] flex items-center justify-center active:scale-[1.1] transition-transform"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={() => handleScroll(recapScrollRef, 'right')}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-[#ffe500] border-2 border-black shadow-[2px_2px_0px_0px_#0a0a0a] flex items-center justify-center active:scale-[1.1] transition-transform"
                  >
                    <ChevronRight size={16} />
                  </button>

                  <div 
                    ref={recapScrollRef} 
                    onScroll={handleRecapLoopScroll}
                    className="flex gap-4 overflow-x-auto no-scrollbar pb-4 cursor-grab select-none px-2"
                  >
                    {[...RECAPS.slice(1), ...RECAPS.slice(1), ...RECAPS.slice(1)].map((r, idx) => (
                      <RecapCard key={`${r.id}-${idx}`} data={r} />
                    ))}
                  </div>
                </div>
              </div>
            </LedgerWindow>

            {/* ACTION ITEMS */}
            <LedgerWindow 
              title="ACTION ITEMS" 
              footer={
                <BrutalButton className="w-full !py-3 !text-[10px]">
                  VIEW ALL ACTION ITEMS
                </BrutalButton>
              }
            >
              <div className="flex flex-col">
                {ACTION_ITEMS.slice(0, 5).map(item => (
                  <ActionItem key={item.id} item={item} />
                ))}
              </div>
            </LedgerWindow>
          </div>

        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-10 border-t-[3px] border-black bg-black text-white flex items-center px-8 justify-between z-50">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#c6ff3d] animate-pulse"></div>
            <span className="text-[9px] font-black uppercase tracking-widest">Sana_Workspace_V4.0</span>
          </div>
          <div className="h-4 w-[1px] bg-white/20"></div>
          <span className="text-[9px] font-black opacity-40 uppercase tracking-[0.2em] truncate">All Systems Nominal</span>
        </div>
        <div className="flex gap-4">
           <span className="text-[9px] font-black tracking-widest uppercase">UTC 04:32</span>
           <Settings size={14} className="opacity-40 hover:opacity-100 cursor-pointer" />
        </div>
      </footer>
    </div>
  );
};

export default App;