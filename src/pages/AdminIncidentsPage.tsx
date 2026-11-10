import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Trash2, Eye, X } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { SeverityBadge, StatusBadge, formatDateTime } from '../components/SeverityBadge';
import { useAdminIncidents } from '../hooks/useAdminIncidents';
import {
  EMERGENCY_CATEGORIES,
  INCIDENT_STATUSES,
  SEVERITY_LEVELS,
  type EmergencyCategory,
  type IncidentStatus,
  type SeverityLevel,
} from '../types/incident';

export function AdminIncidentsPage() {
  const { incidents, loading, error, refresh } = useAdminIncidents();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<EmergencyCategory | ''>('');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | ''>('');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredIncidents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const loc = locationFilter.trim().toLowerCase();
    return incidents.filter((inc) => {
      if (q) {
        const matchesSearch =
          inc.incidentId.toLowerCase().includes(q) ||
          inc.title.toLowerCase().includes(q) ||
          inc.location.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (loc && !inc.location.toLowerCase().includes(loc)) return false;
      if (categoryFilter && inc.category !== categoryFilter) return false;
      if (severityFilter && inc.severity !== severityFilter) return false;
      if (statusFilter && inc.status !== statusFilter) return false;
      if (dateFilter) {
        const incDate = new Date(inc.reportedAt).toISOString().slice(0, 10);
        if (incDate !== dateFilter) return false;
      }
      return true;
    });
  }, [incidents, searchQuery, locationFilter, categoryFilter, severityFilter, statusFilter, dateFilter]);

  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(locationFilter) ||
    Boolean(categoryFilter) ||
    Boolean(severityFilter) ||
    Boolean(statusFilter) ||
    Boolean(dateFilter);

  const clearFilters = () => {
    setSearchQuery('');
    setLocationFilter('');
    setCategoryFilter('');
    setSeverityFilter('');
    setStatusFilter('');
    setDateFilter('');
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/incidents/${encodeURIComponent(deleteTargetId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setDeleteTargetId(null);
        await refresh();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout title="Incident Management">
      <div className="space-y-6">
        {/* Search & Filters */}
        <div className="bg-white rounded-xl border border-[#D9E2E6] p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3 relative">
              <label htmlFor="incident-search" className="sr-only">
                Search incidents by ID, title, or location
              </label>
              <Search
                className="w-4 h-4 text-[#71818A] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="incident-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID or title..."
                className="w-full rounded-lg border border-[#C5D2D8] pl-9 pr-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="filter-location" className="sr-only">
                Filter by location
              </label>
              <input
                id="filter-location"
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Filter location..."
                className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="filter-category" className="sr-only">
                Filter by category
              </label>
              <select
                id="filter-category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as EmergencyCategory | '')}
                className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
              >
                <option value="">All Categories</option>
                {EMERGENCY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="filter-severity" className="sr-only">
                Filter by severity
              </label>
              <select
                id="filter-severity"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityLevel | '')}
                className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
              >
                <option value="">All Severities</option>
                {SEVERITY_LEVELS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="filter-status" className="sr-only">
                Filter by status
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | '')}
                className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3 py-2 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
              >
                <option value="">All Statuses</option>
                {INCIDENT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1">
              <label htmlFor="filter-date" className="sr-only">
                Filter by date
              </label>
              <input
                id="filter-date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-lg border border-[#C5D2D8] px-2 py-2 text-xs text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#71818A]">
            <span className="tabular-nums">
              Showing {filteredIncidents.length} of {incidents.length} incidents
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 font-semibold text-[#426B80] hover:underline"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="p-4 rounded-lg bg-[#D9534F]/10 border border-[#D9534F]/30 text-sm text-[#962825]">
            {error}
          </div>
        )}

        {/* Table (Desktop) */}
        <div className="hidden md:block bg-white rounded-xl border border-[#D9E2E6] overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#71818A]">Loading incidents...</div>
          ) : filteredIncidents.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-[#263640]">No matching incidents found.</p>
              <p className="text-xs text-[#71818A]">
                Try adjusting your search or clearing active filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#D9E2E6] bg-[#F3F7F8] text-xs font-semibold text-[#71818A]">
                    <th className="py-3 px-4">Incident ID</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-right">Affected</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date Reported</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F7F8]">
                  {filteredIncidents.map((inc) => (
                    <tr key={inc.incidentId} className="hover:bg-[#F3F7F8]/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#426B80] tabular-nums whitespace-nowrap">
                        {inc.incidentId}
                        {inc.isDemo && (
                          <span className="block text-[10px] font-sans font-normal text-[#71818A]">
                            DEMO DATA
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#263640] max-w-[200px] truncate">
                        {inc.title}
                      </td>
                      <td className="py-3 px-4 text-[#71818A] whitespace-nowrap">{inc.category}</td>
                      <td className="py-3 px-4 text-[#71818A] max-w-[160px] truncate">
                        {inc.location}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-[#263640]">
                        {inc.peopleAffected}
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
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/admin/incidents/${encodeURIComponent(inc.incidentId)}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#F3F7F8] text-xs font-semibold text-[#426B80] hover:bg-[#E5EEE9]"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>View Details</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(inc.incidentId)}
                            aria-label={`Delete ${inc.incidentId}`}
                            className="p-1.5 rounded-md text-[#962825] hover:bg-[#D9534F]/10"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {filteredIncidents.map((inc) => (
            <div
              key={inc.incidentId}
              className="bg-white rounded-xl border border-[#D9E2E6] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-[#426B80] tabular-nums">
                    {inc.incidentId} {inc.isDemo ? '· DEMO DATA' : ''}
                  </p>
                  <h3 className="text-sm font-semibold text-[#263640] mt-0.5">{inc.title}</h3>
                </div>
                <SeverityBadge severity={inc.severity} />
              </div>
              <div className="text-xs text-[#71818A] space-y-1">
                <p>
                  {inc.category} · {inc.peopleAffected} affected
                </p>
                <p>{inc.location}</p>
                <p className="tabular-nums">{formatDateTime(inc.reportedAt)}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#F3F7F8]">
                <StatusBadge status={inc.status} />
                <div className="flex items-center gap-2">
                  <Link
                    to={`/admin/incidents/${encodeURIComponent(inc.incidentId)}`}
                    className="px-3 py-1.5 rounded-md bg-[#426B80] text-white text-xs font-semibold"
                  >
                    View Details
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(inc.incidentId)}
                    aria-label={`Delete ${inc.incidentId}`}
                    className="p-1.5 rounded-md text-[#962825] border border-[#D9534F]/30"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Delete Confirmation Dialog */}
        {deleteTargetId && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#263640]/50 p-4"
          >
            <div className="bg-white rounded-xl border border-[#D9E2E6] max-w-md w-full p-6 space-y-4">
              <h3 id="delete-dialog-title" className="text-lg font-bold text-[#263640]">
                Confirm Incident Deletion
              </h3>
              <p className="text-sm text-[#71818A]">
                Are you sure you want to permanently delete incident{' '}
                <span className="font-mono font-semibold text-[#263640]">{deleteTargetId}</span>? This action will be recorded in the administrator activity log.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(null)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg border border-[#C5D2D8] text-sm font-semibold text-[#263640] hover:bg-[#F3F7F8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-[#D9534F] text-white text-sm font-semibold hover:bg-[#B8433F] disabled:opacity-60"
                >
                  {deleting ? 'Deleting...' : 'Delete Report'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
