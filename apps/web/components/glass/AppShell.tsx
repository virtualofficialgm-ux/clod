'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { MeshBackground } from './MeshBackground';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';

const KEY = 'parri.sidebar';

/** Каркас приложения: живой фон, сайдбар (компьютер) или таб-бар с «+» (телефон). */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(KEY) === 'collapsed');
    } catch {}
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? 'open' : 'collapsed');
      } catch {}
      return !c;
    });
  return (
    <>
      <MeshBackground />
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={clsx('pb-32 transition-[padding] duration-300 md:pb-10', collapsed ? 'md:pl-[104px]' : 'md:pl-[var(--p-sidebar-width)]')}>
        {children}
      </div>
      <TabBar />
    </>
  );
}
