import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Info,
  Loader2,
  MapPin,
  Users,
  Clock,
  ArrowRight,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  buildPriorityQueue,
  CATEGORY_EMOJIS,
  findNearestSuitableTeam,
  type PriorityLevel,
} from '../utils/priorityQueue';
import {
  EMERGENCY_CATEGORIES,
  type EmergencyCategory,
  type IncidentRecord,
  type ResponderProfile,
} from '../types/incident';

type QueueStatusFilter = 'All' | 'Reported' | 'Assigned' | 'In Progress';

const PRIORITY_CARD_STYLES: Record<PriorityLevel, string> = {
  Low: 'bg-[#E5EEE9]/70 border border-[#5D9678]/40',
  Medium: 'bg-[#FEF9E7] border border-[#E8AD52]/50',
  High: 'bg-[#FFF3E6] border border-[#E58A48]/60',
  Critical:
    'bg-[#FDECEC] border-2 border-[#D9534F] shadow-[0_0_18px_rgba(217,83,79,0.28)] animate-pulse',
};

const PRIORITY_BADGE_STYLES: Record<PriorityLevel, string> = {
  Low: 'bg-[#5D9678]/15 text-[#2E5A44] border-[#5D9678]/40',
  Medium: 'bg-[#E8AD52]/20 text-[#7A5011] border-[#E8AD52]/50',
  High: 'bg-[#E58A48]/20 text-[#9A4614] border-[#E58A48]/50',
  Critical: 'bg-[#D9534F] text-white border-[#D9534F]',
};

const BAR_FILL_STYLES: Record<PriorityLevel, string> = {
  Low: 'bg-[#5D9678]',
  Medium: 'bg-[#E8AD52]',
  High: 'bg-[#E58A48]',
  Critical: 'bg-[#D9534F]',
};

function formatWaitingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export function PriorityQueuePanel({
  incidents,
  onRefresh,
  compact = false,
}: {
  incidents: IncidentRecord[];
  onRefresh: () => Promise<void>;
  compact?: boolean;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [responders, setResponders] = useState<ResponderProfile[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<'All' | EmergencyCategory>('All');
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>('All');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [dispatchNotice, setDispatchNotice] = useState('');
  const [dispatchError, setDispatchError] = useState('');

  // Track rank-ups for "⬆ Escalated" badge (1 minute TTL)
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [escalatedUntil, setEscalatedUntil] = useState<Record<string, number>>({});

  // Fetch responders on mount and whenever incidents change
  useEffect(() => {
    fetch('/api/admin/responders', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { responders: [] }))
      .then((data: { responders?: ResponderProfile[] }) => {
        if (data.responders) setResponders(data.responders);
      })
      .catch(() => {
        // ignore network hiccup
      });
  }, [incidents]);

  // Live escalation: recalculate scores every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const allRanked = useMemo(() => buildPriorityQueue(incidents, nowMs), [incidents, nowMs]);

  // Detect rank improvements
  useEffect(() => {
    const prev = prevRanksRef.current;
    const now = Date.now();
    const updates: Record<string, number> = {};
    let changed = false;

    for (const item of allRanked) {
      const oldRank = prev.get(item.incident.incidentId);
      if (oldRank !== undefined && item.rank < oldRank) {
        updates[item.incident.incidentId] = now + 60_000;
        changed = true;
      }
    }

    const nextMap = new Map<string, number>();
    for (const item of allRanked) {
      nextMap.set(item.incident.incidentId, item.rank);
    }
    prevRanksRef.current = nextMap;

    if (changed) {
      setEscalatedUntil((curr) => ({ ...curr, ...updates }));
    }
  }, [allRanked]);

  // Critical unassigned > 5 min alert
  const criticalUnassigned = useMemo(() => {
    return allRanked.find(
      (item) =>
        (item.breakdown.priorityLevel === 'Critical' || item.incident.severity === 'Critical') &&
        !item.incident.assignedResponderId &&
        item.breakdown.waitingMinutes > 5
    );
  }, [allRanked]);

  const filteredRanked = useMemo(() => {
    return allRanked.filter(({ incident }) => {
      if (categoryFilter !== 'All' && incident.category !== categoryFilter) return false;
      if (statusFilter === 'Reported') {
        return !incident.assignedResponderId && incident.status === 'Reported';
      }
      if (statusFilter === 'Assigned') {
        return Boolean(incident.assignedResponderId) && incident.status !== 'Resolved';
      }
      if (statusFilter === 'In Progress') {
        return incident.status === 'In Progress';
      }
      return true;
    });
  }, [allRanked, categoryFilter, statusFilter]);

  const visibleItems = compact ? filteredRanked.slice(0, 4) : filteredRanked;

  const toggleBreakdown = (incidentId: string) => {
    setExpandedIds((prev) => ({ ...prev, [incidentId]: !prev[incidentId] }));
  };

  const handleQuickAssign = async (incident: IncidentRecord) => {
    setDispatchError('');
    setDispatchNotice('');
    const match = findNearestSuitableTeam(incident, responders);
    if (!match) {
      setDispatchError(
        `No eligible available team found for ${incident.incidentId} (${incident.category}).`
      );
      return;
    }

    setAssigningId(incident.incidentId);
    try {
      const res = await fetch(
        `/api/admin/incidents/${encodeURIComponent(incident.incidentId)}/assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            responderId: match.responder.id,
            reason:
              match.distanceKm !== null
                ? `Nearest suitable team (${match.distanceKm.toFixed(1)} km)`
                : 'Top recommended eligible team',
          }),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setDispatchError(data.error || 'Could not assign team.');
        return;
      }
      setDispatchNotice(
        `Dispatched ${match.responder.name} to ${incident.incidentId}${
          match.distanceKm !== null ? ` (${match.distanceKm.toFixed(1)} km away)` : ''
        }.`
      );
      await onRefresh();
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <section aria-label="Priority Queue" className="space-y-4">
      {/* Critical Unassigned > 5 min Banner */}
      {criticalUnassigned && (
        <div
          role="alert"
          className="rounded-xl border-2 border-[#D9534F] bg-[#FDECEC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <p className="text-sm font-bold text-[#962825]">
            🚨 Critical incident unassigned for{' '}
            <span className="tabular-nums">{criticalUnassigned.breakdown.waitingMinutes}</span> min
            – dispatch now ({criticalUnassigned.incident.incidentId})
          </p>
          <Link
            to={`/admin/incidents/${encodeURIComponent(criticalUnassigned.incident.incidentId)}`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#D9534F] text-white text-xs font-semibold hover:bg-[#B83E3A] shrink-0"
          >
            <span>Open Incident</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Header + Filters + Open Counter */}
      <div className="bg-white rounded-xl border border-[#D9E2E6] p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base sm:text-lg font-bold text-[#263640]">
                Live Priority Queue
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#E5EEE9] text-[#2E5A44] text-xs font-semibold tabular-nums">
                {filteredRanked.length} open incidents
              </span>
            </div>
            <p className="text-xs text-[#71818A] mt-0.5">
              Ranked 0–100 by severity, people affected, waiting time (+1 every 3 min), and category. Auto-recalculates every 30s.
            </p>
          </div>

          {compact && (
            <Link
              to="/admin/priority-queue"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#426B80] hover:underline shrink-0"
            >
              <span>Open Full Priority Queue</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <select
            aria-label="Filter priority queue by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'All' | EmergencyCategory)}
            className="rounded-lg border border-[#C5D2D8] bg-white px-3 py-1.5 text-xs font-medium text-[#263640]"
          >
            <option value="All">All Categories</option>
            {EMERGENCY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_EMOJIS[cat]} {cat}
              </option>
            ))}
          </select>

          <div className="inline-flex flex-wrap rounded-lg border border-[#C5D2D8] bg-[#F3F7F8] p-0.5 text-xs font-semibold">
            {(['All', 'Reported', 'Assigned', 'In Progress'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === st
                    ? 'bg-[#426B80] text-white'
                    : 'text-[#71818A] hover:text-[#263640]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {dispatchNotice && (
          <div className="p-2.5 rounded-lg bg-[#E5EEE9] text-xs font-medium text-[#2E5A44] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{dispatchNotice}</span>
          </div>
        )}
        {dispatchError && (
          <div className="p-2.5 rounded-lg bg-[#FDECEC] text-xs font-medium text-[#962825]">
            {dispatchError}
          </div>
        )}
      </div>

      {/* Queue Cards */}
      {visibleItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#D9E2E6] p-8 text-center text-sm text-[#71818A]">
          No open incidents match the selected filters.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map(({ rank, incident, breakdown }) => {
            const isTop = rank === 1;
            const isAssigned = Boolean(incident.assignedResponderId);
            const isEscalated = (escalatedUntil[incident.incidentId] || 0) > Date.now();
            const isExpanded = Boolean(expandedIds[incident.incidentId]);
            const emoji = CATEGORY_EMOJIS[incident.category] || '⚠️';
            const nearest = !isAssigned ? findNearestSuitableTeam(incident, responders) : null;

            return (
              <article
                key={incident.incidentId}
                className={`rounded-2xl transition-all duration-300 ${
                  PRIORITY_CARD_STYLES[breakdown.priorityLevel]
                } ${isTop ? 'p-5 sm:p-6' : 'p-4 sm:p-5'}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Rank, Emoji, Title, Metadata */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#263640] tabular-nums">
                        #{rank}
                      </span>
                      {isTop && (
                        <span className="px-2.5 py-0.5 rounded-md bg-[#D9534F] text-white text-xs font-bold">
                          🔥 Most Urgent
                        </span>
                      )}
                      {isEscalated && (
                        <span className="px-2 py-0.5 rounded-md bg-[#E58A48] text-white text-xs font-bold">
                          ⬆ Escalated
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${
                          PRIORITY_BADGE_STYLES[breakdown.priorityLevel]
                        }`}
                      >
                        {breakdown.priorityLevel} Priority
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/80 border border-[#D9E2E6] text-xs font-medium text-[#263640]">
                        {incident.status}
                      </span>
                      {isAssigned && (
                        <span className="px-2 py-0.5 rounded-md bg-[#E5EEE9] border border-[#5D9678]/40 text-xs font-semibold text-[#2E5A44] inline-flex items-center gap-1">
                          <UserCheck className="w-3 h-3" aria-hidden="true" />
                          <span>Assigned: {incident.assignedResponderName}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="text-xl leading-none mt-0.5" aria-hidden="true">
                        {emoji}
                      </span>
                      <div className="min-w-0">
                        <Link
                          to={`/admin/incidents/${encodeURIComponent(incident.incidentId)}`}
                          className={`font-bold text-[#263640] hover:text-[#426B80] hover:underline block ${
                            isTop ? 'text-lg sm:text-xl' : 'text-base'
                          }`}
                        >
                          {incident.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#71818A] mt-1">
                          <span className="font-mono font-semibold text-[#426B80] tabular-nums">
                            {incident.incidentId}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{incident.location}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{incident.peopleAffected}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 tabular-nums font-medium text-[#263640]">
                            <Clock className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
                            <span>Waiting {formatWaitingTime(breakdown.waitingMinutes)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Score Bar + Why? + Assign Nearest Team */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0 lg:w-64">
                    <div className="w-full space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => toggleBreakdown(incident.incidentId)}
                          className="inline-flex items-center gap-1 font-semibold text-[#426B80] hover:underline"
                        >
                          <Info className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>ℹ️ Why?</span>
                        </button>
                        <span className="font-mono font-bold text-[#263640] tabular-nums">
                          Score: {breakdown.totalScore}/100
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleBreakdown(incident.incidentId)}
                        aria-label={`Toggle score breakdown for ${incident.incidentId}`}
                        className="w-full h-2.5 rounded-full bg-white/80 border border-[#D9E2E6] overflow-hidden block cursor-pointer"
                      >
                        <div
                          className={`h-full transition-all duration-300 ${
                            BAR_FILL_STYLES[breakdown.priorityLevel]
                          }`}
                          style={{ width: `${breakdown.totalScore}%` }}
                        />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isAssigned ? (
                        <button
                          type="button"
                          disabled={assigningId === incident.incidentId || !nearest}
                          onClick={() => handleQuickAssign(incident)}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#426B80] text-white text-xs font-semibold hover:bg-[#35586A] disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {assigningId === incident.incidentId ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                              <span>Dispatching...</span>
                            </>
                          ) : (
                            <span>
                              {nearest
                                ? `Assign nearest team${
                                    nearest.distanceKm !== null
                                      ? ` (${nearest.distanceKm.toFixed(1)}km)`
                                      : ''
                                  }`
                                : 'No eligible team'}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-[#2E5A44] bg-white/80 px-2.5 py-1.5 rounded-lg border border-[#C6D8CE]">
                          Lower Urgency · Team Dispatched
                        </span>
                      )}
                      <Link
                        to={`/admin/incidents/${encodeURIComponent(incident.incidentId)}`}
                        className="px-3 py-2 rounded-lg bg-white border border-[#C5D2D8] text-xs font-semibold text-[#263640] hover:bg-[#F3F7F8] whitespace-nowrap"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Expandable Score Breakdown */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[#D9E2E6]/70 bg-white/80 rounded-lg px-3.5 py-2.5 text-xs text-[#263640] font-mono">
                    {breakdown.explanation}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
