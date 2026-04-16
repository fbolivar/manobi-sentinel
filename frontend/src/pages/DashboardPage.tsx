import { useState } from 'react';
import { TopBar } from '../components/layout/TopBar';
import { AlertsPanel } from '../components/alerts/AlertsPanel';
import { MetricsPanel } from '../components/metrics/MetricsPanel';
import { MapView } from '../components/map/MapView';
import { BottomTimeline } from '../components/layout/BottomTimeline';
import { useAlertsSocket } from '../hooks/useAlertsSocket';

type MobileTab = 'mapa' | 'alertas' | 'metricas';

export function DashboardPage() {
  useAlertsSocket();
  const [mobileTab, setMobileTab] = useState<MobileTab>('mapa');

  return (
    <div className="h-screen flex flex-col">
      <TopBar />

      {/* Mobile tab switcher */}
      <div className="md:hidden flex border-b border-border-subtle bg-bg-surface/80 shrink-0">
        {([['mapa', 'Mapa'], ['alertas', 'Alertas'], ['metricas', 'Métricas']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setMobileTab(key)}
            className={`flex-1 py-2.5 text-xs font-mono uppercase tracking-wider transition touch-target ${
              mobileTab === key ? 'text-accent-green border-b-2 border-accent-green' : 'text-white/50'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Desktop: 3-column grid */}
      <main className="hidden md:grid flex-1 gap-2 p-2 overflow-hidden
                       grid-cols-[280px_1fr_300px] grid-rows-[1fr_100px]">
        <div className="col-span-1 row-span-1 min-h-0"><AlertsPanel /></div>
        <div className="col-span-1 row-span-1 min-h-0 relative"><MapView /></div>
        <div className="col-span-1 row-span-1 min-h-0"><MetricsPanel /></div>
        <div className="col-span-3 row-span-1"><BottomTimeline /></div>
      </main>

      {/* Mobile: tabbed panels, map full height */}
      <main className="md:hidden flex-1 overflow-hidden pb-14 relative">
        <div className={mobileTab === 'mapa' ? 'h-full' : 'hidden'}><MapView /></div>
        <div className={mobileTab === 'alertas' ? 'h-full overflow-y-auto' : 'hidden'}><AlertsPanel /></div>
        <div className={mobileTab === 'metricas' ? 'h-full overflow-y-auto' : 'hidden'}>
          <MetricsPanel />
          <BottomTimeline />
        </div>
      </main>
    </div>
  );
}
