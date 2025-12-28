
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Lock, BookOpen, CheckSquare, Plus, Trash2, Camera, Smile, Meh, Frown, Angry, Zap, Grid, Delete, X, Circle, Loader2, RefreshCw, Settings, Download, Search, Sun, Moon, Upload, CalendarRange, Images, CalendarDays } from 'lucide-react';
import { DailyData, ViewMode, Mood, TodoItem } from './types';
import { loadDataByDate, saveDataByDate, loadAllData, getStoredPassword, saveNewPassword, saveAllData } from './utils/storage';

const App: React.FC = () => {
  // 로컬 시간 기준 YYYY-MM-DD 생성 함수
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
  const [pwdError, setPwdError] = useState('');

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

  const handleBackspace = () => {
    setPassword(prev => prev.slice(0, -1));
  };

  const handleModalKeypad = (val: string) => {
    if (pwdStep === 'verify') {
      if (pwdInput.length < 4) {
        const next = pwdInput + val;
        setPwdInput(next);
        if (next.length === 4) {
          if (next === getStoredPassword()) {
            setPwdStep('new');
            setPwdInput('');
            setPwdError('');
          } else {
            setPwdError('현재 비밀번호가 일치하지 않습니다.');
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
    setPwdError('');
  };

  const updateTodoRepeat = (id: string, days: number) => {
    setCurrentData(prev => ({
      ...prev,
      todo: prev.todo.map(t => t.id === id ? { ...t, repeatDays: days > 0 ? days : undefined } : t)
    }));
  };

  const createFutureTodo = (todoText: string, days: number) => {
    if (!days || days <= 0) {
      alert("반복할 일수를 입력해주세요.");
      return;
    }
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
    } else {
      alert(`이미 ${futureDateStr}에 동일한 할 일이 있습니다.`);
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
    const newTodo: TodoItem = { 
      id: Date.now().toString(), 
      text: newTodoText, 
      completed: false
    };
    setCurrentData(prev => ({
      ...prev,
      todo: [...prev.todo, newTodo]
    }));
    setNewTodoText('');
  };

  const deleteTodo = (id: string) => {
    setCurrentData(prev => ({
      ...prev,
      todo: prev.todo.filter(t => t.id !== id)
    }));
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
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
        const file = files[i];
        const reader = new FileReader();
        const p = new Promise<string>((resolve) => {
          reader.onloadend = async () => {
            const compressed = await compressImage(reader.result as string);
            resolve(compressed);
          };
          reader.readAsDataURL(file);
        });
        newPhotos.push(await p);
      }

      setCurrentData(prev => ({ 
        ...prev, 
        photos: [...(prev.photos || []), ...newPhotos] 
      }));
      setIsProcessingImage(false);
    }
  };

  const deletePhoto = (index: number) => {
    setCurrentData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const startCamera = async (mode?: 'user' | 'environment') => {
    setIsCameraLoading(true);
    const targetMode = mode || facingMode;
    if (videoRef.current) { videoRef.current.srcObject = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: targetMode, width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: false 
      });
      streamRef.current = stream;
      setFacingMode(targetMode);
      setIsCameraActive(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; } }, 50);
    } catch (err) {
      alert("카메라를 시작할 수 없습니다. 브라우저 설정을 확인해주세요.");
    } finally {
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current) { videoRef.current.srcObject = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    setIsCameraActive(false);
  };

  const switchCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera(newMode);
  };

  const capturePhoto = async () => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      setIsProcessingImage(true);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const compressed = await compressImage(dataUrl);
        setCurrentData(prev => ({ 
          ...prev, 
          photos: [...(prev.photos || []), compressed] 
        }));
      }
      setIsProcessingImage(false);
    }
  };

  const galleryItems = useMemo(() => {
    const allData = loadAllData();
    return Object.entries(allData)
      .filter(([_, data]) => data.photos && data.photos.length > 0)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
  }, [viewMode, currentData.photos, selectedDate]);

  const jumpToEntry = (date: string) => { 
    setSelectedDate(date); 
    setViewMode('diary'); 
    setIsSearchOpen(false);
  };

  const handleGoToToday = () => {
    const today = getLocalDateString();
    setSelectedDate(today);
  };

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
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-8">당신의 소중한 기록을 위해<br/>비밀번호를 입력해주세요.</p>
          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${password.length > i ? 'bg-[#8d775f] border-[#8d775f]' : 'border-gray-200 dark:border-gray-700'}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} onClick={() => handleKeypadClick(num.toString())} className="aspect-square flex items-center justify-center text-xl font-bold text-gray-600 dark:text-gray-300 bg-[#fcfaf7] dark:bg-[#3a342e] hover:bg-[#f0ede6] dark:hover:bg-[#4a443e] rounded-2xl border border-[#f0ede6] dark:border-[#4a443e] transition-colors active:scale-95">{num}</button>
            ))}
            <button onClick={() => setPassword('')} className="aspect-square flex items-center justify-center text-xs font-bold text-red-400 bg-[#fcfaf7] dark:bg-[#3a342e] hover:bg-[#f0ede6] dark:hover:bg-[#4a443e] rounded-2xl border border-[#f0ede6] dark:border-[#4a443e] transition-colors active:scale-95">초기화</button>
            <button onClick={() => handleKeypadClick('0')} className="aspect-square flex items-center justify-center text-xl font-bold text-gray-600 dark:text-gray-300 bg-[#fcfaf7] dark:bg-[#3a342e] hover:bg-[#f0ede6] dark:hover:bg-[#4a443e] rounded-2xl border border-[#f0ede6] dark:border-[#4a443e] transition-colors active:scale-95">0</button>
            <button onClick={handleBackspace} className="aspect-square flex items-center justify-center text-gray-400 bg-[#fcfaf7] dark:bg-[#3a342e] hover:bg-[#f0ede6] dark:hover:bg-[#4a443e] rounded-2xl border border-[#f0ede6] dark:border-[#4a443e] transition-colors active:scale-95"><Delete className="w-6 h-6" /></button>
          </div>
          {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto min-h-screen p-4 pb-24 md:p-8 animate-in transition-colors">
      {/* 설정 모달 */}
      {showPwdModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="linen-card w-full max-w-sm p-8 shadow-2xl dark:border-[#3a342e]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold linen-accent dark:text-[#b5a48d] flex items-center gap-2"><Settings className="w-5 h-5" /> 설정</h2>
              <button onClick={closePwdModal} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button onClick={handleBackup} className="flex flex-col items-center gap-2 p-3 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl border border-[#f0ede6] dark:border-[#4a443e] transition-all hover:bg-[#f0ede6] dark:hover:bg-[#4a443e]">
                <Download className="w-5 h-5 linen-accent dark:text-[#b5a48d]" />
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">데이터 백업</span>
              </button>
              <label className="flex flex-col items-center gap-2 p-3 bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl border border-[#f0ede6] dark:border-[#4a443e] transition-all hover:bg-[#f0ede6] dark:hover:bg-[#4a443e] cursor-pointer">
                <Upload className="w-5 h-5 linen-accent dark:text-[#b5a48d]" />
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">데이터 복구</span>
                <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
              </label>
            </div>

            <div className="text-center mb-8 border-t dark:border-gray-700 pt-6">
              <p className="text-xs font-bold text-[#4a4a4a] dark:text-gray-300 mb-4">{pwdStep === 'verify' ? '비밀번호 변경을 위해 현재 비번 입력' : '새로운 비밀번호 4자리 입력'}</p>
              <div className="flex justify-center gap-4 mb-6">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${(pwdStep === 'verify' ? pwdInput : newPwdInput).length > i ? 'bg-[#8d775f] border-[#8d775f]' : 'border-gray-200 dark:border-gray-700'}`} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button key={num} onClick={() => handleModalKeypad(num.toString())} className="aspect-square flex items-center justify-center text-lg font-bold text-gray-600 dark:text-gray-300 bg-[#fcfaf7] dark:bg-[#3a342e] hover:bg-[#f0ede6] dark:hover:bg-[#4a443e] rounded-xl border border-[#f0ede6] dark:border-[#4a443e] transition-all active:scale-95">{num}</button>
                ))}
                <div />
                <button onClick={() => handleModalKeypad('0')} className="aspect-square flex items-center justify-center text-lg font-bold text-gray-600 dark:text-gray-300 bg-[#fcfaf7] dark:bg-[#3a342e] hover:bg-[#f0ede6] dark:hover:bg-[#4a443e] rounded-xl border border-[#f0ede6] dark:border-[#4a443e] transition-all active:scale-95">0</button>
                <button onClick={() => pwdStep === 'verify' ? setPwdInput(prev => prev.slice(0, -1)) : setNewPwdInput(prev => prev.slice(0, -1))} className="aspect-square flex items-center justify-center text-gray-400 bg-[#fcfaf7] dark:bg-[#3a342e] hover:bg-[#f0ede6] dark:hover:bg-[#4a443e] rounded-xl border border-[#f0ede6] dark:border-[#4a443e] transition-all active:scale-95"><Delete className="w-6 h-6" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 검색 모달 */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="linen-card w-full max-w-md h-[80vh] flex flex-col p-6 shadow-2xl dark:border-[#3a342e]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold linen-accent dark:text-[#b5a48d] flex items-center gap-2"><Search className="w-5 h-5" /> 전체 기록 검색</h2>
              <button onClick={() => setIsSearchOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                autoFocus
                type="text" 
                placeholder="검색어를 입력하세요 (일기, 할 일...)" 
                className="w-full pl-10 pr-4 py-3 bg-[#fcfaf7] dark:bg-[#3a342e] border border-[#f0ede6] dark:border-[#4a443e] rounded-xl text-sm focus:outline-none focus:border-[#8d775f] dark:text-gray-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
              {searchQuery.trim() === '' ? (
                <div className="text-center py-20 text-gray-400 text-sm">찾고 싶은 내용을 입력해 보세요.</div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-20 text-gray-400 text-sm">검색 결과가 없습니다.</div>
              ) : (
                searchResults.map(([date, data]) => (
                  <button key={date} onClick={() => jumpToEntry(date)} className="w-full text-left p-4 bg-[#fcfaf7] dark:bg-[#3a342e] hover:bg-[#f0ede6] dark:hover:bg-[#4a443e] rounded-xl border border-[#f0ede6] dark:border-[#4a443e] transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold linen-accent dark:text-[#b5a48d]">{date} ({getDayOfWeek(date)})</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {data.diary || (data.todo.length > 0 ? `할 일: ${data.todo[0].text}...` : '기록 없음')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <header className="mb-8 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold linen-accent dark:text-[#b5a48d] flex items-center gap-2"><BookOpen className="w-6 h-6" /> Linen Diary</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-gray-400 hover:text-[#8d775f] bg-white dark:bg-[#2a2420] rounded-full shadow-sm border border-[#edeae0] dark:border-[#3a342e] transition-all">
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={() => setIsSearchOpen(true)} className="p-2 text-gray-400 hover:text-[#8d775f] bg-white dark:bg-[#2a2420] rounded-full shadow-sm border border-[#edeae0] dark:border-[#3a342e] transition-all">
              <Search className="w-4 h-4" />
            </button>
            <button onClick={() => setShowPwdModal(true)} className="p-2 text-gray-400 hover:text-[#8d775f] bg-white dark:bg-[#2a2420] rounded-full shadow-sm border border-[#edeae0] dark:border-[#3a342e] transition-all">
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={() => setIsAuthenticated(false)} className="text-xs font-bold text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-full bg-white dark:bg-[#2a2420] shadow-sm border border-[#edeae0] dark:border-[#3a342e] transition-all">잠금</button>
          </div>
        </div>

        <div className="flex flex-col gap-4 bg-white dark:bg-[#2a2420] p-4 rounded-2xl shadow-sm border border-[#edeae0] dark:border-[#3a342e]">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1 flex items-center bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl px-4 py-2 border border-[#f0ede6] dark:border-[#4a443e]">
              <div className="flex-1 text-sm font-bold text-[#4a4a4a] dark:text-gray-200">{selectedDate} <span className="linen-accent dark:text-[#b5a48d] ml-1">({getDayOfWeek(selectedDate)})</span></div>
              <div className="flex items-center gap-2 relative">
                <CalendarRange className="w-4 h-4 linen-accent dark:text-[#b5a48d]" />
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
            </div>
            <button onClick={handleGoToToday} className="px-3 py-2 bg-[#fcfaf7] dark:bg-[#3a342e] border border-[#f0ede6] dark:border-[#4a443e] rounded-xl text-[11px] font-bold text-[#8d775f] dark:text-[#b5a48d] flex items-center gap-1 hover:bg-[#f0ede6] dark:hover:bg-[#4a443e] transition-all">
              <CalendarDays className="w-3.5 h-3.5" /> 오늘
            </button>
          </div>
          <div className="flex gap-2 w-full overflow-x-auto no-scrollbar">
            <button onClick={() => setViewMode('main')} className={`flex-1 min-w-[80px] px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'main' ? 'linen-btn' : 'bg-[#f0ede6] dark:bg-[#3a342e] text-gray-500'}`}><CheckSquare className="w-4 h-4" /> 할 일</button>
            <button onClick={() => setViewMode('diary')} className={`flex-1 min-w-[80px] px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'diary' ? 'linen-btn' : 'bg-[#f0ede6] dark:bg-[#3a342e] text-gray-500'}`}><BookOpen className="w-4 h-4" /> 일기</button>
            <button onClick={() => setViewMode('gallery')} className={`flex-1 min-w-[80px] px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'gallery' ? 'linen-btn' : 'bg-[#f0ede6] dark:bg-[#3a342e] text-gray-500'}`}><Grid className="w-4 h-4" /> 갤러리</button>
          </div>
        </div>
      </header>

      <main className="space-y-6">
        {viewMode === 'main' && (
          <section className="linen-card p-6 border dark:border-[#3a342e]">
            <h3 className="font-bold text-[#8d775f] dark:text-[#b5a48d] flex items-center gap-2 mb-4"><CheckSquare className="w-5 h-5" /> 투두 리스트</h3>
            <div className="space-y-3 mb-6">
              {currentData.todo.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">오늘은 어떤 계획이 있나요?</p>
              ) : (
                currentData.todo.map(todo => (
                  <div key={todo.id} className="group flex items-center gap-3 bg-[#fcfaf7] dark:bg-[#3a342e] p-3 rounded-xl border border-[#f0ede6] dark:border-[#4a443e]">
                    <input type="checkbox" checked={todo.completed} onChange={() => handleTodoToggle(todo.id)} className="w-5 h-5 rounded-md border-2 border-[#8d775f] dark:border-[#b5a48d] text-[#8d775f] focus:ring-[#8d775f] accent-[#8d775f]" />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm block truncate ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>{todo.text}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          min="1"
                          value={todo.repeatDays || ''}
                          onChange={(e) => updateTodoRepeat(todo.id, parseInt(e.target.value) || 0)}
                          onKeyDown={(e) => { if (e.key === 'Enter') createFutureTodo(todo.text, todo.repeatDays || 0); }}
                          placeholder="0"
                          className="w-10 px-1 py-1 text-center bg-white dark:bg-[#2a2420] border border-[#f0ede6] dark:border-[#4a443e] rounded-md text-[10px] font-bold text-[#8d775f] dark:text-[#b5a48d] focus:outline-none focus:border-[#8d775f]"
                        />
                        <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap">일 뒤</span>
                        <button 
                          onClick={() => createFutureTodo(todo.text, todo.repeatDays || 0)}
                          className="p-1.5 bg-[#f0ede6] dark:bg-[#4a443e] text-[#8d775f] dark:text-[#b5a48d] rounded-md hover:bg-[#8d775f] dark:hover:bg-[#8d775f] hover:text-white transition-all active:scale-95"
                          title="미래 날짜에 자동 생성"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                      <button onClick={() => deleteTodo(todo.id)} className="text-gray-300 hover:text-red-400 transition-all ml-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="할 일을 입력하세요" 
                className="flex-1 px-4 py-2 bg-[#fcfaf7] dark:bg-[#3a342e] border border-[#f0ede6] dark:border-[#4a443e] rounded-xl text-sm dark:text-gray-200 focus:outline-none focus:border-[#8d775f]" 
                onKeyDown={(e) => { if (e.key === 'Enter') { addTodo(); } }} 
              />
              <button onClick={addTodo} className="linen-btn p-2 rounded-xl shrink-0"><Plus className="w-5 h-5" /></button>
            </div>
          </section>
        )}

        {viewMode === 'diary' && (
          <section className="linen-card p-6 border dark:border-[#3a342e] space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <h3 className="font-bold text-[#8d775f] dark:text-[#b5a48d] flex items-center gap-2"><Smile className="w-5 h-5" /> 오늘의 기분</h3>
                <div className="grid grid-cols-5 gap-1 bg-[#fcfaf7] dark:bg-[#3a342e] p-3 rounded-2xl border border-[#f0ede6] dark:border-[#4a443e] min-h-[100px] items-center">
                  {[ { id: 'happy', icon: Smile, label: '행복' }, { id: 'excited', icon: Zap, label: '기대' }, { id: 'neutral', icon: Meh, label: '평온' }, { id: 'sad', icon: Frown, label: '슬픔' }, { id: 'angry', icon: Angry, label: '화남' } ].map(({ id, icon: Icon, label }) => (
                    <button key={id} onClick={() => setCurrentData(prev => ({ ...prev, mood: id as Mood }))} className={`flex flex-col items-center gap-1 p-1 rounded-lg transition-all ${currentData.mood === id ? 'bg-white dark:bg-[#2a2420] shadow-sm ring-1 ring-[#8d775f] scale-105' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`}>
                      <Icon className={`w-6 h-6 md:w-7 md:h-7 ${currentData.mood === id ? 'text-[#8d775f] dark:text-[#b5a48d]' : 'text-gray-600'}`} />
                      <span className="text-[9px] font-bold text-gray-500">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-[#8d775f] dark:text-[#b5a48d] flex items-center gap-2"><Camera className="w-5 h-5" /> 오늘의 기록 ({currentData.photos?.length || 0}장)</h3>
                  <div className="flex gap-2">
                    <button onClick={() => startCamera()} className="text-[11px] text-[#8d775f] dark:text-[#b5a48d] font-bold bg-[#f0ede6] dark:bg-[#3a342e] px-2 py-1 rounded-md transition-colors" disabled={isProcessingImage || isCameraActive || isCameraLoading}>
                      {isCameraLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : '카메라 촬영'}
                    </button>
                    <label className="cursor-pointer text-[11px] text-[#8d775f] dark:text-[#b5a48d] font-bold bg-[#f0ede6] dark:bg-[#3a342e] px-2 py-1 rounded-md transition-colors">
                      사진 추가
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoUpload} disabled={isProcessingImage || isCameraActive} />
                    </label>
                  </div>
                </div>

                {isCameraActive && (
                  <div className="aspect-[16/10] w-full bg-black rounded-2xl overflow-hidden relative mb-4">
                    <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-6 z-20">
                      <button onClick={stopCamera} className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white"><X className="w-5 h-5" /></button>
                      <button onClick={capturePhoto} className="p-4 bg-white rounded-full text-[#8d775f] shadow-lg active:scale-90 transition-transform"><Circle className="w-10 h-10 fill-current" /></button>
                      <button onClick={switchCamera} className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white"><RefreshCw className="w-5 h-5" /></button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {currentData.photos?.map((photo, index) => (
                    <div key={index} className="aspect-square relative group bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl overflow-hidden border border-[#f0ede6] dark:border-[#4a443e]">
                      <img src={photo} alt={`Record ${index}`} className="w-full h-full object-cover" />
                      <button onClick={() => deletePhoto(index)} className="absolute top-2 right-2 p-1.5 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {!isCameraActive && (!currentData.photos || currentData.photos.length === 0) && (
                    <div className="col-span-full aspect-[16/6] bg-[#fcfaf7] dark:bg-[#3a342e] rounded-2xl flex flex-col items-center justify-center border border-dashed border-[#8d775f]/30">
                      <Images className="w-8 h-8 text-[#8d775f]/20 mb-2" />
                      <p className="text-[11px] font-bold text-gray-400">사진을 추가하여 오늘을 기록하세요</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-[#8d775f] dark:text-[#b5a48d] flex items-center gap-2"><BookOpen className="w-5 h-5" /> 오늘의 일기</h3>
              <textarea value={currentData.diary} onChange={(e) => setCurrentData(prev => ({ ...prev, diary: e.target.value }))} placeholder="오늘 하루는 어땠나요?" className="w-full h-72 px-5 py-5 bg-[#fcfaf7] dark:bg-[#3a342e] border border-[#f0ede6] dark:border-[#4a443e] rounded-2xl text-sm dark:text-gray-200 focus:outline-none focus:border-[#8d775f] resize-none leading-relaxed" />
            </div>
            <div className="flex justify-end pt-2"><button onClick={() => { saveDataByDate(selectedDate, currentData); setViewMode('gallery'); }} className="px-8 py-3 rounded-xl linen-btn font-bold shadow-md text-sm">기록 완료</button></div>
          </section>
        )}

        {viewMode === 'gallery' && (
          <section className="linen-card p-6 border dark:border-[#3a342e]">
            <h3 className="font-bold text-[#8d775f] dark:text-[#b5a48d] flex items-center gap-2 mb-6"><Grid className="w-5 h-5" /> 추억 갤러리</h3>
            {galleryItems.length === 0 ? (
              <div className="text-center py-20 text-gray-400">사진 기록이 없습니다.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {galleryItems.map(([date, data]) => (
                  <div key={date} onClick={() => jumpToEntry(date)} className="group relative aspect-square bg-[#fcfaf7] dark:bg-[#3a342e] rounded-xl overflow-hidden cursor-pointer border border-[#f0ede6] dark:border-[#4a443e]">
                    <img src={data.photos[0]} alt={date} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/80 dark:bg-black/60 backdrop-blur-sm rounded-md text-[9px] font-bold linen-accent dark:text-[#b5a48d]">{date.slice(5)} ({getDayOfWeek(date)})</div>
                    {data.photos.length > 1 && (
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 text-white rounded text-[8px] font-bold">+{data.photos.length - 1}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="mt-12 text-center text-xs text-gray-400">&copy; 2024 Soft Linen Diary. All records are stored locally.</footer>
    </div>
  );
};
