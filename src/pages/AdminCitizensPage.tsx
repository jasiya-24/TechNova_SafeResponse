import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, ShieldCheck, CheckCircle2, HeartPulse, PhoneCall, Loader2 } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import type { CitizenProfile } from '../types/incident';

export function AdminCitizensPage() {
  const [citizens, setCitizens] = useState<CitizenProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadCitizens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/citizens', { credentials: 'include' });
      const data = (await res.json()) as { citizens?: CitizenProfile[]; error?: string };
      if (!res.ok) {
        setError(data.error || 'Unable to load citizen profiles.');
      } else {
        setCitizens(data.citizens || []);
        setError('');
      }
    } catch {
      setError('Network error loading citizens.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCitizens();
  }, [loadCitizens]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return citizens;
    return citizens.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.citizenId.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        c.locality.toLowerCase().includes(q) ||
        c.mobileNumber.toLowerCase().includes(q)
    );
  }, [citizens, search]);

  const toggleVerify = async (citizen: CitizenProfile) => {
    setBusyId(citizen.citizenId);
    try {
      const res = await fetch(
        `/api/admin/citizens/${encodeURIComponent(citizen.citizenId)}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ verified: !citizen.verified }),
        }
      );
      if (res.ok) {
        await loadCitizens();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout title="Citizen Profiles & Verification">
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-[#D9E2E6] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#263640]">
              Registered Citizens ({citizens.length})
            </h2>
            <p className="text-xs text-[#71818A]">
              Review citizen emergency contacts, medical alerts, special assistance needs, and verify profiles.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              className="w-4 h-4 text-[#71818A] absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, district..."
              aria-label="Search citizens"
              className="w-full rounded-lg border border-[#C5D2D8] pl-9 pr-3 py-2 text-sm text-[#263640]"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="p-4 rounded-xl bg-[#D9534F]/10 border border-[#D9534F]/30 text-sm text-[#962825]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-[#D9E2E6] p-8 text-center text-sm text-[#71818A]">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" aria-hidden="true" />
            Loading citizen profiles...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <div
                key={c.citizenId}
                className="bg-white rounded-xl border border-[#D9E2E6] p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-[#426B80]">{c.citizenId}</span>
                      {c.isDemo && (
                        <span className="px-1.5 py-0.5 rounded bg-[#F3F7F8] text-[#71818A] font-semibold">
                          SAMPLE DATA
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[#263640] mt-0.5">{c.fullName}</h3>
                    <p className="text-xs text-[#71818A]">
                      Age {c.age} · {c.locality ? `${c.locality}, ` : ''}
                      {c.district}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === c.citizenId}
                    onClick={() => toggleVerify(c)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      c.verified
                        ? 'bg-[#E5EEE9] text-[#2E5A44] hover:bg-[#D7E6DD]'
                        : 'bg-[#426B80] text-white hover:bg-[#35586A]'
                    }`}
                  >
                    {c.verified ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Verified</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Verify Citizen</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#F3F7F8] rounded-lg p-3">
                  <div>
                    <span className="text-[#71818A]">Mobile:</span>{' '}
                    <span className="font-mono font-medium text-[#263640]">{c.mobileNumber || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <PhoneCall className="w-3 h-3 text-[#426B80]" aria-hidden="true" />
                    <span className="text-[#71818A]">ICE:</span>{' '}
                    <span className="text-[#263640] truncate">
                      {c.emergencyContact?.name
                        ? `${c.emergencyContact.name} (${c.emergencyContact.phone})`
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="sm:col-span-2 flex items-start gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-[#D9534F] shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="text-[#263640]">
                      Blood <strong>{c.medicalInfo?.bloodGroup || 'Unknown'}</strong> · Allergies:{' '}
                      {c.medicalInfo?.allergies || 'None'} · Conditions:{' '}
                      {c.medicalInfo?.conditions || 'None'}
                    </span>
                  </div>
                </div>

                {c.specialAssistance && c.specialAssistance !== 'None' && (
                  <p className="text-xs text-[#7A5011] bg-[#E8AD52]/15 rounded-lg px-3 py-2 font-medium">
                    Special Assistance: {c.specialAssistance}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
