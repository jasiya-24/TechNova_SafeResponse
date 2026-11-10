import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, AlertCircle, AlertTriangle, Clock, CheckCircle2, Loader2, MessageSquare } from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { SeverityBadge, StatusBadge, formatDateTime } from '../components/SeverityBadge';
import { useLanguage } from '../context/LanguageContext';
import type { PublicIncidentTrack } from '../types/incident';

export function TrackPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id') || '';

  const [incidentIdInput, setIncidentIdInput] = useState(initialId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [record, setRecord] = useState<PublicIncidentTrack | null>(null);

  const fetchTrack = useCallback(async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) {
      setError('Please enter a valid Incident Reference (for example, SR-2026-1001).');
      setRecord(null);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(trimmed)}/track`);
      const data = (await res.json()) as { incident?: PublicIncidentTrack; error?: string };
      if (!res.ok || !data.incident) {
        setRecord(null);
        setError(data.error || 'Incident Reference not found.');
        return;
      }
      setRecord(data.incident);
    } catch {
      setRecord(null);
      setError('Unable to look up the incident right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialId) {
      fetchTrack(initialId);
    }
  }, [initialId, fetchTrack]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = incidentIdInput.trim();
    if (trimmed) {
      setSearchParams({ id: trimmed });
    }
    fetchTrack(trimmed);
  };

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#263640] tracking-tight">
            {t('track.title', 'Track Your Emergency Report')}
          </h1>
          <p className="text-sm sm:text-base text-[#71818A]">
            {t('track.subtitle', 'Enter your Incident Reference to check the latest available status.')}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#D9E2E6] p-5 sm:p-6 flex flex-col sm:flex-row gap-3"
        >
          <div className="flex-1">
            <label htmlFor="track-incident-id" className="sr-only">
              Incident Reference
            </label>
            <input
              id="track-incident-id"
              type="text"
              value={incidentIdInput}
              onChange={(e) => setIncidentIdInput(e.target.value)}
              placeholder="Enter Incident Reference (e.g., SR-2026-1003)"
              className="w-full rounded-lg border border-[#C5D2D8] px-4 py-2.5 text-sm font-mono text-[#263640] placeholder:font-sans placeholder:text-[#71818A]/70 focus:outline-none focus:ring-2 focus:ring-[#426B80] focus:border-[#426B80]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{t('track.button', 'Track Report')}</span>
          </button>
        </form>

        {error && (
          <div
            role="alert"
            className="bg-white rounded-xl border border-[#EF4444]/40 p-5 flex items-start gap-3 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">Report Not Found</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {record && (
          <div className="space-y-6">
            {record.severity === 'Critical' && (
              <div
                role="alert"
                className="bg-white rounded-2xl border-2 border-[#EF4444] p-5 space-y-2 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EF4444] text-white text-xs font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>CRITICAL INCIDENT · EMERGENCY MODE</span>
                  </span>
                  {record.acknowledgedAt && (
                    <span className="text-xs font-medium text-[#15803D]">
                      Acknowledged {formatDateTime(record.acknowledgedAt)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-[#263640]">
                  Your emergency report is being processed.
                </p>
                <p className="text-xs text-[#71818A]">
                  Stay calm. Your report is available to the response team. In a real emergency in India, dial 112 directly.
                </p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-[#D9E2E6] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#D9E2E6]">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#71818A]">
                    <span className="font-mono font-semibold text-[#426B80] tabular-nums">
                      {record.incidentId}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{record.category}</span>
                    {record.isDemo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-[#71818A]">DEMO DATA</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-[#263640]">{record.title}</h2>
                  <p className="text-sm text-[#71818A]">{record.location}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SeverityBadge severity={record.severity} />
                  <StatusBadge status={record.status} />
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-[#71818A]">Reported Date</dt>
                  <dd className="font-semibold text-[#263640] tabular-nums mt-1">
                    {formatDateTime(record.reportedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#71818A]">Last Updated</dt>
                  <dd className="font-semibold text-[#263640] tabular-nums mt-1">
                    {formatDateTime(record.updatedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#71818A]">Current Status</dt>
                  <dd className="font-semibold text-[#263640] mt-1">
                    {t(`status.${record.status}`, record.status)}
                  </dd>
                </div>
              </dl>

              {record.severityExplanation && (
                <div className="bg-[#F3F7F8] rounded-lg p-3.5 text-xs text-[#71818A]">
                  <strong className="text-[#263640]">Risk Classification Reason: </strong>
                  {record.severityExplanation}
                </div>
              )}

              <div className="space-y-4 pt-2">
                <h3 className="text-base font-semibold text-[#263640]">
                  Recorded Status Update Timeline
                </h3>
                <ol className="space-y-4">
                  {record.statusHistory.map((entry, idx) => {
                    const isLast = idx === record.statusHistory.length - 1;
                    return (
                      <li key={`${entry.timestamp}-${idx}`} className="flex items-start gap-3.5">
                        <div className="mt-0.5 shrink-0">
                          {entry.status === 'Resolved' ? (
                            <CheckCircle2 className="w-5 h-5 text-[#22C55E]" aria-hidden="true" />
                          ) : (
                            <Clock
                              className={`w-5 h-5 ${isLast ? 'text-[#426B80]' : 'text-[#71818A]'}`}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="flex-1 pb-3 border-b border-[#F3F7F8] last:border-b-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#263640]">
                              {entry.status}
                            </span>
                            <span className="text-xs text-[#71818A] tabular-nums">
                              {formatDateTime(entry.timestamp)}
                            </span>
                          </div>
                          {entry.note && (
                            <p className="text-sm text-[#71818A] mt-1">{entry.note}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {record.publicMessages && record.publicMessages.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[#D9E2E6]">
                  <h3 className="text-base font-semibold text-[#263640] flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#426B80]" aria-hidden="true" />
                    <span>Response Team Updates</span>
                  </h3>
                  <div className="space-y-2.5">
                    {record.publicMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="bg-[#F3F7F8] rounded-xl p-3.5 border border-[#D9E2E6] space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-[#71818A]">
                          <span className="font-semibold text-[#263640]">{msg.senderRole}</span>
                          <span className="tabular-nums">{formatDateTime(msg.timestamp)}</span>
                        </div>
                        <p className="text-sm text-[#263640]">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!record && !error && !loading && (
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-6 text-sm text-[#71818A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-[#263640]">Testing the tracking view?</p>
              <p className="mt-0.5">
                Try sample demo references like{' '}
                <span className="font-mono text-[#426B80]">SR-2026-1003</span> (Critical) or{' '}
                <span className="font-mono text-[#426B80]">SR-2026-1005</span> (Resolved).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIncidentIdInput('SR-2026-1003');
                  setSearchParams({ id: 'SR-2026-1003' });
                  fetchTrack('SR-2026-1003');
                }}
                className="px-3.5 py-2 rounded-lg bg-[#F3F7F8] border border-[#C5D2D8] text-xs font-semibold text-[#263640] hover:bg-[#E5EEE9] transition-colors"
              >
                Try SR-2026-1003
              </button>
              <Link
                to="/report"
                className="px-3.5 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] transition-colors"
              >
                New Report
              </Link>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
