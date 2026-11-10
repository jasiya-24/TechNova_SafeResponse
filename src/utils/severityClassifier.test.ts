import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIncidentRuleBased,
  computeIncidentAnalytics,
  incidentsToCsv,
} from './severityClassifier';
import type { IncidentRecord } from '../types/incident';

test('classifies life-threatening collapse as Critical', () => {
  const res = classifyIncidentRuleBased({
    title: 'Partial roof collapse at warehouse',
    description: 'Several workers trapped under debris, structural failure and severe bleeding reported.',
    category: 'Building Collapse',
    peopleAffected: '10+ People',
  });
  assert.equal(res.severity, 'Critical');
});

test('does not reduce risk when peopleAffected is Unknown', () => {
  const res = classifyIncidentRuleBased({
    title: 'Active fire spreading in residential block',
    description: 'Heavy smoke and flames spreading rapidly on third floor, ongoing hazard.',
    category: 'Fire',
    peopleAffected: 'Unknown',
  });
  assert.ok(res.severity === 'High' || res.severity === 'Critical');
});

test('returns Risk Assessment Pending when description is insufficient', () => {
  const res = classifyIncidentRuleBased({
    title: 'Help',
    description: 'Need help',
    category: 'Other',
    peopleAffected: 'Unknown',
  });
  assert.equal(res.severity, 'Risk Assessment Pending');
});

test('does not classify minor contained fire with no injuries as High', () => {
  const res = classifyIncidentRuleBased({
    title: 'Small contained trash bin fire',
    description: 'Minor smoke in alley, already contained with no injuries and everyone safe.',
    category: 'Fire',
    peopleAffected: '1 Person',
  });
  assert.equal(res.severity, 'Low');
});

test('computes analytics and average resolution time only from valid resolved timestamps', () => {
  const base: Omit<IncidentRecord, 'incidentId' | 'status' | 'severity' | 'reportedAt' | 'resolvedAt'> = {
    title: 'Test',
    description: 'Test description here',
    category: 'Flood',
    location: 'Sector 4',
    latitude: null,
    longitude: null,
    peopleAffected: '2–5 People',
    contactInformation: '',
    severitySource: 'Rule-Based',
    severityExplanation: 'Test',
    originalSeverity: 'High',
    originalSeveritySource: 'Rule-Based',
    originalSeverityExplanation: 'Test',
    updatedAt: '2026-11-01T12:00:00.000Z',
    statusHistory: [],
    createdBy: 'Public',
  };

  const records: IncidentRecord[] = [
    {
      ...base,
      incidentId: 'SR-1',
      status: 'Resolved',
      severity: 'High',
      reportedAt: '2026-11-01T10:00:00.000Z',
      resolvedAt: '2026-11-01T11:00:00.000Z',
    },
    {
      ...base,
      incidentId: 'SR-2',
      status: 'Resolved',
      severity: 'Low',
      reportedAt: '2026-11-01T10:00:00.000Z',
      resolvedAt: '2026-11-01T12:00:00.000Z',
    },
    {
      ...base,
      incidentId: 'SR-3',
      status: 'Pending',
      severity: 'Critical',
      reportedAt: '2026-11-01T10:00:00.000Z',
      resolvedAt: null,
    },
  ];

  const summary = computeIncidentAnalytics(records);
  assert.equal(summary.total, 3);
  assert.equal(summary.resolved, 2);
  assert.equal(summary.averageResolutionMinutes, 90);
});

test('escapes CSV cells and omits private contact info', () => {
  const csv = incidentsToCsv([
    {
      incidentId: 'SR-100',
      title: 'Fire near "North" Gate, Block B',
      description: 'Smoke',
      category: 'Fire',
      location: 'Block B, Sector 9',
      latitude: null,
      longitude: null,
      peopleAffected: '1 Person',
      contactInformation: 'secret@example.com',
      severity: 'Medium',
      severitySource: 'Rule-Based',
      severityExplanation: 'Test',
      originalSeverity: 'Medium',
      originalSeveritySource: 'Rule-Based',
      originalSeverityExplanation: 'Test',
      status: 'Reported',
      reportedAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
      resolvedAt: null,
      statusHistory: [],
      createdBy: 'Public',
      isDemo: true,
    },
  ]);

  assert.ok(csv.includes('"Fire near ""North"" Gate, Block B"'));
  assert.ok(!csv.includes('secret@example.com'));
});
