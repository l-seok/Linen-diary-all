
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Lock, BookOpen, CheckSquare, Plus, Trash2, Camera, Smile, Meh, Frown, Angry, Zap, Grid, Delete, X, Circle, RefreshCw, Settings, Download, Search, Sun, Moon, Upload, CalendarRange, CalendarDays, ChevronLeft, ChevronRight, Calendar as CalendarIcon, RotateCw, Laugh, PartyPopper } from 'lucide-react';
import { DailyData, ViewMode, Mood, TodoItem } from './types';
import { loadDataByDate, saveDataByDate, loadAllData, getStoredPassword, saveNewPassword, saveAllData } from './utils/storage';

const App: React.FC = () => {
  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [currentData, setCurrentData] = useState<DailyData>(loadDataByDate(selectedDate));
  const [error, setError] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTodoText, setNewTodoText] = useState('');

  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdStep, setPwdStep] = useState<'verify' | 'new'>('verify');
  const [pwdInput, setPwdInput] = useState('');
  const [newPwdInput, setNewPwdInput] = useState('');

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isDataLoading = useRef(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    isDataLoading.current = true;
    const loaded = loadDataByDate(selectedDate);
    setCurrentData(loaded);
    stopCamera();
    setTimeout(() => { isDataLoading.current = false; }, 50);
  }, [selectedDate]);

  useEffect(() => {
    if (isAuthenticated && !isDataLoading.current) {
      saveDataByDate(selectedDate, currentData);
    }
  }, [currentData, isAuthenticated, selectedDate]);

  const getDayOfWeek = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return '-';
    return days[date.getDay()];
  };

  const changeDateByOffset = (offset: number) => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + offset);
    setSelectedDate(getLocalDateString(date));
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const all = loadAllData();
    const q = searchQuery.toLowerCase();
    return Object.entries(all)
      .filter(([_, data]) => {
        const inDiary = (data.diary || '').toLowerCase().includes(q);
        const inTodo = (data.todo || []).some(t => t.text.toLowerCase().includes(q));
        return inDiary || inTodo;
      })
      .sort(([a], [b]) => b.localeCompare(a));
  }, [searchQuery]);

  const handleBackup = () => {
    const data = {
      app_data: loadAllData(),
      app_pwd: getStoredPassword(),
      backup_date: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `linen_diary_backup_${getLocalDateString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.app_data && data.app_pwd) {
          if (confirm("데이터를 복구하시겠습니까? 현재 데이터는 삭제됩니다.")) {
            saveAllData(data.app_data);
            saveNewPassword(data.app_pwd);
            window.location.reload();
          }
        }
      } catch (err) { alert("잘못된 백업 파일입니다."); }
    };
    reader.readAsText(file);
  };

  const handleKeypadClick = (val: string) => {
    if (password.length < 4) {
      const next = password + val;
      setPassword(next);
      if (next.length === 4) {
        if (next === getStoredPassword()) {
          setIsAuthenticated(true);
          setError('');
          setPassword(''); 
        } else {
          setError('비밀번호가 일치하지 않습니다.');
          setPassword('');
        }
      }
    }
  };

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    const newTodo: TodoItem = { 
      id: Date.now().toString(), 
      text: newTodoText, 
      completed: false,
    };
    setCurrentData(prev => ({ ...prev, todo: [...(prev.todo || []), newTodo] }));
    setNewTodoText('');
  };

  const handleTodoToggle = (id: string) => {
    setCurrentData(prev => ({
      ...prev,
      todo: prev.todo.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    }));
  };

  const updateTodoRepeatDays = (id: string, days: number) => {
    setCurrentData(prev => ({
      ...prev,
      todo: prev.todo.map(t => t.id === id ? { ...t, repeatDays: isNaN(days) ? undefined : days } : t)
    }));
  };

  const triggerRepeat = (todo: TodoItem) => {
    if (!todo.repeatDays || todo.repeatDays <= 0) {
      alert("반복 일수를 입력해주세요.");
      return;
    }

    const futureDate = new Date(selectedDate + 'T00:00:00');
    futureDate.setDate(futureDate.getDate() + todo.repeatDays);
    const futureDateStr = getLocalDateString(futureDate);
    
    const futureData = loadDataByDate(futureDateStr);
    const nextTodo: TodoItem = {
      ...todo,
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      completed: false
    };
    
    futureData.todo.push(nextTodo);
    saveDataByDate(futureDateStr, futureData);
    alert(`${futureDateStr} 날짜로 투두가 복사되었습니다.`);
  };

  const deleteTodo = (id: string) => {
    setCurrentData(prev => ({ ...prev, todo: (prev.todo || []).filter(t => t.id !== id) }));
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setIsProcessingImage(true);
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        const p = new Promise<string>((res) => {
          reader.onloadend = async () => res(await compressImage(reader.result as string));
          reader.readAsDataURL(files[i]);
        });
        const compressed = await p;
        setCurrentData(prev => ({ ...prev, photos: [...(prev.photos || []), compressed] }));
      }
      setIsProcessingImage(false);
    }
  };

  const startCamera = async (mode?: 'user' | 'environment') => {
    const targetMode = mode || facingMode;
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: targetMode } });
      streamRef.current = stream;
      setFacingMode(targetMode);
      setIsCameraActive(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch (err) { alert("카메라를 켤 수 없습니다."); }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setIsCameraActive(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current) {
      setIsProcessingImage(true);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(videoRef.current, 0, 0);
        const compressed = await compressImage(canvas.toDataURL('image/jpeg'));
        setCurrentData(prev => ({ ...prev, photos: [...(prev.photos || []), compressed] }));
      }
      setIsProcessingImage(false);
    }
  };

  const galleryItems = useMemo(() => {
    const all = loadAllData();
    return Object.entries(all)
      .filter(([_, d]) => d.photos && d.photos.length > 0)
      .sort(([a], [b]) => b.localeCompare(a));
  }, [currentData.photos, selectedDate]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-linen-bg dark:bg-linen-darkBg">
        <div className="linen-card w-full max-w-sm p-8 text-center animate-in border dark:border-[#3a342e]">
          <div className="mb-6 flex justify-center">
            <div className="bg-[#f0ede6] dark:bg-[#3a342e] p-4 rounded-full">
              <Lock className="w-10 h-10 linen-accent dark:text-[#b5a48d]" />
            </div>
          </div>
          <h1 className="text-xl font-bold mb-2 linen-accent dark:text-[#b5a48d]">Soft Linen Diary</h1>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-8">비밀번호 4자리를 입력해주세요.</p>
          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${password.length > i ? 'bg-[#8d775f] border-[#8d775f]' : 'border-gray-200 dark:border-gray-700'}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} onClick={() => handleKeypadClick(num.toString())} className="aspect-square flex items-center justify-center text-xl font-bold text-gray-600 dark:text-gray-300 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-2xl border border-[#f0ede6] dark:border-[#4a443e] active:scale-95 transition-all">{num}</button>
            ))}
            <button onClick={() => setPassword('')} className="aspect-square flex items-center justify-center text-xs font-bold text-red-400 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-2xl border active:scale-95">초기화</button>
            <button onClick={() => handleKeypadClick('0')} className="aspect-square flex items-center justify-center text-xl font-bold text-gray-600 dark:text-gray-300 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-2xl border active:scale-95">0</button>
            <button onClick={() => setPassword(prev => prev.slice(0, -1))} className="aspect-square flex items-center justify-center text-gray-400 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-2xl border active:scale-95"><Delete /></button>
          </div>
          {error && <p className="text-red-400 text-xs mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto min-h-screen p-4 pb-24 md:p-8 animate-in transition-colors">
      {/* 설정 모달 */}
      {showPwdModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="linen-card w-full max-w-sm p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold linen-accent flex items-center gap-2"><Settings size={20}/> 설정</h2>
              <button onClick={() => setShowPwdModal(false)}><X /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button onClick={handleBackup} className="flex flex-col items-center gap-2 p-3 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl border"><Download className="w-5 h-5 linen-accent" /><span className="text-[10px] font-bold">백업</span></button>
              <label className="flex flex-col items-center gap-2 p-3 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl border cursor-pointer"><Upload className="w-5 h-5 linen-accent" /><span className="text-[10px] font-bold">복구</span><input type="file" accept=".json" onChange={handleRestore} className="hidden" /></label>
            </div>
            <div className="text-center pt-4 border-t">
              <p className="text-xs font-bold mb-4">{pwdStep === 'verify' ? '현재 비번 입력' : '새 비번 입력'}</p>
              <div className="flex justify-center gap-4 mb-6">
                {[0, 1, 2, 3].map(i => (<div key={i} className={`w-3 h-3 rounded-full border-2 ${(pwdStep === 'verify' ? pwdInput : newPwdInput).length > i ? 'bg-[#8d775f] border-[#8d775f]' : 'border-gray-200'}`} />))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0].map((num, i) => num !== '' ? (<button key={i} onClick={() => {
                  const currentInput = pwdStep === 'verify' ? pwdInput : newPwdInput;
                  if (currentInput.length < 4) {
                    const next = currentInput + num;
                    if (pwdStep === 'verify') {
                      setPwdInput(next);
                      if (next.length === 4) {
                        if (next === getStoredPassword()) { setPwdStep('new'); setPwdInput(''); }
                        else { alert('비밀번호가 틀립니다.'); setPwdInput(''); }
                      }
                    } else {
                      setNewPwdInput(next);
                      if (next.length === 4) { saveNewPassword(next); alert('변경되었습니다.'); setShowPwdModal(false); }
                    }
                  }
                }} className="aspect-square flex items-center justify-center font-bold bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl border">{num}</button>) : <div key={i}/>)}
                <button onClick={() => pwdStep === 'verify' ? setPwdInput(prev => prev.slice(0, -1)) : setNewPwdInput(prev => prev.slice(0, -1))} className="aspect-square flex items-center justify-center bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl border"><Delete /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 검색 모달 */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="linen-card w-full max-w-md h-[80vh] flex flex-col p-6">
            <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-bold linen-accent flex items-center gap-2"><Search size={20}/> 검색</h2><button onClick={() => setIsSearchOpen(false)}><X /></button></div>
            <input autoFocus type="text" placeholder="검색어 입력..." className="w-full px-4 py-3 bg-[#fcfaf7] dark:bg-[#3a342e] border rounded-xl mb-4 text-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
              {searchResults.length > 0 ? searchResults.map(([date, data]) => (
                <button key={date} onClick={() => { setSelectedDate(date); setViewMode('diary'); setIsSearchOpen(false); }} className="w-full text-left p-4 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl border hover:border-[#8d775f] transition-all">
                  <div className="text-xs font-bold linen-accent mb-1 whitespace-nowrap">{date} ({getDayOfWeek(date)})</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{data.diary || '기록 없음'}</p>
                </button>
              )) : (
                <div className="text-center py-20 text-gray-400 text-sm">검색 결과가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="mb-8 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold linen-accent flex items-center gap-2"><BookOpen /> Linen Diary</h1>
          <div className="flex gap-2">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-white dark:bg-[#2a2420] rounded-full border shadow-sm transition-colors">{isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <button onClick={() => setIsSearchOpen(true)} className="p-2 bg-white dark:bg-[#2a2420] rounded-full border shadow-sm transition-colors"><Search size={18}/></button>
            <button onClick={() => setShowPwdModal(true)} className="p-2 bg-white dark:bg-[#2a2420] rounded-full border shadow-sm transition-colors"><Settings size={18}/></button>
            <button onClick={() => setIsAuthenticated(false)} className="px-3 py-1 bg-white dark:bg-[#2a2420] border rounded-full text-xs font-bold text-gray-400 transition-colors">잠금</button>
          </div>
        </div>
        
        <div className="bg-white dark:bg-[#2a2420] p-4 rounded-2xl shadow-sm border space-y-3">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <button onClick={() => changeDateByOffset(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"><ChevronLeft size={20}/></button>
            
            <div className="relative flex-shrink-0">
              <button className="p-2 bg-[#fcfaf7] dark:bg-[#3a342e] border rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <CalendarIcon size={20} className="linen-accent" />
              </button>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }} 
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>

            <div className="flex-1 flex items-center justify-center bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl px-2 py-2 border overflow-hidden">
              <span className="text-sm font-bold whitespace-nowrap truncate">
                {selectedDate} <span className="linen-accent ml-1">({getDayOfWeek(selectedDate)})</span>
              </span>
            </div>

            <button onClick={() => changeDateByOffset(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"><ChevronRight size={20}/></button>
            <button onClick={() => setSelectedDate(getLocalDateString())} className="px-3 py-2 bg-[#fcfaf7] dark:bg-[#3a342e] border rounded-xl text-[11px] font-bold flex items-center gap-1 active:scale-95 flex-shrink-0 transition-colors"><CalendarDays size={14}/> 오늘</button>
          </div>
          <div className="flex gap-2">
            {['main', 'diary', 'gallery'].map((m) => (
              <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === m ? 'linen-btn' : 'bg-[#f0ede6] dark:bg-[#3a342e] text-gray-500'}`}>
                {m === 'main' ? '투두' : m === 'diary' ? '일기' : '갤러리'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main>
        {viewMode === 'main' && (
          <section className="linen-card p-6 border space-y-4 animate-in">
            <h3 className="font-bold linen-accent flex items-center gap-2"><CheckSquare size={18}/> 투두 리스트</h3>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar">
              {currentData.todo && currentData.todo.length > 0 ? currentData.todo.map(todo => (
                <div key={todo.id} className="flex items-center gap-2 bg-[#fcfaf7] dark:bg-[#3a342e] p-3 rounded-xl border transition-all">
                  <input type="checkbox" checked={todo.completed} onChange={() => handleTodoToggle(todo.id)} className="w-5 h-5 accent-[#8d775f] cursor-pointer" />
                  <span className={`flex-1 text-sm truncate ${todo.completed ? 'line-through text-gray-400 italic' : 'text-gray-700 dark:text-gray-200'}`}>{todo.text}</span>
                  
                  <div className="flex items-center gap-1 bg-white/50 dark:bg-black/20 p-1 rounded-lg border border-dotted border-[#8d775f]/30">
                    <input 
                      type="number" 
                      min="1" 
                      placeholder="일"
                      value={todo.repeatDays || ''} 
                      onChange={(e) => updateTodoRepeatDays(todo.id, parseInt(e.target.value))}
                      className="w-10 text-[10px] p-1 bg-white dark:bg-[#2a2420] border rounded outline-none focus:border-[#8d775f]" 
                    />
                    <button 
                      onClick={() => triggerRepeat(todo)} 
                      title="해당 일수 뒤로 반복 등록"
                      className="p-1.5 text-[#8d775f] hover:bg-[#8d775f] hover:text-white rounded-md transition-all active:scale-90"
                    >
                      <RotateCw size={14}/>
                    </button>
                  </div>

                  <button onClick={() => deleteTodo(todo.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1"><Trash2 size={18}/></button>
                </div>
              )) : (
                <div className="text-center py-10 text-gray-400 text-xs">할 일이 없습니다.</div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <input 
                type="text" 
                value={newTodoText} 
                onChange={e => setNewTodoText(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addTodo()} 
                placeholder="새로운 할 일..." 
                className="flex-1 px-4 py-2 bg-[#fcfaf7] dark:bg-[#3a342e] border rounded-xl text-sm focus:border-[#8d775f] outline-none transition-colors" 
              />
              <button onClick={addTodo} className="linen-btn p-2 rounded-xl active:scale-90 transition-transform"><Plus/></button>
            </div>
          </section>
        )}

        {viewMode === 'diary' && (
          <section className="linen-card p-6 border space-y-6 animate-in">
            <div className="space-y-4">
              <h3 className="font-bold linen-accent flex items-center gap-2"><Smile size={18}/> 오늘의 기분</h3>
              
              <div className="grid grid-cols-5 gap-2 bg-[#fcfaf7] dark:bg-[#3a342e] p-3 rounded-2xl border">
                {[ 
                  { id: 'happy', icon: Laugh, color: '#f59e0b', label: '행복' }, 
                  { id: 'excited', icon: PartyPopper, color: '#facc15', label: '신남' }, 
                  { id: 'neutral', icon: Meh, color: '#94a3b8', label: '그저럼' }, 
                  { id: 'sad', icon: Frown, color: '#60a5fa', label: '우울' }, 
                  { id: 'angry', icon: Angry, color: '#f87171', label: '화남' } 
                ].map(({ id, icon: Icon, color, label }) => (
                  <button 
                    key={id} 
                    onClick={() => setCurrentData(prev => ({ ...prev, mood: id as Mood }))} 
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all duration-300 transform ${
                      currentData.mood === id 
                        ? 'bg-white dark:bg-[#1a1614] shadow-md scale-105 ring-2 ring-linen-accent/20' 
                        : 'opacity-40 grayscale hover:grayscale-0 hover:opacity-80 active:scale-95'
                    }`}
                  >
                    <Icon 
                      size={28} 
                      className="transition-colors"
                      strokeWidth={currentData.mood === id ? 2.5 : 2}
                      style={{ color: currentData.mood === id ? color : 'currentColor' }} 
                    />
                    <span className={`text-[10px] font-bold ${currentData.mood === id ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-gray-400">오늘의 사진 ({currentData.photos?.length || 0})</span>
                <div className="flex gap-2">
                  <button onClick={() => startCamera()} className="text-[11px] font-bold text-[#8d775f] px-2 py-1 bg-[#f0ede6] dark:bg-[#3a342e] rounded-md active:scale-95 transition-transform">촬영</button>
                  <label className="text-[11px] font-bold text-[#8d775f] px-2 py-1 bg-[#f0ede6] dark:bg-[#3a342e] rounded-md cursor-pointer active:scale-95 transition-transform">추가<input type="file" multiple accept="image/*" onChange={handlePhotoUpload} className="hidden" /></label>
                </div>
              </div>
              {isCameraActive && (
                <div className="aspect-video bg-black rounded-2xl overflow-hidden relative">
                  <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
                  <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
                    <button onClick={stopCamera} className="p-2 bg-white/20 rounded-full text-white backdrop-blur-md"><X/></button>
                    <button onClick={capturePhoto} className="p-4 bg-white rounded-full text-[#8d775f] active:scale-90 transition-transform"><Circle fill="currentColor" size={24}/></button>
                    <button onClick={() => startCamera(facingMode === 'user' ? 'environment' : 'user')} className="p-2 bg-white/20 rounded-full text-white backdrop-blur-md"><RefreshCw/></button>
                  </div>
                </div>
              )}
              
              <div className={`grid gap-2 overflow-x-auto no-scrollbar ${
                (currentData.photos || []).length === 1 ? 'grid-cols-1' : 
                (currentData.photos || []).length === 2 ? 'grid-cols-2' : 
                'grid-cols-3'
              }`}>
                {(currentData.photos || []).map((p, i) => (
                  <div key={i} className={`relative rounded-xl overflow-hidden border ${(currentData.photos || []).length === 1 ? 'aspect-video' : 'aspect-square shadow-sm'}`}>
                    <img src={p} className="w-full h-full object-cover" loading="lazy" />
                    <button onClick={() => setCurrentData(prev => ({ ...prev, photos: (prev.photos || []).filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 p-1 bg-black/40 text-white rounded-full transition-opacity active:bg-black/60"><X size={10}/></button>
                  </div>
                ))}
              </div>

              <textarea value={currentData.diary} onChange={e => setCurrentData(prev => ({ ...prev, diary: e.target.value }))} placeholder="오늘을 기록하세요..." className="w-full h-64 p-4 bg-[#fcfaf7] dark:bg-[#3a342e] border rounded-2xl text-sm focus:outline-none focus:border-[#8d775f] resize-none leading-relaxed dark:text-gray-200 transition-colors" />
              <button onClick={() => { saveDataByDate(selectedDate, currentData); setViewMode('gallery'); }} className="w-full py-3 linen-btn rounded-xl font-bold shadow-md active:scale-[0.98] transition-all">기록 완료</button>
            </div>
          </section>
        )}

        {viewMode === 'gallery' && (
          <section className="linen-card p-6 border animate-in">
            <h3 className="font-bold linen-accent flex items-center gap-2 mb-6"><Grid size={18}/> 갤러리</h3>
            <div className="grid grid-cols-2 gap-4">
              {galleryItems.length > 0 ? galleryItems.map(([date, data]) => (
                <div key={date} onClick={() => { setSelectedDate(date); setViewMode('diary'); }} className="group relative aspect-square bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl overflow-hidden border cursor-pointer active:scale-95 transition-transform">
                  <img src={data.photos[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/80 dark:bg-black/60 rounded text-[9px] font-bold whitespace-nowrap">{date.slice(5)} ({getDayOfWeek(date)})</div>
                  {data.photos.length > 1 && <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 text-white rounded text-[8px] font-bold">+{data.photos.length - 1}</div>}
                </div>
              )) : (
                <div className="col-span-2 text-center py-20 text-gray-400 text-sm">기록된 사진이 없습니다.</div>
              )}
            </div>
          </section>
        )}
      </main>
      <footer className="mt-12 text-center text-[10px] text-gray-300 dark:text-gray-600">모든 데이터는 브라우저에만 안전하게 저장됩니다.</footer>
    </div>
  );
};

export default App;
