import { useEffect } from 'react';
import { create } from 'zustand';

export interface RefreshEntry {
  token: number;
  refresh: () => void;
  label?: string;
}

interface RefreshBusState {
  stack: RefreshEntry[];
  push: (refresh: () => void, label?: string) => number;
  pop: (token: number) => void;
  top: () => RefreshEntry | undefined;
}

let tokenCounter = 0;

export const useRefreshBusStore = create<RefreshBusState>((set, get) => ({
  stack: [],
  push: (refresh, label) => {
    const token = ++tokenCounter;
    set((s) => ({ stack: [...s.stack, { token, refresh, label }] }));
    return token;
  },
  pop: (token) => {
    set((s) => ({ stack: s.stack.filter((e) => e.token !== token) }));
  },
  top: () => {
    const stack = get().stack;
    return stack[stack.length - 1];
  },
}));

export function useActiveRefresh(refresh: () => void, label?: string): void {
  const push = useRefreshBusStore((s) => s.push);
  const pop = useRefreshBusStore((s) => s.pop);

  useEffect(() => {
    const token = push(refresh, label);
    return () => pop(token);
  }, [refresh, label, push, pop]);
}
