import { useState, useEffect, useCallback } from 'react';
import type { IncidentRecord } from '../types/incident';

export function useAdminIncidents() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/incidents', { credentials: 'include' });
      if (!res.ok) {
        setError('Failed to load incidents.');
        return;
      }
      const data = (await res.json()) as { incidents: IncidentRecord[] };
      setIncidents(data.incidents);
      setError('');
    } catch {
      setError('Network error while loading incidents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();

    const eventSource = new EventSource('/api/admin/stream', { withCredentials: true });
    eventSource.addEventListener('incidents-updated', () => {
      fetchIncidents();
    });

    return () => {
      eventSource.close();
    };
  }, [fetchIncidents]);

  return { incidents, loading, error, refresh: fetchIncidents };
}
