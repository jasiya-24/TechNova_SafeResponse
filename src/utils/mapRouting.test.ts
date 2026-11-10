import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistanceKm,
  isVolunteerEligibleForTask,
  recommendTeamsForIncident,
} from './mapRouting';
import type { ResponderProfile, ResponseTeam } from '../types/incident';

test('haversineDistanceKm calculates realistic distance between two Delhi coordinates', () => {
  const d = haversineDistanceKm(28.6289, 77.2195, 28.6122, 77.2341);
  assert.ok(d > 2.0 && d < 3.0, `Expected ~2.34 km, got ${d}`);
  assert.equal(haversineDistanceKm(28.62, 77.22, 28.62, 77.22), 0);
});

test('recommendTeamsForIncident prioritizes available specialist teams closest to incident', () => {
  const teams: ResponseTeam[] = [
    {
      teamId: 'T-BUSY-FIRE',
      teamName: 'Busy Fire Team',
      teamType: 'Fire',
      specialization: 'Fire',
      leadName: 'A',
      assignedIncidents: ['SR-1'],
      available: false,
      status: 'Deployed',
      memberCount: 5,
      district: 'Central',
      latitude: 28.629,
      longitude: 77.22,
    },
    {
      teamId: 'T-AVAIL-RESCUE',
      teamName: 'Available Rescue Team',
      teamType: 'Rescue',
      specialization: 'Rescue',
      leadName: 'B',
      assignedIncidents: [],
      available: true,
      status: 'Available',
      memberCount: 6,
      district: 'Central',
      latitude: 28.62,
      longitude: 77.21,
    },
    {
      teamId: 'T-AVAIL-FIRE',
      teamName: 'Available Fire Team',
      teamType: 'Fire',
      specialization: 'Fire',
      leadName: 'C',
      assignedIncidents: [],
      available: true,
      status: 'Available',
      memberCount: 6,
      district: 'Central',
      latitude: 28.63,
      longitude: 77.218,
    },
  ];

  const ranked = recommendTeamsForIncident(
    { category: 'Fire', latitude: 28.6289, longitude: 77.2195 },
    teams
  );
  assert.equal(ranked[0].team.teamId, 'T-AVAIL-FIRE');
  assert.equal(ranked[1].team.teamId, 'T-AVAIL-RESCUE');
  assert.equal(ranked[2].team.teamId, 'T-BUSY-FIRE');
});

test('isVolunteerEligibleForTask enforces verification and qualification safety gates', () => {
  const unverified: Pick<ResponderProfile, 'verified' | 'qualification' | 'skills'> = {
    verified: false,
    qualification: 'General Volunteer',
    skills: ['Relief Distribution'],
  };
  const verifiedGeneral: Pick<ResponderProfile, 'verified' | 'qualification' | 'skills'> = {
    verified: true,
    qualification: 'General Volunteer',
    skills: ['Relief Distribution'],
  };
  const verifiedMed: Pick<ResponderProfile, 'verified' | 'qualification' | 'skills'> = {
    verified: true,
    qualification: 'Medical First Aid',
    skills: ['Triage'],
  };

  assert.equal(
    isVolunteerEligibleForTask(unverified, {
      requiredQualification: 'General Volunteer',
      requiredSkills: ['Relief Distribution'],
    }),
    false
  );
  assert.equal(
    isVolunteerEligibleForTask(verifiedGeneral, {
      requiredQualification: 'General Volunteer',
      requiredSkills: ['Relief Distribution'],
    }),
    true
  );
  assert.equal(
    isVolunteerEligibleForTask(verifiedGeneral, {
      requiredQualification: 'Medical First Aid',
      requiredSkills: ['Triage'],
    }),
    false
  );
  assert.equal(
    isVolunteerEligibleForTask(verifiedMed, {
      requiredQualification: 'Medical First Aid',
      requiredSkills: ['Triage'],
    }),
    true
  );
});
