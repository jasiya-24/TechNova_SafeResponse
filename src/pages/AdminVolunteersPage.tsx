import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, CheckCircle2, Users, Loader2, MapPin } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import type { ResponderProfile, ResponseTeam } from '../types/incident';

export function AdminVolunteersPage() {
  const [volunteers, setVolunteers] = useState<ResponderProfile[]>([]);
  const [teams, setTeams] = useState<ResponseTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [volRes, teamRes] = await Promise.all([
        fetch('/api/admin/responders', { credentials: 'include' }),
        fetch('/api/admin/teams', { credentials: 'include' }),
      ]);
      if (volRes.ok) {
        const d = (await volRes.json()) as { responders: ResponderProfile[] };
        setVolunteers(d.responders || []);
      }
      if (teamRes.ok) {
        const d = (await teamRes.json()) as { teams: ResponseTeam[] };
        setTeams(d.teams || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const toggleVerifyVolunteer = async (vol: ResponderProfile) => {
    setBusyId(vol.id);
    try {
      const res = await fetch(`/api/admin/volunteers/${encodeURIComponent(vol.id)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ verified: !vol.verified }),
      });
      if (res.ok) {
        await loadAll();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout title="Volunteers & Response Teams">
      <div className="space-y-8">
        {loading ? (
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-8 text-center text-sm text-[#71818A]">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" aria-hidden="true" />
            Loading volunteers and response teams...
          </div>
        ) : (
          <>
            {/* Response Teams */}
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#263640] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#426B80]" aria-hidden="true" />
                  <span>Response Teams ({teams.length})</span>
                </h2>
                <p className="text-xs text-[#71818A]">
                  Specialized emergency response units available for incident dispatch.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((t) => (
                  <div
                    key={t.teamId}
                    className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#426B80]">{t.teamId}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          t.status === 'Available'
                            ? 'bg-[#E5EEE9] text-[#2E5A44]'
                            : t.status === 'Deployed'
                              ? 'bg-[#E8AD52]/20 text-[#7A5011]'
                              : 'bg-[#F3F7F8] text-[#71818A]'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-[#263640]">{t.teamName}</h3>
                    <p className="text-xs text-[#71818A]">{t.specialization}</p>
                    <div className="text-xs text-[#263640] pt-1 border-t border-[#F3F7F8] flex items-center justify-between">
                      <span>Lead: {t.leadName} ({t.memberCount} members)</span>
                      <span className="text-[#71818A]">{t.district}</span>
                    </div>
                    {t.assignedIncidents.length > 0 && (
                      <p className="text-xs font-mono text-[#426B80]">
                        Assigned: {t.assignedIncidents.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Registered Volunteers */}
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#263640]">
                  Registered Volunteers ({volunteers.length})
                </h2>
                <p className="text-xs text-[#71818A]">
                  Verify volunteer credentials and monitor skills, location, availability, and task completion.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {volunteers.map((v) => (
                  <div
                    key={v.id}
                    className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-semibold text-[#426B80]">{v.id}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              v.available
                                ? 'bg-[#E5EEE9] text-[#2E5A44]'
                                : 'bg-[#E8AD52]/20 text-[#7A5011]'
                            }`}
                          >
                            {v.available ? 'Available' : 'Busy'}
                          </span>
                          {v.isDemo && (
                            <span className="text-[11px] text-[#71818A] font-semibold">SAMPLE</span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-[#263640] mt-0.5">{v.name}</h3>
                        <p className="text-xs text-[#71818A]">{v.qualification}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === v.id}
                        onClick={() => toggleVerifyVolunteer(v)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          v.verified
                            ? 'bg-[#E5EEE9] text-[#2E5A44] hover:bg-[#D7E6DD]'
                            : 'bg-[#426B80] text-white hover:bg-[#35586A]'
                        }`}
                      >
                        {v.verified ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Verified</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Verify Volunteer</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(v.skills || [v.qualification]).map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded-md bg-[#F3F7F8] border border-[#D9E2E6] text-[11px] text-[#263640]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#71818A] pt-2 border-t border-[#F3F7F8]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        {v.location || 'Central District'}
                      </span>
                      <span className="tabular-nums">
                        Assigned: <strong className="text-[#263640]">{v.assignedTasksCount ?? 0}</strong> ·
                        Completed: <strong className="text-[#2E5A44]">{v.completedTasksCount ?? 0}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
