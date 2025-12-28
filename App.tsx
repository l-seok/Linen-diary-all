
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Lock, BookOpen, CheckSquare, Plus, Trash2, Camera, Smile, Meh, Frown, Angry, Zap, Grid, Delete, X, Circle, Loader2, RefreshCw, Settings, Download, Search, Sun, Moon, Upload, CalendarRange, Images, CalendarDays } from 'lucide-react';
import { DailyData, ViewMode, Mood, TodoItem } from './types';
import { loadDataByDate, saveDataByDate, loadAllData, getStoredPassword, saveNewPassword, saveAllData } from './utils/storage';

const App: React.FC = () => {
  // 로컬 시간 기준 YYYY-MM-DD 생성 (타임존 보정)
  const getLocalDateString = (date: Date = new Date()) => {
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 10);
    return localISOTime;
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
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const getDayOfWeek = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return days[date.getDay()];
  };

  useEffect(() => {
    setCurrentData(loadDataByDate(selectedDate));
    stopCamera();
  }, [selectedDate]);

  useEffect(() => {
    if (isAuthenticated) {
      saveDataByDate(selectedDate, currentData);
    }
  }, [currentData, selectedDate, isAuthenticated]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const all = loadAllData();
    const q = searchQuery.toLowerCase();
    return Object.entries(all)
      .filter(([_, data]) => {
        const inDiary = data.diary.toLowerCase().includes(q);
        const inTodo = data.todo.some(t => t.text.toLowerCase().includes(q));
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
          if (confirm("기존 데이터가 모두 삭제되고 백업 데이터로 대체됩니다. 계속하시겠습니까?")) {
            saveAllData(data.app_data);
            saveNewPassword(data.app_pwd);
            alert("성공적으로 복구되었습니다. 다시 로그인해주세요.");
            window.location.reload();
          }
        } else {
          alert("유효한 백업 파일이 아닙니다.");
        }
      } catch (err) {
        alert("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
  };

  const handleKeypadClick = (val: string) => {
    if (password.length < 4) {
      const newPassword = password + val;
      setPassword(newPassword);
      if (newPassword.length === 4) {
        const stored = getStoredPassword();
        if (newPassword === stored) {
          setIsAuthenticated(true);
          setError('');
          setPassword(''); 
        } else {
          setError('비밀번호가 틀렸습니다.');
          setPassword('');
        }
      }
    }
  };

  const handleBackspace = () => setPassword(prev => prev.slice(0, -1));

  const handleModalKeypad = (val: string) => {
    if (pwdStep === 'verify') {
      if (pwdInput.length < 4) {
        const next = pwdInput + val;
        setPwdInput(next);
        if (next.length === 4) {
          if (next === getStoredPassword()) {
            setPwdStep('new');
            setPwdInput('');
          } else {
            alert('현재 비밀번호가 일치하지 않습니다.');
            setPwdInput('');
          }
        }
      }
    } else {
      if (newPwdInput.length < 4) {
        const next = newPwdInput + val;
        setNewPwdInput(next);
        if (next.length === 4) {
          saveNewPassword(next);
          alert('비밀번호가 성공적으로 변경되었습니다.');
          closePwdModal();
        }
      }
    }
  };

  const closePwdModal = () => {
    setShowPwdModal(false);
    setPwdStep('verify');
    setPwdInput('');
    setNewPwdInput('');
  };

  const updateTodoRepeat = (id: string, days: number) => {
    setCurrentData(prev => ({
      ...prev,
      todo: prev.todo.map(t => t.id === id ? { ...t, repeatDays: days > 0 ? days : undefined } : t)
    }));
  };

  const createFutureTodo = (todoText: string, days: number) => {
    if (!days || days <= 0) return;
    const futureDate = new Date(selectedDate);
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateStr = getLocalDateString(futureDate);
    
    const futureData = loadDataByDate(futureDateStr);
    const newFutureTodo: TodoItem = {
      id: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5),
      text: todoText,
      completed: false,
      repeatDays: days
    };
    
    if (!futureData.todo.some(t => t.text === todoText && !t.completed)) {
      futureData.todo.push(newFutureTodo);
      saveDataByDate(futureDateStr, futureData);
      alert(`${days}일 뒤(${futureDateStr})에 할 일이 추가되었습니다.`);
    }
  };

  const handleTodoToggle = (id: string) => {
    setCurrentData(prev => ({
      ...prev,
      todo: prev.todo.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    }));
  };

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    const newTodo: TodoItem = { id: Date.now().toString(), text: newTodoText, completed: false };
    setCurrentData(prev => ({ ...prev, todo: [...prev.todo, newTodo] }));
    setNewTodoText('');
  };

  const deleteTodo = (id: string) => {
    setCurrentData(prev => ({ ...prev, todo: prev.todo.filter(t => t.id !== id) }));
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
    if (files && files.length > 0) {
      setIsProcessingImage(true);
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        const p = new Promise<string>((resolve) => {
          reader.onloadend = async () => resolve(await compressImage(reader.result as string));
          reader.readAsDataURL(files[i]);
        });
        newPhotos.push(await p);
      }
      setCurrentData(prev => ({ ...prev, photos: [...(prev.photos || []), ...newPhotos] }));
      setIsProcessingImage(false);
    }
  };

  const startCamera = async (mode?: 'user' | 'environment') => {
    setIsCameraLoading(true);
    const targetMode = mode || facingMode;
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: targetMode } });
      streamRef.current = stream;
      setFacingMode(targetMode);
      setIsCameraActive(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 50);
    } catch (err) { alert("카메라를 사용할 수 없습니다."); }
    finally { setIsCameraLoading(false); }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
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
  }, [viewMode, currentData.photos, selectedDate]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-linen-bg dark:bg-linen-darkBg">
        <div className="linen-card w-full max-w-sm p-8 text-center animate-in border dark:border-[#3a342e]">
          <div className="mb-6 flex justify-center"><div className="bg-[#f0ede6] dark:bg-[#3a342e] p-4 rounded-full"><Lock className="w-10 h-10 linen-accent dark:text-[#b5a48d]" /></div></div>
          <h1 className="text-xl font-bold mb-2 linen-accent dark:text-[#b5a48d]">Soft Linen Diary</h1>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-8">비밀번호 4자리를 입력해주세요.</p>
          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map(i => (<div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${password.length > i ? 'bg-[#8d775f] border-[#8d775f]' : 'border-gray-200 dark:border-gray-700'}`} />))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (<button key={num} onClick={() => handleKeypadClick(num.toString())} className="aspect-square flex items-center justify-center text-xl font-bold text-gray-600 dark:text-gray-300 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-2xl border border-[#f0ede6] dark:border-[#4a443e] active:scale-95 transition-all">{num}</button>))}
            <button onClick={() => setPassword('')} className="aspect-square flex items-center justify-center text-xs font-bold text-red-400 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-2xl border active:scale-95">초기화</button>
            <button onClick={() => handleKeypadClick('0')} className="aspect-square flex items-center justify-center text-xl font-bold text-gray-600 dark:text-gray-300 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-2xl border active:scale-95">0</button>
            <button onClick={handleBackspace} className="aspect-square flex items-center justify-center text-gray-400 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-2xl border active:scale-95"><Delete /></button>
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
              <h2 className="text-lg font-bold linen-accent flex items-center gap-2"><Settings /> 설정</h2>
              <button onClick={closePwdModal}><X /></button>
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
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0].map((num, i) => num !== '' ? (<button key={i} onClick={() => handleModalKeypad(num.toString())} className="aspect-square flex items-center justify-center font-bold bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl border">{num}</button>) : <div key={i}/>)}
                <button onClick={() => pwdStep === 'verify' ? setPwdInput(prev => prev.slice(0,-1)) : setNewPwdInput(prev => prev.slice(0,-1))} className="aspect-square flex items-center justify-center bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl border"><Delete /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 검색 모달 */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="linen-card w-full max-w-md h-[80vh] flex flex-col p-6">
            <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-bold linen-accent flex items-center gap-2"><Search /> 검색</h2><button onClick={() => setIsSearchOpen(false)}><X /></button></div>
            <input autoFocus type="text" placeholder="검색어 입력..." className="w-full px-4 py-3 bg-[#fcfaf7] dark:bg-[#3a342e] border rounded-xl mb-4" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <div className="flex-1 overflow-y-auto space-y-3">
              {searchResults.map(([date, data]) => (
                <button key={date} onClick={() => { setSelectedDate(date); setViewMode('diary'); setIsSearchOpen(false); }} className="w-full text-left p-4 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl border">
                  <div className="text-xs font-bold linen-accent mb-1">{date} ({getDayOfWeek(date)})</div>
                  <p className="text-xs text-gray-500 line-clamp-2">{data.diary || '기록 없음'}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <header className="mb-8 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold linen-accent flex items-center gap-2"><BookOpen /> Linen Diary</h1>
          <div className="flex gap-2">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-white dark:bg-[#2a2420] rounded-full border shadow-sm">{isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <button onClick={() => setIsSearchOpen(true)} className="p-2 bg-white dark:bg-[#2a2420] rounded-full border shadow-sm"><Search size={18}/></button>
            <button onClick={() => setShowPwdModal(true)} className="p-2 bg-white dark:bg-[#2a2420] rounded-full border shadow-sm"><Settings size={18}/></button>
            <button onClick={() => setIsAuthenticated(false)} className="px-3 py-1 bg-white dark:bg-[#2a2420] border rounded-full text-xs font-bold text-gray-400">잠금</button>
          </div>
        </div>
        <div className="bg-white dark:bg-[#2a2420] p-4 rounded-2xl shadow-sm border space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 flex items-center bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl px-4 py-2 border">
              <span className="flex-1 text-sm font-bold">{selectedDate} <span className="linen-accent ml-1">({getDayOfWeek(selectedDate)})</span></span>
              <CalendarRange className="w-4 h-4 linen-accent" /><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <button onClick={() => setSelectedDate(getLocalDateString())} className="px-3 py-2 bg-[#fcfaf7] dark:bg-[#3a342e] border rounded-xl text-[11px] font-bold flex items-center gap-1"><CalendarDays size={14}/> 오늘</button>
          </div>
          <div className="flex gap-2">
            {['main', 'diary', 'gallery'].map((m) => (
              <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === m ? 'linen-btn' : 'bg-[#f0ede6] dark:bg-[#3a342e] text-gray-500'}`}>
                {m === 'main' ? '투두' : m === 'diary' ? '일기' : '추억'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main>
        {viewMode === 'main' && (
          <section className="linen-card p-6 border space-y-4">
            <h3 className="font-bold linen-accent flex items-center gap-2"><CheckSquare /> 투두 리스트</h3>
            <div className="space-y-2">
              {currentData.todo.map(todo => (
                <div key={todo.id} className="flex items-center gap-3 bg-[#fcfaf7] dark:bg-[#3a342e] p-3 rounded-xl border">
                  <input type="checkbox" checked={todo.completed} onChange={() => handleTodoToggle(todo.id)} className="w-5 h-5 accent-[#8d775f]" />
                  <span className={`flex-1 text-sm ${todo.completed ? 'line-through text-gray-400' : ''}`}>{todo.text}</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" value={todo.repeatDays || ''} onChange={e => updateTodoRepeat(todo.id, parseInt(e.target.value)||0)} onKeyDown={e => e.key === 'Enter' && createFutureTodo(todo.text, todo.repeatDays||0)} placeholder="0" className="w-10 text-center text-xs bg-white dark:bg-[#1a1614] border rounded" />
                    <button onClick={() => createFutureTodo(todo.text, todo.repeatDays||0)} className="p-1 hover:text-[#8d775f]"><RefreshCw size={14}/></button>
                    <button onClick={() => deleteTodo(todo.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newTodoText} onChange={e => setNewTodoText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} placeholder="할 일 입력..." className="flex-1 px-4 py-2 bg-[#fcfaf7] dark:bg-[#3a342e] border rounded-xl text-sm" />
              <button onClick={addTodo} className="linen-btn p-2 rounded-xl"><Plus/></button>
            </div>
          </section>
        )}

        {viewMode === 'diary' && (
          <section className="linen-card p-6 border space-y-6">
            <div className="space-y-4">
              <h3 className="font-bold linen-accent flex items-center gap-2"><Smile /> 기분과 기록</h3>
              <div className="grid grid-cols-5 gap-1 bg-[#fcfaf7] dark:bg-[#3a342e] p-2 rounded-2xl border">
                {[ { id: 'happy', icon: Smile }, { id: 'excited', icon: Zap }, { id: 'neutral', icon: Meh }, { id: 'sad', icon: Frown }, { id: 'angry', icon: Angry } ].map(({ id, icon: Icon }) => (
                  <button key={id} onClick={() => setCurrentData(prev => ({ ...prev, mood: id as Mood }))} className={`flex flex-col items-center p-2 rounded-lg ${currentData.mood === id ? 'bg-white shadow-sm ring-1 ring-[#8d775f]' : 'opacity-40 grayscale'}`}>
                    <Icon className={currentData.mood === id ? 'text-[#8d775f]' : ''} />
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-gray-400">사진 ({currentData.photos?.length || 0})</span>
                <div className="flex gap-2">
                  <button onClick={() => startCamera()} className="text-[11px] font-bold text-[#8d775f] px-2 py-1 bg-[#f0ede6] rounded-md">촬영</button>
                  <label className="text-[11px] font-bold text-[#8d775f] px-2 py-1 bg-[#f0ede6] rounded-md cursor-pointer">추가<input type="file" multiple accept="image/*" onChange={handlePhotoUpload} className="hidden" /></label>
                </div>
              </div>
              {isCameraActive && (
                <div className="aspect-video bg-black rounded-2xl overflow-hidden relative">
                  <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
                  <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
                    <button onClick={stopCamera} className="p-2 bg-white/20 rounded-full text-white"><X/></button>
                    <button onClick={capturePhoto} className="p-4 bg-white rounded-full text-[#8d775f]"><Circle fill="currentColor"/></button>
                    <button onClick={() => startCamera(facingMode === 'user' ? 'environment' : 'user')} className="p-2 bg-white/20 rounded-full text-white"><RefreshCw/></button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {currentData.photos?.map((p, i) => (
                  <div key={i} className="aspect-square relative rounded-xl overflow-hidden border">
                    <img src={p} className="w-full h-full object-cover" />
                    <button onClick={() => setCurrentData(prev => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 p-1 bg-black/40 text-white rounded-full"><X size={10}/></button>
                  </div>
                ))}
              </div>
              <textarea value={currentData.diary} onChange={e => setCurrentData(prev => ({ ...prev, diary: e.target.value }))} placeholder="오늘을 기록하세요..." className="w-full h-64 p-4 bg-[#fcfaf7] dark:bg-[#3a342e] border rounded-2xl text-sm focus:outline-none focus:border-[#8d775f] resize-none" />
              <button onClick={() => { saveDataByDate(selectedDate, currentData); setViewMode('gallery'); }} className="w-full py-3 linen-btn rounded-xl font-bold">기록 저장</button>
            </div>
          </section>
        )}

        {viewMode === 'gallery' && (
          <section className="linen-card p-6 border">
            <h3 className="font-bold linen-accent flex items-center gap-2 mb-6"><Grid /> 추억 갤러리</h3>
            <div className="grid grid-cols-2 gap-4">
              {galleryItems.map(([date, data]) => (
                <div key={date} onClick={() => { setSelectedDate(date); setViewMode('diary'); }} className="group relative aspect-square bg-[#fcfaf7] rounded-xl overflow-hidden border cursor-pointer">
                  <img src={data.photos[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/80 rounded text-[9px] font-bold">{date.slice(5)}</div>
                  {data.photos.length > 1 && <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 text-white rounded text-[8px] font-bold">+{data.photos.length - 1}</div>}
                </div>
              ))}
            </div>
            {galleryItems.length === 0 && <p className="text-center py-20 text-gray-400 text-sm">기록된 추억이 없습니다.</p>}
          </section>
        )}
      </main>
      <footer className="mt-12 text-center text-[10px] text-gray-300">모든 데이터는 브라우저에만 안전하게 저장됩니다.</footer>
    </div>
  );
};

export default App;
