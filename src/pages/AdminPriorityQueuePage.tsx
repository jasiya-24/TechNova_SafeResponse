import { PhoneCall } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { PriorityQueuePanel } from '../components/PriorityQueuePanel';
import { useAdminIncidents } from '../hooks/useAdminIncidents';

export function AdminPriorityQueuePage() {
  const { incidents, loading, error, refresh } = useAdminIncidents();

  return (
    <AdminLayout title="Priority Queue">
      <div className="space-y-6">
        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-[#D9534F]/10 border border-[#D9534F]/30 text-sm text-[#962825]"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-[#D9E2E6] p-10 text-center text-sm text-[#71818A]">
            Loading live priority queue...
          </div>
        ) : (
          <PriorityQueuePanel incidents={incidents} onRefresh={refresh} />
        )}

        <footer className="bg-white rounded-xl border border-[#D9E2E6] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#71818A]">
          <span>
            SafeResponse is a demonstration platform. In a real emergency, contact official dispatch directly.
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#263640] tabular-nums shrink-0">
            <PhoneCall className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
            <span>Dial 112 in a real emergency</span>
          </span>
        </footer>
      </div>
    </AdminLayout>
  );
}
