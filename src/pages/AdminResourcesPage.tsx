import React, { useEffect, useState, useCallback } from 'react';
import { Package, ArrowRightLeft, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { formatDateTime } from '../components/SeverityBadge';
import type { EmergencyResource, IncidentRecord, ResourceStatus } from '../types/incident';

export function AdminResourcesPage() {
  const [resources, setResources] = useState<EmergencyResource[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'All' | ResourceStatus>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Allocation inputs keyed by resource id
  const [targetIncident, setTargetIncident] = useState<Record<string, string>>({});
  const [targetTeam, setTargetTeam] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resRes, incRes] = await Promise.all([
        fetch('/api/admin/resources', { credentials: 'include' }),
        fetch('/api/admin/incidents', { credentials: 'include' }),
      ]);
      if (resRes.ok) {
        const data = (await resRes.json()) as { resources: EmergencyResource[] };
        setResources(data.resources);
      }
      if (incRes.ok) {
        const data = (await incRes.json()) as { incidents: IncidentRecord[] };
        setIncidents(data.incidents.filter((i) => i.status !== 'Resolved'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAllocate = async (resourceId: string) => {
    const incidentId = targetIncident[resourceId] || incidents[0]?.incidentId || '';
    const team = (targetTeam[resourceId] || '').trim() || 'Primary Response Team';
    if (!incidentId) {
      setError('Select an active Incident ID before allocating.');
      return;
    }
    setError('');
    setNotice('');
    setBusyId(resourceId);
    try {
      const res = await fetch(`/api/admin/resources/${encodeURIComponent(resourceId)}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ incidentId, team }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Unable to allocate resource.');
        return;
      }
      setNotice(`Resource ${resourceId} allocated to ${incidentId} (${team}).`);
      await loadData();
    } finally {
      setBusyId(null);
    }
  };

  const handleReturn = async (resourceId: string) => {
    setError('');
    setNotice('');
    setBusyId(resourceId);
    try {
      const res = await fetch(`/api/admin/resources/${encodeURIComponent(resourceId)}/return`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setNotice(`Resource ${resourceId} marked returned and available.`);
        await loadData();
      }
    } finally {
      setBusyId(null);
    }
  };

  const filtered =
    statusFilter === 'All' ? resources : resources.filter((r) => r.status === statusFilter);

  const counts = {
    available: resources.filter((r) => r.status === 'Available').length,
    allocated: resources.filter((r) => r.status === 'Allocated').length,
    unavailable: resources.filter((r) => r.status === 'Unavailable').length,
  };

  return (
    <AdminLayout title="Emergency Resource Management">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-[#D9E2E6] p-5">
            <p className="text-xs font-medium text-[#71818A]">Available Inventory</p>
            <p className="text-2xl font-bold text-[#2E5A44] tabular-nums mt-1">{counts.available}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#D9E2E6] p-5">
            <p className="text-xs font-medium text-[#71818A]">Allocated to Incidents</p>
            <p className="text-2xl font-bold text-[#426B80] tabular-nums mt-1">{counts.allocated}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#D9E2E6] p-5">
            <p className="text-xs font-medium text-[#71818A]">Unavailable / Maintenance</p>
            <p className="text-2xl font-bold text-[#962825] tabular-nums mt-1">{counts.unavailable}</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['All', 'Available', 'Allocated', 'Unavailable'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  statusFilter === status
                    ? 'bg-[#426B80] text-white border-[#426B80]'
                    : 'bg-white text-[#263640] border-[#D9E2E6] hover:bg-[#F3F7F8]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#71818A]">
            Showing actual inventory records ({filtered.length} items)
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-[#D9534F]/10 border border-[#D9534F]/30 text-sm text-[#962825] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="p-3.5 rounded-xl bg-[#E5EEE9] border border-[#5D9678]/40 text-sm text-[#2E5A44] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-[#D9E2E6] p-10 text-center text-sm text-[#71818A]">
            <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" aria-hidden="true" />
            Loading resource inventory...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((res) => (
              <div
                key={res.id}
                className="bg-white rounded-2xl border border-[#D9E2E6] p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Package className="w-5 h-5 text-[#426B80] shrink-0" aria-hidden="true" />
                      <div>
                        <h3 className="text-base font-bold text-[#263640]">{res.name}</h3>
                        <p className="text-xs text-[#71818A]">
                          <span className="font-mono">{res.id}</span> · {res.category} ·{' '}
                          <span className="tabular-nums">
                            {res.quantity} {res.unit}
                          </span>
                          {res.isDemo && ' · DEMO'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                        res.status === 'Available'
                          ? 'bg-[#E5EEE9] text-[#2E5A44] border-[#5D9678]/30'
                          : res.status === 'Allocated'
                          ? 'bg-[#426B80]/10 text-[#426B80] border-[#426B80]/30'
                          : 'bg-[#D9534F]/10 text-[#962825] border-[#D9534F]/30'
                      }`}
                    >
                      {res.status}
                    </span>
                  </div>

                  {res.status === 'Allocated' && (
                    <div className="bg-[#F3F7F8] rounded-xl p-3 text-xs space-y-1">
                      <p className="text-[#263640]">
                        <strong>Incident:</strong>{' '}
                        <span className="font-mono text-[#426B80]">{res.allocatedIncidentId}</span>
                      </p>
                      <p className="text-[#263640]">
                        <strong>Team:</strong> {res.allocatedTeam}
                      </p>
                      {res.allocatedAt && (
                        <p className="text-[#71818A] tabular-nums">
                          Allocated: {formatDateTime(res.allocatedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  {res.status === 'Available' && res.returnedAt && (
                    <p className="text-xs text-[#71818A] tabular-nums">
                      Last returned: {formatDateTime(res.returnedAt)}
                    </p>
                  )}
                </div>

                {res.status === 'Available' && (
                  <div className="pt-3 border-t border-[#F3F7F8] grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      aria-label={`Select incident for ${res.name}`}
                      value={targetIncident[res.id] || incidents[0]?.incidentId || ''}
                      onChange={(e) =>
                        setTargetIncident((prev) => ({ ...prev, [res.id]: e.target.value }))
                      }
                      className="rounded-lg border border-[#C5D2D8] bg-white px-2.5 py-2 text-xs text-[#263640]"
                    >
                      {incidents.map((inc) => (
                        <option key={inc.incidentId} value={inc.incidentId}>
                          {inc.incidentId} ({inc.category})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={targetTeam[res.id] || ''}
                      onChange={(e) =>
                        setTargetTeam((prev) => ({ ...prev, [res.id]: e.target.value }))
                      }
                      placeholder="Response Team name"
                      className="rounded-lg border border-[#C5D2D8] px-2.5 py-2 text-xs text-[#263640]"
                    />
                    <button
                      type="button"
                      disabled={busyId === res.id || incidents.length === 0}
                      onClick={() => handleAllocate(res.id)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] disabled:opacity-60"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Allocate</span>
                    </button>
                  </div>
                )}

                {res.status === 'Allocated' && (
                  <div className="pt-3 border-t border-[#F3F7F8] flex justify-end">
                    <button
                      type="button"
                      disabled={busyId === res.id}
                      onClick={() => handleReturn(res.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#5D9678] text-[#2E5A44] text-xs font-semibold hover:bg-[#E5EEE9] disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Mark Returned</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
