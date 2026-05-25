import { create } from 'zustand';

export type ModalTone = 'default' | 'danger' | 'info';

export interface ModalOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ModalTone;
  emoji?: string;
}

type Variant = 'alert' | 'confirm';

interface ActiveModal extends ModalOptions {
  id: number;
  variant: Variant;
  resolve: (ok: boolean) => void;
}

interface ModalStore {
  queue: ActiveModal[];
  alert: (opts: ModalOptions | string) => Promise<void>;
  confirm: (opts: ModalOptions | string) => Promise<boolean>;
  resolveTop: (ok: boolean) => void;
}

let nextId = 1;

const toOpts = (input: ModalOptions | string): ModalOptions =>
  typeof input === 'string' ? { message: input } : input;

export const useModalStore = create<ModalStore>((set, get) => ({
  queue: [],

  alert: (input) => {
    const opts = toOpts(input);
    return new Promise<void>((resolve) => {
      const entry: ActiveModal = {
        ...opts,
        id: nextId++,
        variant: 'alert',
        resolve: () => resolve(),
      };
      set({ queue: [...get().queue, entry] });
    });
  },

  confirm: (input) => {
    const opts = toOpts(input);
    return new Promise<boolean>((resolve) => {
      const entry: ActiveModal = {
        ...opts,
        id: nextId++,
        variant: 'confirm',
        resolve,
      };
      set({ queue: [...get().queue, entry] });
    });
  },

  resolveTop: (ok) => {
    const [head, ...rest] = get().queue;
    if (!head) return;
    head.resolve(ok);
    set({ queue: rest });
  },
}));
