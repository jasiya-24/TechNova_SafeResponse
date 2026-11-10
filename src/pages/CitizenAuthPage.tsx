import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Loader2, UserPlus, LogIn } from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { useAuth } from '../context/AuthContext';

export function CitizenAuthPage() {
  const { admin, login, registerCitizen } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (admin) {
      if (admin.role === 'Citizen') {
        navigate('/citizen', { replace: true });
      } else if (admin.role === 'Volunteer') {
        navigate('/volunteer', { replace: true });
      } else {
        navigate('/admin', { replace: true });
      }
    }
  }, [admin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }
      if (!email.trim().includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      setSubmitting(true);
      const res = await registerCitizen({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
      });
      setSubmitting(false);
      if (!res.ok) {
        setError(res.error || 'Registration failed.');
        return;
      }
      navigate('/citizen');
      return;
    }

    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Invalid email or password.');
      return;
    }
    if (res.user?.role === 'Citizen') {
      navigate('/citizen');
    } else if (res.user?.role === 'Volunteer') {
      navigate('/volunteer');
    } else {
      navigate('/admin');
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white rounded-2xl border border-[#D9E2E6] p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-[#E5EEE9] text-[#426B80] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-[#263640]">
              {mode === 'login' ? 'Citizen Login' : 'Citizen Registration'}
            </h1>
            <p className="text-sm text-[#71818A]">
              Access your Citizen Dashboard to report emergencies, share live location with consent, and track response updates.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-[#F3F7F8] p-1 rounded-lg border border-[#D9E2E6]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                mode === 'login' ? 'bg-white text-[#263640] shadow-xs' : 'text-[#71818A]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                mode === 'register' ? 'bg-white text-[#263640] shadow-xs' : 'text-[#71818A]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Create Account</span>
            </button>
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
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label htmlFor="citizen-name" className="block text-sm font-semibold text-[#263640]">
                  Full Name
                </label>
                <input
                  id="citizen-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640]"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="citizen-email" className="block text-sm font-semibold text-[#263640]">
                Email Address
              </label>
              <input
                id="citizen-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="citizen-password" className="block text-sm font-semibold text-[#263640]">
                Password
              </label>
              <input
                id="citizen-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'login' ? 'Enter your password' : 'Minimum 6 characters'}
                required
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640]"
              />
            </div>

            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="citizen-phone" className="block text-xs font-semibold text-[#263640]">
                    Phone (Optional)
                  </label>
                  <input
                    id="citizen-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98XXX XXXXX"
                    className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="citizen-city" className="block text-xs font-semibold text-[#263640]">
                    City / Ward (Optional)
                  </label>
                  <input
                    id="citizen-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g., Chennai"
                    className="w-full rounded-lg border border-[#C5D2D8] px-3 py-2 text-sm text-[#263640]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#426B80] text-white text-sm font-semibold hover:bg-[#35586A] disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Please wait...</span>
                </>
              ) : (
                <span>{mode === 'login' ? 'Sign In to Citizen Dashboard' : 'Register & Open Dashboard'}</span>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#D9E2E6] space-y-3">
            <p className="text-xs text-center text-[#71818A]">
              Need immediate help without signing in?{' '}
              <Link to="/sos" className="font-semibold text-[#962825] hover:underline">
                Send SOS Quick Report
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
