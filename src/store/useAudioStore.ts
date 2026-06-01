import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setBgmEnabled, setSfxEnabled } from '@/services/audio';

interface AudioState {
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  setBgm: (v: boolean) => void;
  setSfx: (v: boolean) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      bgmEnabled: true,
      sfxEnabled: true,
      setBgm: (v) => {
        setBgmEnabled(v);
        set({ bgmEnabled: v });
      },
      setSfx: (v) => {
        setSfxEnabled(v);
        set({ sfxEnabled: v });
      },
    }),
    {
      name: 'aquaworld:audio',
      onRehydrateStorage: () => (state) => {
        if (state) {
          setBgmEnabled(state.bgmEnabled);
          setSfxEnabled(state.sfxEnabled);
        }
      },
    },
  ),
);
