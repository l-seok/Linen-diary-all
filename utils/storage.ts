export type Mood = 'happy' | 'neutral' | 'sad' | 'angry' | 'excited' | '';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  repeatDays?: number; // 반복 주기 (일 단위)
}

export interface DailyData {
  todo: TodoItem[];
  diary: string;
  mood: Mood;
  photos: string[]; // Base64 strings array
}

export interface AppState {
  [date: string]: DailyData;
}

export type ViewMode = 'main' | 'diary' | 'gallery';