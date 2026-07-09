import { create } from 'zustand';

interface UiStore {
  /** 전체화면 감상 모드 — 켜지면 수조 UI뿐 아니라 하단 탭바까지 숨긴다(MainLayout이 읽음). */
  immersive: boolean;
  setImmersive: (v: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  immersive: false,
  setImmersive: (v) => set({ immersive: v }),
}));
