import type { EmergencyCategory, PeopleAffectedOption } from '../types/incident';

export interface OfflineReportDraft {
  title: string;
  description: string;
  category: EmergencyCategory;
  location: string;
  peopleAffected: PeopleAffectedOption;
  contactInformation: string;
  savedAt: string;
}

export interface QueuedSubmission {
  clientSubmissionId: string;
  payload: {
    title: string;
    description: string;
    originalDescription: string;
    category: EmergencyCategory;
    location: string;
    peopleAffected: PeopleAffectedOption;
    contactInformation: string;
    latitude: number | null;
    longitude: number | null;
    locationAccuracy: number | null;
    locationTimestamp: string | null;
    isSos?: boolean;
    clientSubmissionId: string;
  };
  queueStatus: 'pending' | 'synced' | 'failed';
  serverIncidentId?: string;
  errorMessage?: string;
  createdAt: string;
}

const DRAFT_KEY = 'saferesponse_report_draft_v1';
const QUEUE_KEY = 'saferesponse_offline_queue_v1';

export function saveReportDraft(draft: OfflineReportDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage quota errors
  }
}

export function loadReportDraft(): OfflineReportDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OfflineReportDraft) : null;
  } catch {
    return null;
  }
}

export function clearReportDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function loadOfflineQueue(): QueuedSubmission[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSubmission[]) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items: QueuedSubmission[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function enqueueOfflineSubmission(item: QueuedSubmission): QueuedSubmission[] {
  const current = loadOfflineQueue();
  if (current.some((x) => x.clientSubmissionId === item.clientSubmissionId)) {
    return current;
  }
  const next = [item, ...current];
  saveOfflineQueue(next);
  return next;
}
