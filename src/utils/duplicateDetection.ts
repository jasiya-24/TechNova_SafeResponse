import type {
  IncidentRecord,
  ResponderProfile,
  ResponderQualification,
} from '../types/incident';

export interface DuplicateCandidate {
  incidentId: string;
  title: string;
  category: string;
  location: string;
  reportedAt: string;
  similarityScore: number;
  reasons: string[];
}

function tokenize(text: string): Set<string> {
  const stopWords = new Set(['the', 'and', 'near', 'with', 'from', 'that', 'this', 'have', 'been', 'into']);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));
  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
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

export function findPotentialDuplicates(
  target: IncidentRecord,
  allIncidents: IncidentRecord[]
): DuplicateCandidate[] {
  const targetTime = new Date(target.reportedAt).getTime();
  const targetTextTokens = tokenize(`${target.title} ${target.description}`);
  const targetLocTokens = tokenize(target.location);

  const results: DuplicateCandidate[] = [];

  for (const other of allIncidents) {
    if (other.incidentId === target.incidentId) continue;
    if (Boolean(other.isDemo) !== Boolean(target.isDemo)) continue;

    const reasons: string[] = [];
    let score = 0;

    // 1. Category match
    if (other.category === target.category) {
      score += 25;
      reasons.push(`Same category (${other.category})`);
    }

    // 2. Time proximity (within 24 hours)
    const diffHours = Math.abs(targetTime - new Date(other.reportedAt).getTime()) / 3600_000;
    if (diffHours <= 6) {
      score += 20;
      reasons.push('Reported within 6 hours');
    } else if (diffHours <= 24) {
      score += 10;
      reasons.push('Reported within 24 hours');
    }

    // 3. Location similarity or GPS proximity
    if (
      target.latitude !== null &&
      target.longitude !== null &&
      other.latitude !== null &&
      other.longitude !== null
    ) {
      const distKm = haversineKm(target.latitude, target.longitude, other.latitude, other.longitude);
      if (distKm <= 1.5) {
        score += 30;
        reasons.push(`Within ${distKm.toFixed(1)} km GPS radius`);
      }
    } else {
      const locSim = jaccardSimilarity(targetLocTokens, tokenize(other.location));
      if (locSim >= 0.25) {
        score += Math.round(locSim * 35);
        reasons.push('Matching location keywords');
      }
    }

    // 4. Description/title similarity
    const textSim = jaccardSimilarity(
      targetTextTokens,
      tokenize(`${other.title} ${other.description}`)
    );
    if (textSim >= 0.15) {
      score += Math.round(textSim * 45);
      reasons.push('Similar incident description');
    }

    if (score >= 40) {
      results.push({
        incidentId: other.incidentId,
        title: other.title,
        category: other.category,
        location: other.location,
        reportedAt: other.reportedAt,
        similarityScore: Math.min(100, score),
        reasons,
      });
    }
  }

  return results.sort((a, b) => b.similarityScore - a.similarityScore);
}

export function isIncidentSpecialistRequired(incident: IncidentRecord): {
  required: boolean;
  allowedQualifications: ResponderQualification[];
  safetyNotice: string;
} {
  if (incident.category === 'Building Collapse') {
    return {
      required: true,
      allowedQualifications: ['Structural Rescue Specialist'],
      safetyNotice:
        'Structural collapse hazard: Only verified Structural Rescue Specialists may be assigned. Ordinary volunteers must not enter unstable structures.',
    };
  }
  if (incident.category === 'Fire' && (incident.severity === 'Critical' || incident.severity === 'High')) {
    return {
      required: true,
      allowedQualifications: ['Fire & Hazmat Specialist'],
      safetyNotice:
        'Active fire/smoke hazard: Requires Fire & Hazmat Specialist qualification. Do not direct ordinary volunteers into fire zones.',
    };
  }
  if (incident.category === 'Medical Emergency' && incident.severity === 'Critical') {
    return {
      required: true,
      allowedQualifications: ['Medical First Aid', 'Fire & Hazmat Specialist'],
      safetyNotice:
        'Critical medical emergency: Requires Medical First Aid or specialist responder qualification.',
    };
  }
  return {
    required: false,
    allowedQualifications: [
      'General Volunteer',
      'Medical First Aid',
      'Fire & Hazmat Specialist',
      'Structural Rescue Specialist',
    ],
    safetyNotice:
      'Standard safety protocol applies. Platform coordination does not replace official emergency services.',
  };
}

export function isResponderEligible(
  responder: ResponderProfile,
  incident: IncidentRecord
): boolean {
  if (!responder.verified || !responder.available) return false;
  const { allowedQualifications } = isIncidentSpecialistRequired(incident);
  return allowedQualifications.includes(responder.qualification);
}

export function isAssignmentEscalated(
  incident: IncidentRecord,
  nowMs: number = Date.now()
): { escalated: boolean; pendingMinutes: number } {
  if (incident.status === 'Resolved' || incident.acceptedAt) {
    return { escalated: false, pendingMinutes: 0 };
  }
  const threshold = incident.escalationThresholdMinutes ?? 15;
  const startStr = incident.assignedAt || incident.reportedAt;
  const startMs = new Date(startStr).getTime();
  if (!Number.isFinite(startMs)) return { escalated: false, pendingMinutes: 0 };

  const pendingMinutes = Math.max(0, Math.floor((nowMs - startMs) / 60000));
  const escalated = pendingMinutes >= threshold || Boolean(incident.escalatedAt);
  return { escalated, pendingMinutes };
}

export interface PerformanceMetrics {
  avgVerificationMinutes: number | null;
  avgAssignmentMinutes: number | null;
  avgAcceptanceMinutes: number | null;
  avgResponseMinutes: number | null;
  completedCount: number;
  pendingCount: number;
}

export function computePerformanceMetrics(incidents: IncidentRecord[]): PerformanceMetrics {
  let verSum = 0;
  let verCount = 0;
  let assignSum = 0;
  let assignCount = 0;
  let acceptSum = 0;
  let acceptCount = 0;
  let respSum = 0;
  let respCount = 0;
  let completedCount = 0;
  let pendingCount = 0;

  for (const inc of incidents) {
    if (inc.status === 'Resolved') completedCount++;
    else pendingCount++;

    const rep = new Date(inc.reportedAt).getTime();
    if (!Number.isFinite(rep)) continue;

    if (inc.verifiedAt) {
      const ver = new Date(inc.verifiedAt).getTime();
      if (Number.isFinite(ver) && ver >= rep) {
        verSum += ver - rep;
        verCount++;
      }
    }
    if (inc.assignedAt) {
      const asg = new Date(inc.assignedAt).getTime();
      if (Number.isFinite(asg) && asg >= rep) {
        assignSum += asg - rep;
        assignCount++;
      }
      if (inc.acceptedAt) {
        const acc = new Date(inc.acceptedAt).getTime();
        if (Number.isFinite(acc) && acc >= asg) {
          acceptSum += acc - asg;
          acceptCount++;
        }
      }
    }
    if (inc.status === 'Resolved' && inc.resolvedAt) {
      const res = new Date(inc.resolvedAt).getTime();
      if (Number.isFinite(res) && res >= rep) {
        respSum += res - rep;
        respCount++;
      }
    }
  }

  const toMin = (sum: number, count: number) =>
    count > 0 ? Math.round(sum / count / 60000) : null;

  return {
    avgVerificationMinutes: toMin(verSum, verCount),
    avgAssignmentMinutes: toMin(assignSum, assignCount),
    avgAcceptanceMinutes: toMin(acceptSum, acceptCount),
    avgResponseMinutes: toMin(respSum, respCount),
    completedCount,
    pendingCount,
  };
}
