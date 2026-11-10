import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findPotentialDuplicates,
  isResponderEligible,
  isAssignmentEscalated,
  computePerformanceMetrics,
} from './duplicateDetection';
import type { IncidentRecord, ResponderProfile } from '../types/incident';

const baseIncident: IncidentRecord = {
  incidentId: 'SR-2026-1001',
  title: 'Transformer fire at Sector 14',
  description: 'Heavy smoke and sparks from transformer room',
  category: 'Fire',
  location: 'Sector 14 Industrial Estate',
  latitude: 28.6289,
  longitude: 77.2195,
  peopleAffected: '2–5 People',
  contactInformation: '',
  severity: 'High',
  severitySource: 'Rule-Based',
  severityExplanation: 'Test',
  originalSeverity: 'High',
  originalSeveritySource: 'Rule-Based',
  originalSeverityExplanation: 'Test',
  status: 'Reported',
  reportedAt: '2026-11-10T08:00:00.000Z',
  updatedAt: '2026-11-10T08:00:00.000Z',
  resolvedAt: null,
  statusHistory: [],
  createdBy: 'Public',
  isDemo: false,
};

test('detects potential duplicate within GPS radius, same category, and time window', () => {
  const candidate: IncidentRecord = {
    ...baseIncident,
    incidentId: 'SR-2026-1002',
    title: 'Smoke from Sector 14 transformer',
    description: 'Electrical sparks and heavy smoke near Sector 14',
    latitude: 28.6291,
    longitude: 77.2198,
    reportedAt: '2026-11-10T08:20:00.000Z',
  };

  const dupes = findPotentialDuplicates(baseIncident, [baseIncident, candidate]);
  assert.equal(dupes.length, 1);
  assert.equal(dupes[0].incidentId, 'SR-2026-1002');
  assert.ok(dupes[0].similarityScore >= 50);
});

test('prevents ordinary General Volunteer from being assigned to Building Collapse', () => {
  const collapseIncident: IncidentRecord = {
    ...baseIncident,
    category: 'Building Collapse',
    severity: 'Critical',
  };
  const generalVol: ResponderProfile = {
    id: 'RES-1',
    name: 'A. Kumar',
    qualification: 'General Volunteer',
    verified: true,
    available: true,
  };
  const specialist: ResponderProfile = {
    id: 'RES-2',
    name: 'S. Nair',
    qualification: 'Structural Rescue Specialist',
    verified: true,
    available: true,
  };

  assert.equal(isResponderEligible(generalVol, collapseIncident), false);
  assert.equal(isResponderEligible(specialist, collapseIncident), true);
});

test('flags assignment escalation when pending beyond threshold', () => {
  const assigned: IncidentRecord = {
    ...baseIncident,
    assignedResponderId: 'RES-2',
    assignedAt: '2026-11-10T08:00:00.000Z',
    escalationThresholdMinutes: 15,
  };
  const twentyMinsLater = new Date('2026-11-10T08:20:00.000Z').getTime();
  const res = isAssignmentEscalated(assigned, twentyMinsLater);
  assert.equal(res.escalated, true);
  assert.equal(res.pendingMinutes, 20);
});

test('computes verification, assignment, acceptance, and response metrics from real timestamps', () => {
  const inc: IncidentRecord = {
    ...baseIncident,
    status: 'Resolved',
    reportedAt: '2026-11-10T08:00:00.000Z',
    verifiedAt: '2026-11-10T08:05:00.000Z',
    assignedAt: '2026-11-10T08:10:00.000Z',
    acceptedAt: '2026-11-10T08:15:00.000Z',
    resolvedAt: '2026-11-10T09:00:00.000Z',
  };

  const metrics = computePerformanceMetrics([inc]);
  assert.equal(metrics.avgVerificationMinutes, 5);
  assert.equal(metrics.avgAssignmentMinutes, 10);
  assert.equal(metrics.avgAcceptanceMinutes, 5);
  assert.equal(metrics.avgResponseMinutes, 60);
});
