import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Pie, Line } from 'react-chartjs-2';
import {
  ArrowRight,
  RotateCcw,
  Loader2,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { PriorityQueuePanel } from '../components/PriorityQueuePanel';
import { SeverityBadge, StatusBadge, formatDateTime } from '../components/SeverityBadge';
import { useAdminIncidents } from '../hooks/useAdminIncidents';
import { useAuth } from '../context/AuthContext';
import { computeIncidentAnalytics } from '../utils/severityClassifier';
import { isAssignmentEscalated } from '../utils/duplicateDetection';
import { EMERGENCY_CATEGORIES, INCIDENT_STATUSES, SEVERITY_LEVELS } from '../types/incident';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export function AdminDashboardPage() {
  const { admin } = useAuth();
  const { incidents: allIncidents, loading, error, refresh } = useAdminIncidents();
  const [dataMode, setDataMode] = useState<'all' | 'demo' | 'real'>('all');
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [platformStats, setPlatformStats] = useState<{
    totalCitizens: number;
    verifiedCitizens: number;
    totalVolunteers: number;
    verifiedVolunteers: number;
    availableVolunteers: number;
    activeIncidents: number;
    availableTeams: number;
    busyTeams: number;
    totalTeams: number;
    fireTeams: number;
    medicalTeams: number;
    rescueTeams: number;
    doctorsCount: number;
    hospitalsCount: number;
    clinicsCount: number;
    reliefCentresCount: number;
    sheltersCount: number;
    collegesCount: number;
    volunteerTasksTotal: number;
    volunteerTasksCompleted: number;
    volunteerTasksActive: number;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/stats?mode=${dataMode}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPlatformStats(data);
      })
      .catch(() => {});
  }, [allIncidents.length, dataMode]);

  const incidents = useMemo(() => {
    if (dataMode === 'demo') return allIncidents.filter((i) => i.isDemo);
    if (dataMode === 'real') return allIncidents.filter((i) => !i.isDemo);
    return allIncidents;
  }, [allIncidents, dataMode]);

  const summary = useMemo(() => computeIncidentAnalytics(incidents), [incidents]);
  const recentIncidents = useMemo(() => incidents.slice(0, 6), [incidents]);

  const escalatedIncidents = useMemo(
    () =>
      incidents
        .map((inc) => ({ inc, esc: isAssignmentEscalated(inc) }))
        .filter((item) => item.esc.escalated),
    [incidents]
  );

  const highPriorityIncidents = useMemo(
    () =>
      incidents.filter(
        (inc) =>
          inc.status !== 'Resolved' &&
          (inc.severity === 'Critical' || inc.severity === 'High')
      ),
    [incidents]
  );

  const mappedLocations = useMemo(
    () => incidents.filter((inc) => inc.latitude !== null && inc.longitude !== null),
    [incidents]
  );

  const timeSeriesData = useMemo(() => {
    const countsByDay = new Map<string, number>();
    const sorted = [...incidents].sort(
      (a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime()
    );
    for (const inc of sorted) {
      const dayKey = new Date(inc.reportedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      countsByDay.set(dayKey, (countsByDay.get(dayKey) || 0) + 1);
    }
    return {
      labels: Array.from(countsByDay.keys()),
      values: Array.from(countsByDay.values()),
    };
  }, [incidents]);

  const handleResetDemo = async () => {
    setResetting(true);
    setResetMessage('');
    try {
      const res = await fetch('/api/admin/reset-demo', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await refresh();
        setResetMessage('Demo records restored. Submitted citizen reports were preserved.');
      }
    } finally {
      setResetting(false);
    }
  };

  const handleAcknowledge = async (incidentId: string) => {
    setAcknowledgingId(incidentId);
    try {
      const res = await fetch(`/api/admin/incidents/${encodeURIComponent(incidentId)}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await refresh();
      }
    } finally {
      setAcknowledgingId(null);
    }
  };

  return (
    <AdminLayout title="Emergency Management Dashboard">
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#263640]">
              Welcome back, {admin?.name || 'Coordinator'}
            </h2>
            <p className="text-sm text-[#71818A] mt-0.5">
              Live overview of reported incidents, risk triage, location data, and response status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-lg border border-[#C5D2D8] bg-white p-0.5 text-xs font-semibold">
              {(['all', 'real', 'demo'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDataMode(mode)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    dataMode === mode
                      ? 'bg-[#426B80] text-white'
                      : 'text-[#71818A] hover:text-[#263640]'
                  }`}
                >
                  {mode === 'all' ? 'All Data' : mode === 'real' ? 'Real Mode' : 'DEMO Mode'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={resetting}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-[#C5D2D8] text-xs font-semibold text-[#263640] hover:bg-[#F3F7F8] disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {resetting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>Reset Demo Data</span>
            </button>
            <Link
              to="/admin/incidents"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] transition-colors whitespace-nowrap"
            >
              <span>Manage Incidents</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {dataMode === 'demo' && (
          <div className="p-3 rounded-lg bg-[#E8AD52]/15 border border-[#E8AD52]/40 text-xs font-semibold text-[#7A5011] flex items-center gap-2">
            <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>DEMO MODE ACTIVE — Showing isolated demonstration records only.</span>
          </div>
        )}

        {escalatedIncidents.length > 0 && (
          <section
            aria-label="Assignment escalation alerts"
            className="bg-white rounded-xl border border-[#E58A48] p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-[#9A4614]">
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Assignment Escalation Alerts ({escalatedIncidents.length} unaccepted past threshold)
                </span>
              </div>
            </div>
            <div className="divide-y divide-[#F3F7F8]">
              {escalatedIncidents.map(({ inc, esc }) => (
                <div
                  key={inc.incidentId}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-semibold text-[#426B80] mr-2">
                      {inc.incidentId}
                    </span>
                    <span className="font-semibold text-[#263640]">{inc.title}</span>
                    <span className="text-[#71818A] ml-2">
                      · Assigned to {inc.assignedResponderName || 'Responder'} · Pending{' '}
                      <strong className="text-[#9A4614] tabular-nums">{esc.pendingMinutes}m</strong>
                    </span>
                  </div>
                  <Link
                    to={`/admin/incidents/${encodeURIComponent(inc.incidentId)}`}
                    className="font-semibold text-[#426B80] hover:underline shrink-0"
                  >
                    Reassign / Review →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {resetMessage && (
          <div className="p-3.5 rounded-lg bg-[#E5EEE9] border border-[#22C55E]/35 text-sm text-[#15803D]">
            {resetMessage}
          </div>
        )}

        {error && (
          <div role="alert" className="p-4 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-sm text-[#B91C1C]">
            {error}
          </div>
        )}

        {/* 4 Major Statistics Cards */}
        <section aria-label="Primary incident statistics">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-[#D9E2E6] p-5">
              <p className="text-xs font-medium text-[#71818A]">Total Incidents</p>
              <p className="text-3xl font-bold text-[#263640] tabular-nums mt-2">
                {loading ? '—' : summary.total}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-[#EF4444]/40 p-5">
              <p className="text-xs font-medium text-[#B91C1C]">Critical Incidents</p>
              <p className="text-3xl font-bold text-[#EF4444] tabular-nums mt-2">
                {loading ? '—' : summary.critical}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-[#D9E2E6] p-5">
              <p className="text-xs font-medium text-[#71818A]">Pending Incidents</p>
              <p className="text-3xl font-bold text-[#854D0E] tabular-nums mt-2">
                {loading ? '—' : summary.pending}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-[#D9E2E6] p-5">
              <p className="text-xs font-medium text-[#71818A]">Resolved Incidents</p>
              <p className="text-3xl font-bold text-[#22C55E] tabular-nums mt-2">
                {loading ? '—' : summary.resolved}
              </p>
            </div>
          </div>

          {/* 3 Additional Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4 flex items-center justify-between">
              <span className="text-sm text-[#71818A]">High Risk Incidents</span>
              <span className="text-xl font-bold text-[#F97316] tabular-nums">
                {loading ? '—' : summary.high}
              </span>
            </div>
            <div className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4 flex items-center justify-between">
              <span className="text-sm text-[#71818A]">Incidents In Progress</span>
              <span className="text-xl font-bold text-[#426B80] tabular-nums">
                {loading ? '—' : summary.inProgress}
              </span>
            </div>
            <div className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4 flex items-center justify-between">
              <span className="text-sm text-[#71818A]">Newly Reported Incidents</span>
              <span className="text-xl font-bold text-[#263640] tabular-nums">
                {loading ? '—' : summary.reported}
              </span>
            </div>
          </div>

          {/* Real Database Platform Capacity Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <Link
              to="/admin/citizens"
              className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4 flex items-center justify-between hover:border-[#426B80] transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-[#71818A]">Registered Citizens</p>
                <p className="text-xs text-[#5D9678] font-medium mt-0.5">
                  {platformStats ? `${platformStats.verifiedCitizens} verified` : ''}
                </p>
              </div>
              <span className="text-2xl font-bold text-[#426B80] tabular-nums">
                {platformStats ? platformStats.totalCitizens : '—'}
              </span>
            </Link>
            <Link
              to="/admin/volunteers"
              className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4 flex items-center justify-between hover:border-[#426B80] transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-[#71818A]">Registered Volunteers</p>
                <p className="text-xs text-[#5D9678] font-medium mt-0.5">
                  {platformStats ? `${platformStats.availableVolunteers} available` : ''}
                </p>
              </div>
              <span className="text-2xl font-bold text-[#426B80] tabular-nums">
                {platformStats ? platformStats.totalVolunteers : '—'}
              </span>
            </Link>
            <div className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4 flex items-center justify-between">
              <span className="text-xs font-medium text-[#71818A]">Active Unresolved Incidents</span>
              <span className="text-2xl font-bold text-[#E58A48] tabular-nums">
                {platformStats ? platformStats.activeIncidents : '—'}
              </span>
            </div>
            <Link
              to="/admin/map"
              className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4 flex items-center justify-between hover:border-[#426B80] transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-[#71818A]">Available Response Teams</p>
                <p className="text-xs text-[#71818A] mt-0.5">
                  {platformStats
                    ? `${platformStats.busyTeams} busy · ${platformStats.totalTeams} total`
                    : ''}
                </p>
              </div>
              <span className="text-2xl font-bold text-[#5D9678] tabular-nums">
                {platformStats ? platformStats.availableTeams : '—'}
              </span>
            </Link>
          </div>

          {/* Response Teams, Medical Facilities & Volunteer Task Metrics */}
          {platformStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4">
                <p className="text-xs font-medium text-[#71818A]">Response Units by Specialty</p>
                <p className="text-sm font-bold text-[#263640] mt-1 tabular-nums">
                  {platformStats.fireTeams} Fire · {platformStats.medicalTeams} Medical · {platformStats.rescueTeams} Rescue
                </p>
                <p className="text-[11px] text-[#71818A] mt-0.5">
                  {platformStats.availableTeams} available / {platformStats.busyTeams} deployed
                </p>
              </div>
              <div className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4">
                <p className="text-xs font-medium text-[#71818A]">Medical Network</p>
                <p className="text-sm font-bold text-[#263640] mt-1 tabular-nums">
                  {platformStats.hospitalsCount} Hospitals · {platformStats.clinicsCount} Clinics · {platformStats.doctorsCount} Doctors
                </p>
                <p className="text-[11px] text-[#5D9678] mt-0.5">Active on Interactive Map</p>
              </div>
              <div className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4">
                <p className="text-xs font-medium text-[#71818A]">Relief &amp; Shelter Hubs</p>
                <p className="text-sm font-bold text-[#263640] mt-1 tabular-nums">
                  {platformStats.reliefCentresCount} Relief · {platformStats.sheltersCount} Shelters · {platformStats.collegesCount} Colleges
                </p>
                <p className="text-[11px] text-[#71818A] mt-0.5">Mapped staging &amp; evacuation zones</p>
              </div>
              <Link
                to="/volunteer"
                className="bg-white rounded-xl border border-[#D9E2E6] px-5 py-4 hover:border-[#426B80] transition-colors"
              >
                <p className="text-xs font-medium text-[#71818A]">Volunteer Support Tasks</p>
                <p className="text-sm font-bold text-[#426B80] mt-1 tabular-nums">
                  {platformStats.volunteerTasksCompleted} Completed · {platformStats.volunteerTasksActive} Active
                </p>
                <p className="text-[11px] text-[#71818A] mt-0.5">
                  of {platformStats.volunteerTasksTotal} total tasks
                </p>
              </Link>
            </div>
          )}
        </section>

        {/* Priority Queue Panel */}
        <PriorityQueuePanel incidents={incidents} onRefresh={refresh} compact />

        {/* High-Priority & Critical Incident Section */}
        {highPriorityIncidents.length > 0 && (
          <section
            aria-label="High-priority and critical incidents"
            className="bg-white rounded-xl border border-[#EF4444]/40 overflow-hidden"
          >
            <div className="px-6 py-4 bg-[#EF4444]/5 border-b border-[#EF4444]/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-[#EF4444]" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-bold text-[#263640]">
                    High-Priority & Critical Incidents ({highPriorityIncidents.length})
                  </h3>
                  <p className="text-xs text-[#71818A]">
                    Active critical and high-risk reports requiring immediate coordinator attention.
                  </p>
                </div>
              </div>
              <Link
                to="/admin/incidents"
                className="text-xs font-semibold text-[#426B80] hover:underline"
              >
                View All in Queue
              </Link>
            </div>

            <div className="divide-y divide-[#F3F7F8]">
              {highPriorityIncidents.slice(0, 4).map((inc) => (
                <div
                  key={inc.incidentId}
                  className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-[#426B80] tabular-nums">
                        {inc.incidentId}
                      </span>
                      <SeverityBadge severity={inc.severity} />
                      <StatusBadge status={inc.status} />
                      {inc.acknowledgedAt && (
                        <span className="inline-flex items-center gap-1 text-[#15803D] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Acknowledged</span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#263640] truncate">{inc.title}</p>
                    <p className="text-xs text-[#71818A] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{inc.location}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {!inc.acknowledgedAt && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(inc.incidentId)}
                        disabled={acknowledgingId === inc.incidentId}
                        className="px-3.5 py-2 rounded-lg bg-[#EF4444] text-white text-xs font-semibold hover:bg-[#DC2626] disabled:opacity-60 transition-colors whitespace-nowrap"
                      >
                        {acknowledgingId === inc.incidentId
                          ? 'Acknowledging...'
                          : 'Acknowledge & Prioritize'}
                      </button>
                    )}
                    <Link
                      to={`/admin/incidents/${encodeURIComponent(inc.incidentId)}`}
                      className="px-3.5 py-2 rounded-lg border border-[#C5D2D8] text-xs font-semibold text-[#263640] hover:bg-[#F3F7F8] whitespace-nowrap"
                    >
                      Open Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4 Interactive Charts */}
        <section aria-label="Incident charts" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4">
            <h3 className="text-base font-semibold text-[#263640]">
              Incident Category Distribution
            </h3>
            <div className="h-64">
              {incidents.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-[#71818A]">
                  No incident records available.
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
                    scales: {
                      y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    },
                  }}
                />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-4">
            <h3 className="text-base font-semibold text-[#263640]">
              Risk Severity Distribution
            </h3>
            <div className="h-64 flex items-center justify-center">
              {incidents.length === 0 ? (
                <p className="text-sm text-[#71818A]">No incident records available.</p>
              ) : (
                <Doughnut
                  data={{
                    labels: SEVERITY_LEVELS,
                    datasets: [
                      {
                        data: SEVERITY_LEVELS.map((s) => summary.bySeverity[s]),
                        backgroundColor: ['#22C55E', '#FACC15', '#F97316', '#EF4444', '#94A3B8'],
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
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
            <h3 className="text-base font-semibold text-[#263640]">
              Incident Status Overview
            </h3>
            <div className="h-64 flex items-center justify-center">
              {incidents.length === 0 ? (
                <p className="text-sm text-[#71818A]">No incident records available.</p>
              ) : (
                <Pie
                  data={{
                    labels: INCIDENT_STATUSES,
                    datasets: [
                      {
                        data: INCIDENT_STATUSES.map((st) => summary.byStatus[st]),
                        backgroundColor: ['#71818A', '#FACC15', '#426B80', '#22C55E'],
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
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
            <h3 className="text-base font-semibold text-[#263640]">Incident Reports Over Time</h3>
            <div className="h-64">
              {timeSeriesData.labels.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-[#71818A]">
                  No incident records available.
                </div>
              ) : (
                <Line
                  data={{
                    labels: timeSeriesData.labels,
                    datasets: [
                      {
                        label: 'Reported Incidents',
                        data: timeSeriesData.values,
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
                    scales: {
                      y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    },
                  }}
                />
              )}
            </div>
          </div>
        </section>

        {/* Location-Based Incident View */}
        <section className="bg-white rounded-xl border border-[#D9E2E6] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#263640]">
                Location-Based Incident View
              </h3>
              <p className="text-xs text-[#71818A] mt-0.5 tabular-nums">
                {mappedLocations.length} incident(s) with verified GPS coordinates ·{' '}
                {incidents.length - mappedLocations.length} with manual address only
              </p>
            </div>
            <Link
              to="/admin/map"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E5EEE9] text-[#263640] text-xs font-semibold hover:bg-[#D7E6DD] transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
              <span>Open Interactive Map</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mappedLocations.slice(0, 6).map((inc) => (
              <Link
                key={inc.incidentId}
                to={`/admin/incidents/${encodeURIComponent(inc.incidentId)}`}
                className="rounded-lg border border-[#D9E2E6] p-3.5 hover:border-[#426B80] transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[#426B80] tabular-nums">
                    {inc.incidentId}
                  </span>
                  <SeverityBadge severity={inc.severity} />
                </div>
                <p className="text-xs font-medium text-[#263640] truncate">{inc.location}</p>
                <p className="text-[11px] font-mono text-[#71818A] tabular-nums">
                  {inc.latitude?.toFixed(4)}, {inc.longitude?.toFixed(4)}
                  {inc.locationAccuracy ? ` (±${inc.locationAccuracy}m)` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Reports */}
        <section className="bg-white rounded-xl border border-[#D9E2E6] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D9E2E6] flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-[#263640]">Recent Incident Reports</h3>
            <Link
              to="/admin/incidents"
              className="text-sm font-medium text-[#426B80] hover:underline whitespace-nowrap"
            >
              View All Incidents
            </Link>
          </div>

          {recentIncidents.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#71818A]">
              No incidents recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#D9E2E6] bg-[#F3F7F8] text-xs font-semibold text-[#71818A]">
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Risk Level</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reported</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F7F8]">
                  {recentIncidents.map((inc) => (
                    <tr key={inc.incidentId} className="hover:bg-[#F3F7F8]/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#426B80] tabular-nums whitespace-nowrap">
                        {inc.incidentId}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#263640] max-w-[220px] truncate">
                        {inc.title}
                      </td>
                      <td className="py-3 px-4 text-[#71818A] whitespace-nowrap">{inc.category}</td>
                      <td className="py-3 px-4 text-[#71818A] max-w-[180px] truncate">
                        {inc.location}
                      </td>
                      <td className="py-3 px-4">
                        <SeverityBadge severity={inc.severity} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={inc.status} />
                      </td>
                      <td className="py-3 px-4 text-xs text-[#71818A] tabular-nums whitespace-nowrap">
                        {formatDateTime(inc.reportedAt)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/incidents/${encodeURIComponent(inc.incidentId)}`}
                          className="text-xs font-semibold text-[#426B80] hover:underline"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
