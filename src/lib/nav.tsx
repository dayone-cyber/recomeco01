import { createContext, useContext, useState, type ReactNode } from 'react';

export type Tab = 'today' | 'journey' | 'sos' | 'progress';
export interface Overlay {
  name: string;
  params?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface Nav {
  tab: Tab;
  stack: Overlay[];
  setTab: (t: Tab) => void;
  push: (name: string, params?: Overlay['params']) => void;
  replace: (name: string, params?: Overlay['params']) => void;
  pop: () => void;
  home: () => void;
  toast: string | null;
  say: (msg: string) => void;
}

const Ctx = createContext<Nav>(null as unknown as Nav);
export const useNav = () => useContext(Ctx);

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('today');
  const [stack, setStack] = useState<Overlay[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const nav: Nav = {
    tab,
    stack,
    setTab: (t) => {
      setStack([]);
      setTabState(t);
    },
    push: (name, params) => setStack((s) => [...s, { name, params }]),
    replace: (name, params) => setStack((s) => [...s.slice(0, -1), { name, params }]),
    pop: () => setStack((s) => s.slice(0, -1)),
    home: () => {
      setStack([]);
      setTabState('today');
    },
    toast,
    say: (msg) => {
      setToast(msg);
      setTimeout(() => setToast(null), 2600);
    },
  };
  return <Ctx.Provider value={nav}>{children}</Ctx.Provider>;
}
