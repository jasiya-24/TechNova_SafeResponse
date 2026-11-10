import type {
  EmergencyCategory,
  IncidentRecord,
  IncidentStatus,
  PeopleAffectedOption,
  SeverityLevel,
} from '../types/incident';

export interface ClassificationResult {
  severity: SeverityLevel;
  explanation: string;
  matchedSignals: string[];
}

const CRITICAL_KEYWORDS = [
  'trapped',
  'unconscious',
  'not breathing',
  'cardiac',
  'explosion',
  'engulfed',
  'collapsed',
  'structural failure',
  'life-threatening',
  'severe bleeding',
  'mass casualty',
  'submerged',
  'flash flood',
  'toxic',
  'gas leak',
  'children trapped',
  'multiple fatalities',
  'critical condition',
  'chest pain',
  'stroke',
  'drowning',
  'electrocution',
];

const HIGH_KEYWORDS = [
  'injured',
  'injury',
  'injuries',
  'fracture',
  'heavy smoke',
  'spreading',
  'highway',
  'collision',
  'pileup',
  'rising water',
  'evacuation',
  'power line',
  'short circuit',
  'burn',
  'bleeding',
  'ambulance',
  'stranded',
  'cracks',
  'unstable',
  'blocked road',
  'ongoing',
  'escalating',
  'worsening',
];

const MEDIUM_KEYWORDS = [
  'minor injury',
  'waterlogging',
  'fallen tree',
  'traffic',
  'fender bender',
  'smoke',
  'spark',
  'dizzy',
  'fainting',
  'assistance',
  'stuck',
  'damage',
  'leak',
];

const LOW_INDICATORS = [
  'no injuries',
  'no injury',
  'minor',
  'contained',
  'safe',
  'precaution',
  'false alarm',
  'small',
  'controlled',
  'resolved',
];

const ONGOING_ESCALATION_KEYWORDS = [
  'spreading',
  'rising',
  'ongoing',
  'still burning',
  'escalating',
  'active',
  'growing',
  'worsening',
];

/**
 * Intelligent risk classification fallback.
 * Evaluates category, description, life-threat indicators, affected people (Unknown does NOT reduce risk),
 * ongoing status, and escalation possibility. Returns 'Risk Assessment Pending' when information is insufficient.
 */
export function classifyIncidentRuleBased(input: {
  title: string;
  description: string;
  category: EmergencyCategory;
  peopleAffected: PeopleAffectedOption | number;
}): ClassificationResult {
  const titleClean = input.title.trim();
  const descClean = input.description.trim();
  const combinedText = `${titleClean} ${descClean}`.toLowerCase();

  // Insufficient information check
  if (descClean.length < 15 && titleClean.length < 6) {
    return {
      severity: 'Risk Assessment Pending',
      explanation:
        'Information provided is currently insufficient for automated risk triage. An administrator will review and assign a risk level.',
      matchedSignals: ['Insufficient incident description details'],
    };
  }

  const positiveText = combinedText.replace(
    /\b(no|without|zero)\s+(reported\s+)?(injur(y|ies)|bleeding|damage)\b/g,
    ' '
  );

  let score = 0;
  const matchedSignals: string[] = [];

  // 1. Affected people factor (never sole factor; 'Unknown' must NOT reduce risk)
  if (input.peopleAffected === '10+ People' || (typeof input.peopleAffected === 'number' && input.peopleAffected >= 10)) {
    score += 3.5;
    matchedSignals.push('10+ people affected (large-scale impact)');
  } else if (input.peopleAffected === '5–10 People' || (typeof input.peopleAffected === 'number' && input.peopleAffected >= 5)) {
    score += 2.5;
    matchedSignals.push('5–10 people affected');
  } else if (input.peopleAffected === '2–5 People' || (typeof input.peopleAffected === 'number' && input.peopleAffected >= 2)) {
    score += 1.5;
    matchedSignals.push('2–5 people affected');
  } else if (input.peopleAffected === '1 Person' || input.peopleAffected === 1) {
    score += 0.5;
    matchedSignals.push('1 person affected');
  } else if (input.peopleAffected === 'Unknown') {
    score += 1.0; // Neutral-cautious posture: Unknown never reduces risk
    matchedSignals.push('Affected count unknown (evaluated without reducing risk)');
  }

  // 2. Threat to life & urgency keywords
  const criticalHits = CRITICAL_KEYWORDS.filter((kw) => positiveText.includes(kw));
  const highHits = HIGH_KEYWORDS.filter((kw) => positiveText.includes(kw));
  const mediumHits = MEDIUM_KEYWORDS.filter((kw) => positiveText.includes(kw));
  const lowHits = LOW_INDICATORS.filter((kw) => combinedText.includes(kw));
  const ongoingHits = ONGOING_ESCALATION_KEYWORDS.filter((kw) => positiveText.includes(kw));

  if (criticalHits.length > 0) {
    score += 4.5 + Math.min(2, (criticalHits.length - 1) * 1.0);
    matchedSignals.push(`Immediate life-threat indicators: ${criticalHits.slice(0, 3).join(', ')}`);
  }

  if (highHits.length > 0) {
    score += 2.2 + Math.min(1.5, (highHits.length - 1) * 0.6);
    matchedSignals.push(`Urgent danger indicators: ${highHits.slice(0, 3).join(', ')}`);
  }

  if (ongoingHits.length > 0) {
    score += 1.0;
    matchedSignals.push(`Ongoing/escalation potential: ${ongoingHits.slice(0, 2).join(', ')}`);
  }

  if (mediumHits.length > 0) {
    score += 1.0;
    matchedSignals.push(`Moderate indicators: ${mediumHits.slice(0, 2).join(', ')}`);
  }

  if (lowHits.length > 0 && criticalHits.length === 0 && ongoingHits.length === 0) {
    score -= 1.2;
    matchedSignals.push(`Mitigating indicators: ${lowHits.slice(0, 2).join(', ')}`);
  }

  // 3. Category context (modifier only)
  if (
    (input.category === 'Building Collapse' || input.category === 'Fire') &&
    (criticalHits.length > 0 || highHits.length > 0 || ongoingHits.length > 0)
  ) {
    score += 1.0;
  } else if (input.category === 'Medical Emergency' && criticalHits.length > 0) {
    score += 0.8;
  }

  // If no meaningful signal words were matched and description is very vague
  if (
    criticalHits.length === 0 &&
    highHits.length === 0 &&
    mediumHits.length === 0 &&
    lowHits.length === 0 &&
    descClean.split(/\s+/).length < 4
  ) {
    return {
      severity: 'Risk Assessment Pending',
      explanation:
        'Insufficient detail to determine risk level automatically. Pending administrator review.',
      matchedSignals: ['Minimal detail in report'],
    };
  }

  let severity: SeverityLevel;
  if (score >= 5.5) {
    severity = 'Critical';
  } else if (score >= 3.0) {
    severity = 'High';
  } else if (score >= 1.2) {
    severity = 'Medium';
  } else {
    severity = 'Low';
  }

  const explanation =
    `Assessed as ${severity.toUpperCase()} RISK based on: ${matchedSignals.join('; ')}. ` +
    `This automated triage suggestion assists coordinator prioritization and is not a confirmed emergency assessment.`;

  return {
    severity,
    explanation,
    matchedSignals,
  };
}

export interface AnalyticsSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  pendingAssessment: number;
  reported: number;
  pending: number;
  inProgress: number;
  resolved: number;
  unresolved: number;
  averageResolutionMinutes: number | null;
  resolvedWithValidTimestamps: number;
  byCategory: Record<EmergencyCategory, number>;
  bySeverity: Record<SeverityLevel, number>;
  byStatus: Record<IncidentStatus, number>;
}

export function computeIncidentAnalytics(incidents: IncidentRecord[]): AnalyticsSummary {
  const byCategory: Record<EmergencyCategory, number> = {
    Fire: 0,
    'Road Accident': 0,
    'Medical Emergency': 0,
    Flood: 0,
    'Building Collapse': 0,
    Other: 0,
  };

  const bySeverity: Record<SeverityLevel, number> = {
    Low: 0,
    Medium: 0,
    High: 0,
    Critical: 0,
    'Risk Assessment Pending': 0,
  };

  const byStatus: Record<IncidentStatus, number> = {
    Reported: 0,
    Pending: 0,
    'In Progress': 0,
    Resolved: 0,
  };

  let resolutionSumMs = 0;
  let resolvedWithValidTimestamps = 0;

  for (const inc of incidents) {
    if (byCategory[inc.category] !== undefined) byCategory[inc.category]++;
    if (bySeverity[inc.severity] !== undefined) bySeverity[inc.severity]++;
    if (byStatus[inc.status] !== undefined) byStatus[inc.status]++;

    if (inc.status === 'Resolved' && inc.resolvedAt && inc.reportedAt) {
      const start = new Date(inc.reportedAt).getTime();
      const end = new Date(inc.resolvedAt).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        resolutionSumMs += end - start;
        resolvedWithValidTimestamps++;
      }
    }
  }

  const averageResolutionMinutes =
    resolvedWithValidTimestamps > 0
      ? Math.round(resolutionSumMs / resolvedWithValidTimestamps / 60000)
      : null;

  return {
    total: incidents.length,
    critical: bySeverity.Critical,
    high: bySeverity.High,
    medium: bySeverity.Medium,
    low: bySeverity.Low,
    pendingAssessment: bySeverity['Risk Assessment Pending'],
    reported: byStatus.Reported,
    pending: byStatus.Pending,
    inProgress: byStatus['In Progress'],
    resolved: byStatus.Resolved,
    unresolved: incidents.length - byStatus.Resolved,
    averageResolutionMinutes,
    resolvedWithValidTimestamps,
    byCategory,
    bySeverity,
    byStatus,
  };
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function incidentsToCsv(incidents: IncidentRecord[]): string {
  const headers = [
    'Incident Reference',
    'Title',
    'Category',
    'Location',
    'People Affected',
    'Risk Level',
    'Risk Source',
    'Status',
    'Reported At',
    'Updated At',
    'Resolved At',
    'Record Type',
  ];

  const rows = incidents.map((inc) =>
    [
      inc.incidentId,
      inc.title,
      inc.category,
      inc.location,
      inc.peopleAffected,
      inc.severity,
      inc.severitySource,
      inc.status,
      inc.reportedAt,
      inc.updatedAt,
      inc.resolvedAt ?? '',
      inc.isDemo ? 'DEMO DATA' : 'SUBMITTED',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
