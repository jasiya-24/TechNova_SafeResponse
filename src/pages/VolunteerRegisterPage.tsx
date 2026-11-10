import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { useAuth } from '../context/AuthContext';

const QUALIFICATIONS = [
  'General Volunteer',
  'Medical First Aid',
  'Fire & Hazmat Specialist',
  'Structural Rescue Specialist',
];

export function VolunteerRegisterPage() {
  const { admin, registerVolunteer } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [qualification, setQualification] = useState('General Volunteer');
  const [skills, setSkills] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (admin?.role === 'Volunteer') {
      navigate('/volunteer', { replace: true });
    }
  }, [admin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError('Full name is required.');
      return;
    }
    if (!email.trim().includes('@')) {
      setError('A valid email address is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    const res = await registerVolunteer({
      name: name.trim(),
      email: email.trim(),
      password,
      qualification,
      skills: skills.trim(),
      location: location.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Volunteer registration failed.');
      return;
    }
    navigate('/volunteer');
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white rounded-2xl border border-[#D9E2E6] p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-[#E5EEE9] text-[#5D9678] flex items-center justify-center">
              <UserPlus className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-[#263640]">Volunteer Registration</h1>
            <p className="text-sm text-[#71818A]">
              Register as a SafeResponse volunteer. Administrators will verify your credentials before assigning specialist field tasks.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-lg bg-[#D9534F]/10 border border-[#D9534F]/30 text-sm text-[#962825]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="vol-name" className="block text-sm font-semibold text-[#263640]">
                Full Name
              </label>
              <input
                id="vol-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Priya Nair"
                required
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vol-email" className="block text-sm font-semibold text-[#263640]">
                Email Address
              </label>
              <input
                id="vol-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="volunteer@example.com"
                required
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vol-password" className="block text-sm font-semibold text-[#263640]">
                Password
              </label>
              <input
                id="vol-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vol-qual" className="block text-sm font-semibold text-[#263640]">
                Qualification
              </label>
              <select
                id="vol-qual"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                className="w-full rounded-lg border border-[#C5D2D8] bg-white px-3.5 py-2.5 text-sm text-[#263640]"
              >
                {QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vol-skills" className="block text-sm font-semibold text-[#263640]">
                Skills (Comma-separated)
              </label>
              <input
                id="vol-skills"
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g., First Aid, Crowd Guidance, Relief Logistics"
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vol-location" className="block text-sm font-semibold text-[#263640]">
                Base District / Area
              </label>
              <input
                id="vol-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Chennai Central"
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A] disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Creating Volunteer Profile...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Register as Volunteer</span>
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-center text-[#71818A] pt-3 border-t border-[#D9E2E6]">
            Already registered?{' '}
            <Link to="/admin/login" className="font-semibold text-[#426B80] hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
