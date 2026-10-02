import { MeshBackground } from './MeshBackground';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';

/** Каркас приложения: живой фон, сайдбар (веб) или таб-бар (телефон). */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MeshBackground />
      <Sidebar />
      <div className="pb-28 md:pb-10 md:pl-[var(--p-sidebar-width)]">{children}</div>
      <TabBar />
    </>
  );
}
