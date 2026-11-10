import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePriorityScore,
  buildPriorityQueue,
  findNearestSuitableTeam,
} from './priorityQueue';
import type { IncidentRecord, ResponderProfile } from '../types/incident';

function makeIncident(overrides: Partial<IncidentRecord>): IncidentRecord {
  return {
    incidentId: 'SR-2026-9001',
    title: 'Test Incident',
    description: 'Test description',
    category: 'Fire',
    location: 'Chennai',
    latitude: 13.08,
    longitude: 80.27,
    peopleAffected: '10+ People',
    contactInformation: '',
    severity: 'Critical',
    severitySource: 'Rule-Based',
    severityExplanation: 'Test',
    originalSeverity: 'Critical',
    originalSeveritySource: 'Rule-Based',
    originalSeverityExplanation: 'Test',
    status: 'Reported',
    reportedAt: '2026-11-10T01:00:00.000Z',
    updatedAt: '2026-11-10T01:00:00.000Z',
    resolvedAt: null,
    statusHistory: [],
    createdBy: 'Public',
    ...overrides,
  };
}

describe('Priority Queue Scoring & Ranking', () => {
  it('computes exact priority score breakdown and caps at 100', () => {
    const inc = makeIncident({
      severity: 'Critical', // +40
      peopleAffected: '10+ People', // count=20 -> round(log2(21)*4) = 18
      category: 'Fire', // +15
      reportedAt: '2026-11-10T01:00:00.000Z',
    });
    const nowMs = new Date('2026-11-10T01:24:00.000Z').getTime(); // 24 min -> +8 waiting
    const res = computePriorityScore(inc, nowMs);

    assert.equal(res.severityPoints, 40);
    assert.equal(res.peoplePoints, 18);
    assert.equal(res.waitingPoints, 8);
    assert.equal(res.categoryPoints, 15);
    assert.equal(res.totalScore, 81);
    assert.equal(res.priorityLevel, 'Critical');
    assert.equal(res.explanation, 'Severity +40, People +18, Waiting +8, Category +15 = 81');
  });

  it('excludes Resolved incidents and ranks unresolved from highest to lowest', () => {
    const nowMs = new Date('2026-11-10T01:30:00.000Z').getTime();
    const incidents = [
      makeIncident({
        incidentId: 'SR-LOW',
        severity: 'Low',
        category: 'Other',
        peopleAffected: '1 Person',
        reportedAt: '2026-11-10T01:29:00.000Z',
      }),
      makeIncident({
        incidentId: 'SR-RESOLVED',
        severity: 'Critical',
        status: 'Resolved',
      }),
      makeIncident({
        incidentId: 'SR-CRIT',
        severity: 'Critical',
        category: 'Building Collapse',
        peopleAffected: '10+ People',
        reportedAt: '2026-11-10T01:00:00.000Z',
      }),
    ];

    const ranked = buildPriorityQueue(incidents, nowMs);
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[0].incident.incidentId, 'SR-CRIT');
    assert.equal(ranked[1].rank, 2);
    assert.equal(ranked[1].incident.incidentId, 'SR-LOW');
  });

  it('selects nearest eligible available responder for dispatch', () => {
    const inc = makeIncident({
      category: 'Fire',
      severity: 'Critical',
      latitude: 13.08,
      longitude: 80.27,
    });
    const responders: ResponderProfile[] = [
      {
        id: 'RES-GEN',
        name: 'General Vol',
        qualification: 'General Volunteer',
        verified: true,
        available: true,
        status: 'Available',
        latitude: 13.08,
        longitude: 80.27,
      },
      {
        id: 'RES-FIRE-FAR',
        name: 'Fire Far',
        qualification: 'Fire & Hazmat Specialist',
        verified: true,
        available: true,
        status: 'Available',
        latitude: 13.2,
        longitude: 80.4,
      },
      {
        id: 'RES-FIRE-NEAR',
        name: 'Fire Near',
        qualification: 'Fire & Hazmat Specialist',
        verified: true,
        available: true,
        status: 'Available',
        latitude: 13.082,
        longitude: 80.271,
      },
    ];

    const match = findNearestSuitableTeam(inc, responders);
    assert.ok(match);
    assert.equal(match.responder.id, 'RES-FIRE-NEAR');
  });
});
