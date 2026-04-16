import { TopBar } from '../components/layout/TopBar';
import { AlertsPanel } from '../components/alerts/AlertsPanel';
import { MetricsPanel } from '../components/metrics/MetricsPanel';
import { MapView } from '../components/map/MapView';
import { BottomTimeline } from '../components/layout/BottomTimeline';
import { useAlertsSocket } from '../hooks/useAlertsSocket';

export function DashboardPage() {
  useAlertsSocket();

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 grid gap-2 p-2 overflow-hidden
                       grid-cols-1 grid-rows-[1fr_auto]
                       md:grid-cols-[280px_1fr_300px] md:grid-rows-[1fr_100px]">
        <div className="md:col-span-1 md:row-span-1 min-h-0 hidden md:block"><AlertsPanel /></div>
        <div className="md:col-span-1 md:row-span-1 min-h-0 relative"><MapView /></div>
        <div className="md:col-span-1 md:row-span-1 min-h-0 hidden md:block"><MetricsPanel /></div>

        <div className="md:hidden min-h-0"><AlertsPanel /></div>

        <div className="md:col-span-3 md:row-span-1"><BottomTimeline /></div>
      </main>
    </div>
  );
}
