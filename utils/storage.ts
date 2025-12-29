
import { DailyData, AppState } from '../types';

const STORAGE_KEY = 'linen_diary_data';
const PWD_KEY = 'linen_diary_pwd';

export const getInitialDailyData = (): DailyData => ({
  todo: [],
  diary: '',
  mood: '',
  photos: [],
});

export const loadAllData = (): AppState => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : {};
};

export const loadDataByDate = (date: string): DailyData => {
  const allData = loadAllData();
  const data = allData[date];
  
  // 하위 호환성 유지: 기존 photo(string)가 있다면 photos(array)로 자동 변환
  if (data && (data as any).photo && !data.photos) {
    return {
      ...data,
      photos: [(data as any).photo],
      todo: data.todo || [],
      diary: data.diary || '',
      mood: data.mood || '',
    };
  }

  return data || getInitialDailyData();
};

export const saveDataByDate = (date: string, dailyData: DailyData) => {
  const allData = loadAllData();
  allData[date] = dailyData;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
};

export const saveAllData = (data: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const getStoredPassword = (): string => {
  return localStorage.getItem(PWD_KEY) || '0000';
};

export const saveNewPassword = (newPwd: string) => {
  localStorage.setItem(PWD_KEY, newPwd);
};
