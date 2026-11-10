import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Loader2, UserPlus, Users } from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout';
import { useAuth } from '../context/AuthContext';

export function AdminLoginPage() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Authentication failed.');
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

  const handleDemoLogin = async (role: 'Admin' | 'Volunteer') => {
    setError('');
    setSubmitting(true);
    const demoEmail =
      role === 'Admin' ? 'coordinator@saferesponse.demo' : 'volunteer@saferesponse.demo';
    const res = await login(demoEmail, 'SafeResponse@2026');
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Demo login failed.');
      return;
    }
    navigate(role === 'Volunteer' ? '/volunteer' : '/admin');
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white rounded-2xl border border-[#D9E2E6] p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-[#E5EEE9] text-[#426B80] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-[#263640]">Admin &amp; Responder Login</h1>
            <p className="text-sm text-[#71818A]">
              Sign in with your Administrator, Emergency Coordinator, or Volunteer account credentials.
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
              <label htmlFor="admin-email" className="block text-sm font-semibold text-[#263640]">
                Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coordinator@saferesponse.demo"
                required
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80] focus:border-[#426B80]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="block text-sm font-semibold text-[#263640]">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full rounded-lg border border-[#C5D2D8] px-3.5 py-2.5 text-sm text-[#263640] focus:outline-none focus:ring-2 focus:ring-[#426B80] focus:border-[#426B80]"
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
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          {/* Role-Based Demo Access (Admin & Volunteer) */}
          <div className="pt-4 border-t border-[#D9E2E6] space-y-2.5">
            <p className="text-xs font-semibold text-[#71818A]">
              Quick Demo Mode Login
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDemoLogin('Admin')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#426B80]/10 border border-[#426B80]/30 text-xs font-semibold text-[#426B80] hover:bg-[#426B80]/15 disabled:opacity-60 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Admin Demo Login</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDemoLogin('Volunteer')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#E5EEE9] border border-[#C6D8CE] text-xs font-semibold text-[#2E5A44] hover:bg-[#D7E6DD] disabled:opacity-60 transition-colors"
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Volunteer Demo Login</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-[#F3F7F8] space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Link
                to="/citizen/login"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#E5EEE9] border border-[#C6D8CE] text-xs font-semibold text-[#263640] hover:bg-[#D7E6DD] transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
                <span>Citizen Portal</span>
              </Link>
              <Link
                to="/volunteer/register"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#F3F7F8] border border-[#D9E2E6] text-xs font-semibold text-[#263640] hover:bg-[#E5EEE9] transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#5D9678]" aria-hidden="true" />
                <span>Volunteer Registration</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
