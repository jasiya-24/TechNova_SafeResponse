import type {
  EmergencyCategory,
  IncidentRecord,
  PeopleAffectedOption,
  ResponderProfile,
  SeverityLevel,
} from '../types/incident';
import { isResponderEligible } from './duplicateDetection';

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface PriorityScoreBreakdown {
  severityPoints: number;
  peoplePoints: number;
  waitingPoints: number;
  categoryPoints: number;
  totalScore: number;
  priorityLevel: PriorityLevel;
  waitingMinutes: number;
  explanation: string;
}

export interface RankedIncident {
  rank: number;
  incident: IncidentRecord;
  breakdown: PriorityScoreBreakdown;
}

export const CATEGORY_EMOJIS: Record<EmergencyCategory, string> = {
  Fire: '🚒',
  'Road Accident': '🚗💥',
  'Medical Emergency': '🚑',
  Flood: '🌊',
  'Building Collapse': '🏚️',
  Other: '⚠️',
};

const SEVERITY_POINTS: Record<SeverityLevel, number> = {
  Low: 5,
  Medium: 15,
  High: 25,
  Critical: 40,
  'Risk Assessment Pending': 5,
};

const CATEGORY_POINTS: Record<EmergencyCategory, number> = {
  Fire: 15,
  'Building Collapse': 15,
  'Medical Emergency': 12,
  Flood: 10,
  'Road Accident': 8,
  Other: 3,
};

export function peopleOptionToCount(option: PeopleAffectedOption | number): number {
  if (typeof option === 'number' && Number.isFinite(option)) {
    return Math.max(0, option);
  }
  switch (option) {
    case '1 Person':
      return 1;
    case '2–5 People':
      return 4;
    case '5–10 People':
      return 8;
    case '10+ People':
      return 20;
    case 'Unknown':
    default:
      return 1;
  }
}

export function mapScoreToPriorityLevel(score: number): PriorityLevel {
  if (score >= 75) return 'Critical';
  if (score >= 55) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

export function computePriorityScore(
  incident: Pick<IncidentRecord, 'severity' | 'peopleAffected' | 'reportedAt' | 'category'>,
  nowMs: number = Date.now()
): PriorityScoreBreakdown {
  const severityPoints = SEVERITY_POINTS[incident.severity] ?? 5;

  const peopleCount = peopleOptionToCount(incident.peopleAffected);
  const peoplePoints = Math.min(25, Math.round(Math.log2(peopleCount + 1) * 4));

  const reportedMs = new Date(incident.reportedAt).getTime();
  const waitingMinutes = Number.isFinite(reportedMs)
    ? Math.max(0, Math.floor((nowMs - reportedMs) / 60000))
    : 0;
  const waitingPoints = Math.min(20, Math.floor(waitingMinutes / 3));

  const categoryPoints = CATEGORY_POINTS[incident.category] ?? 3;

  const totalScore = Math.min(100, severityPoints + peoplePoints + waitingPoints + categoryPoints);
  const priorityLevel = mapScoreToPriorityLevel(totalScore);

  const explanation = `Severity +${severityPoints}, People +${peoplePoints}, Waiting +${waitingPoints}, Category +${categoryPoints} = ${totalScore}`;

  return {
    severityPoints,
    peoplePoints,
    waitingPoints,
    categoryPoints,
    totalScore,
    priorityLevel,
    waitingMinutes,
    explanation,
  };
}

export function buildPriorityQueue(
  incidents: IncidentRecord[],
  nowMs: number = Date.now()
): RankedIncident[] {
  const unresolved = incidents.filter((inc) => inc.status !== 'Resolved');

  const scored = unresolved.map((incident) => ({
    incident,
    breakdown: computePriorityScore(incident, nowMs),
  }));

  scored.sort((a, b) => {
    if (b.breakdown.totalScore !== a.breakdown.totalScore) {
      return b.breakdown.totalScore - a.breakdown.totalScore;
    }
    return new Date(a.incident.reportedAt).getTime() - new Date(b.incident.reportedAt).getTime();
  });

  return scored.map((item, idx) => ({
    rank: idx + 1,
    incident: item.incident,
    breakdown: item.breakdown,
  }));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestSuitableTeam(
  incident: IncidentRecord,
  responders: ResponderProfile[]
): { responder: ResponderProfile; distanceKm: number | null } | null {
  const eligible = responders.filter(
    (r) => r.status !== 'Busy' && isResponderEligible(r, incident)
  );
  if (eligible.length === 0) return null;

  if (incident.latitude === null || incident.longitude === null) {
    return { responder: eligible[0], distanceKm: null };
  }

  let best: { responder: ResponderProfile; distanceKm: number | null } = {
    responder: eligible[0],
    distanceKm:
      eligible[0].latitude !== undefined && eligible[0].longitude !== undefined
        ? haversineKm(
            incident.latitude,
            incident.longitude,
            eligible[0].latitude,
            eligible[0].longitude
          )
        : null,
  };

  for (let i = 1; i < eligible.length; i++) {
    const r = eligible[i];
    const dist =
      r.latitude !== undefined && r.longitude !== undefined
        ? haversineKm(incident.latitude, incident.longitude, r.latitude, r.longitude)
        : null;
    if (dist !== null && (best.distanceKm === null || dist < best.distanceKm)) {
      best = { responder: r, distanceKm: dist };
    }
  }

  return best;
}
