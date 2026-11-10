import { useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Download, X, Layers } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminIncidents } from '../hooks/useAdminIncidents';
import { computeIncidentAnalytics, incidentsToCsv } from '../utils/severityClassifier';
import { computePerformanceMetrics } from '../utils/duplicateDetection';
import {
  EMERGENCY_CATEGORIES,
  INCIDENT_STATUSES,
  SEVERITY_LEVELS,
  type EmergencyCategory,
  type SeverityLevel,
} from '../types/incident';

export function AdminAnalyticsPage() {
  const { incidents, loading } = useAdminIncidents();

  const [dataMode, setDataMode] = useState<'all' | 'real' | 'demo'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'All' | EmergencyCategory>('All');
  const [severityFilter, setSeverityFilter] = useState<'All' | SeverityLevel>('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      if (dataMode === 'demo' && !inc.isDemo) return false;
      if (dataMode === 'real' && inc.isDemo) return false;
      if (categoryFilter !== 'All' && inc.category !== categoryFilter) return false;
      if (severityFilter !== 'All' && inc.severity !== severityFilter) return false;
      const day = new Date(inc.reportedAt).toISOString().slice(0, 10);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return true;
    });
  }, [incidents, dataMode, categoryFilter, severityFilter, fromDate, toDate]);

  const summary = useMemo(() => computeIncidentAnalytics(filtered), [filtered]);
  const performance = useMemo(() => computePerformanceMetrics(filtered), [filtered]);
  const teamWorkload = useMemo(() => {
    const counts = new Map<string, number>();
    for (const inc of filtered) {
      if (inc.assignedResponderName) {
        counts.set(inc.assignedResponderName, (counts.get(inc.assignedResponderName) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([responder, count]) => ({ responder, count }));
  }, [filtered]);

  const dailyTrends = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime()
    );
    for (const inc of sorted) {
      const key = new Date(inc.reportedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      map.set(key, (map.get(key) || 0) + 1);
    }
    return {
      labels: Array.from(map.keys()),
      values: Array.from(map.values()),
    };
  }, [filtered]);

  const handleExportCsv = () => {
    const csv = incidentsToCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `saferesponse-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatResolutionTime = (minutes: number | null) => {
    if (minutes === null) return 'N/A (No resolved timestamps)';
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  return (
    <AdminLayout title="Analytics & Reports">
      <div className="space-y-6">
        {/* Mode Isolation, Category, Priority & Date Filters */}
        <div className="bg-white rounded-xl border border-[#D9E2E6] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-[#C5D2D8] bg-[#F3F7F8] p-0.5 text-xs font-semibold">
              {(['all', 'real', 'demo'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDataMode(mode)}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    dataMode === mode
                      ? 'bg-[#426B80] text-white'
                      : 'text-[#71818A] hover:text-[#263640]'
                  }`}
                >
                  {mode === 'all' ? 'All Data' : mode === 'real' ? 'Real Mode Only' : 'DEMO Mode Only'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>

          {dataMode === 'demo' && (
            <div className="p-2.5 rounded-lg bg-[#E8AD52]/15 border border-[#E8AD52]/40 text-xs font-semibold text-[#7A5011] flex items-center gap-2">
              <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>DEMO ANALYTICS — Isolated from live citizen reports.</span>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label htmlFor="analytics-category" className="block text-xs font-semibold text-[#71818A]">
                Category
              </label>
              <select
                id="analytics-category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'All' | EmergencyCategory)}
                className="rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640]"
              >
                <option value="All">All Categories</option>
                {EMERGENCY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="analytics-priority" className="block text-xs font-semibold text-[#71818A]">
                Priority / Severity
              </label>
              <select
                id="analytics-priority"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as 'All' | SeverityLevel)}
                className="rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640]"
              >
                <option value="All">All Priorities</option>
                {SEVERITY_LEVELS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="analytics-from" className="block text-xs font-semibold text-[#71818A]">
                From Date
              </label>
              <input
                id="analytics-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="analytics-to" className="block text-xs font-semibold text-[#71818A]">
                To Date
              </label>
              <input
                id="analytics-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
              />
            </div>
            {(fromDate || toDate || categoryFilter !== 'All' || severityFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setCategoryFilter('All');
                  setSeverityFilter('All');
                }}
                className="inline-flex items-center gap-1 py-2 text-xs font-semibold text-[#426B80] hover:underline"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5">
            <p className="text-xs font-medium text-[#71818A]">Filtered Incidents</p>
            <p className="text-2xl font-bold text-[#263640] tabular-nums mt-1.5">
              {loading ? '—' : summary.total}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5">
            <p className="text-xs font-medium text-[#71818A]">Completed / Resolved</p>
            <p className="text-2xl font-bold text-[#5D9678] tabular-nums mt-1.5">
              {loading ? '—' : performance.completedCount}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5">
            <p className="text-xs font-medium text-[#71818A]">Pending / Active</p>
            <p className="text-2xl font-bold text-[#E58A48] tabular-nums mt-1.5">
              {loading ? '—' : performance.pendingCount}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5">
            <p className="text-xs font-medium text-[#71818A]">
              Avg. Response Duration
            </p>
            <p className="text-2xl font-bold text-[#426B80] tabular-nums mt-1.5">
              {loading ? '—' : formatResolutionTime(performance.avgResponseMinutes)}
            </p>
          </div>
        </div>

        {/* Emergency Performance Analytics (Calculated from actual timestamps) */}
        <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#263640]">
              Emergency Performance & Response Timelines
            </h2>
            <span className="text-xs text-[#71818A]">Computed from actual incident timestamps</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F3F7F8] rounded-xl p-4">
              <p className="text-xs text-[#71818A]">Avg. Verification Time</p>
              <p className="text-xl font-bold text-[#263640] tabular-nums mt-1">
                {formatResolutionTime(performance.avgVerificationMinutes)}
              </p>
            </div>
            <div className="bg-[#F3F7F8] rounded-xl p-4">
              <p className="text-xs text-[#71818A]">Avg. Assignment Time</p>
              <p className="text-xl font-bold text-[#263640] tabular-nums mt-1">
                {formatResolutionTime(performance.avgAssignmentMinutes)}
              </p>
            </div>
            <div className="bg-[#F3F7F8] rounded-xl p-4">
              <p className="text-xs text-[#71818A]">Avg. Acceptance Time</p>
              <p className="text-xl font-bold text-[#263640] tabular-nums mt-1">
                {formatResolutionTime(performance.avgAcceptanceMinutes)}
              </p>
            </div>
          </div>

          {teamWorkload.length > 0 && (
            <div className="pt-2 border-t border-[#F3F7F8]">
              <p className="text-xs font-semibold text-[#71818A] mb-2">Team & Responder Workload</p>
              <div className="flex flex-wrap gap-2">
                {teamWorkload.map((row) => (
                  <div
                    key={row.responder}
                    className="px-3 py-1.5 rounded-lg bg-[#F3F7F8] border border-[#D9E2E6] text-xs font-medium text-[#263640]"
                  >
                    {row.responder}: <strong className="tabular-nums">{row.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#263640]">Incident Trends Over Time</h2>
            <div className="h-64">
              {dailyTrends.labels.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-[#71818A]">
                  No data for selected date range.
                </div>
              ) : (
                <Line
                  data={{
                    labels: dailyTrends.labels,
                    datasets: [
                      {
                        label: 'Incidents',
                        data: dailyTrends.values,
                        borderColor: '#426B80',
                        backgroundColor: 'rgba(66, 107, 128, 0.12)',
                        fill: true,
                        tension: 0.25,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                  }}
                />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#263640]">Category Distribution</h2>
            <div className="h-64">
              {filtered.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-[#71818A]">
                  No data for selected date range.
                </div>
              ) : (
                <Bar
                  data={{
                    labels: EMERGENCY_CATEGORIES,
                    datasets: [
                      {
                        label: 'Incidents',
                        data: EMERGENCY_CATEGORIES.map((c) => summary.byCategory[c]),
                        backgroundColor: '#426B80',
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                  }}
                />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#263640]">Severity Distribution</h2>
            <div className="h-64 flex items-center justify-center">
              {filtered.length === 0 ? (
                <p className="text-sm text-[#71818A]">No data for selected date range.</p>
              ) : (
                <Doughnut
                  data={{
                    labels: SEVERITY_LEVELS,
                    datasets: [
                      {
                        data: SEVERITY_LEVELS.map((s) => summary.bySeverity[s]),
                        backgroundColor: ['#22C55E', '#FACC15', '#F97316', '#EF4444', '#94A3B8'],
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } },
                  }}
                />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#263640]">Status Breakdown</h2>
            <div className="h-64">
              {filtered.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-[#71818A]">
                  No data for selected date range.
                </div>
              ) : (
                <Bar
                  data={{
                    labels: INCIDENT_STATUSES,
                    datasets: [
                      {
                        label: 'Count',
                        data: INCIDENT_STATUSES.map((st) => summary.byStatus[st]),
                        backgroundColor: ['#71818A', '#E8AD52', '#426B80', '#5D9678'],
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
