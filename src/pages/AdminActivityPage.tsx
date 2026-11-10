import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { formatDateTime } from '../components/SeverityBadge';
import type { ActivityLogEntry } from '../types/incident';

export function AdminActivityPage() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/activity', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load activity log.');
        return (await res.json()) as { logs: ActivityLogEntry[] };
      })
      .then((data) => {
        if (active) setLogs(data.logs);
      })
      .catch(() => {
        if (active) setError('Unable to load administrator activity log.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const formatActionLabel = (action: ActivityLogEntry['actionType']) => {
    switch (action) {
      case 'INCIDENT_CREATED':
        return 'Incident Created';
      case 'SEVERITY_UPDATED':
        return 'Severity Updated';
      case 'STATUS_UPDATED':
        return 'Status Updated';
      case 'INCIDENT_EDITED':
        return 'Incident Edited';
      case 'INCIDENT_DELETED':
        return 'Incident Deleted';
      case 'INCIDENT_ACKNOWLEDGED':
        return 'Emergency Acknowledged';
      case 'DEMO_DATA_RESET':
        return 'Demo Data Reset';
      default:
        return action;
    }
  };

  return (
    <AdminLayout title="Administrator Activity Log">
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-[#D9E2E6] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D9E2E6]">
            <h2 className="text-base font-semibold text-[#263640]">
              Chronological Audit Trail
            </h2>
            <p className="text-xs text-[#71818A] mt-0.5">
              Records all incident creations, severity overrides, status transitions, edits, and deletions.
            </p>
          </div>

          {error && (
            <div role="alert" className="p-5 text-sm text-[#962825]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-sm text-[#71818A]">Loading activity log...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#71818A]">
              No administrative activity recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#D9E2E6] bg-[#F3F7F8] text-xs font-semibold text-[#71818A]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Administrator</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Incident ID</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F7F8]">
                  {logs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#F3F7F8]/60">
                      <td className="py-3 px-4 text-xs text-[#71818A] tabular-nums whitespace-nowrap">
                        {formatDateTime(entry.timestamp)}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#263640] whitespace-nowrap">
                        {entry.adminIdentity}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#426B80] whitespace-nowrap">
                        {formatActionLabel(entry.actionType)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums whitespace-nowrap">
                        {entry.incidentId !== 'SYSTEM' && entry.actionType !== 'INCIDENT_DELETED' ? (
                          <Link
                            to={`/admin/incidents/${encodeURIComponent(entry.incidentId)}`}
                            className="text-[#426B80] hover:underline font-semibold"
                          >
                            {entry.incidentId}
                          </Link>
                        ) : (
                          <span className="text-[#71818A]">{entry.incidentId}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#71818A]">{entry.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
