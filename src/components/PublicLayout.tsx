import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Menu, X, PhoneCall, Wifi, WifiOff, Globe, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGE_LABELS, type AppLanguage } from '../utils/i18n';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { lang, setLang, t, isOnline } = useLanguage();

  const navLinks = [
    { to: '/', label: t('nav.home', 'Home') },
    { to: '/sos', label: t('nav.sos', 'SOS Quick Report') },
    { to: '/report', label: t('nav.report', 'Report Emergency') },
    { to: '/track', label: t('nav.track', 'Track Report') },
    { to: '/citizen/login', label: 'Citizen Portal' },
    { to: '/admin/login', label: t('nav.admin', 'Admin Login') },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F7F8] text-[#263640]">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#D9E2E6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand wordmark */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#263640] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#426B80]"
          >
            <span className="w-8 h-8 rounded-lg bg-[#426B80] text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </span>
            <span>SafeResponse</span>
          </Link>

          {/* Zone 2: Concise single-line navigation links */}
          <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-5">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#426B80] ${
                  isActive(link.to)
                    ? 'border-[#426B80] text-[#263640]'
                    : link.to === '/sos'
                    ? 'border-transparent text-[#962825] hover:border-[#D9534F]'
                    : 'border-transparent text-[#71818A] hover:text-[#263640] hover:border-[#C5D2D8]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Zone 3: Language Switcher, Connection Status & Primary CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium whitespace-nowrap ${
                isOnline
                  ? 'bg-[#E5EEE9] border-[#5D9678]/30 text-[#2E5A44]'
                  : 'bg-[#E8AD52]/15 border-[#E8AD52]/40 text-[#7A5011]'
              }`}
              title={isOnline ? t('conn.online') : t('conn.offline')}
            >
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{isOnline ? t('conn.online', 'Online') : 'Offline'}</span>
            </span>

            <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[#D9E2E6] bg-white text-xs text-[#263640]">
              <Globe className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
              <span className="sr-only">Language</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as AppLanguage)}
                aria-label="Select language"
                className="bg-transparent text-xs font-medium text-[#263640] focus:outline-none cursor-pointer"
              >
                {(Object.keys(LANGUAGE_LABELS) as AppLanguage[]).map((code) => (
                  <option key={code} value={code}>
                    {LANGUAGE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>

            <Link
              to="/sos"
              className="hidden sm:inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#D9534F] text-white text-xs font-semibold hover:bg-[#B83E3A] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9534F]"
            >
              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>SOS</span>
            </Link>

            <Link
              to="/report"
              className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 rounded-lg bg-[#426B80] text-white text-sm font-medium hover:bg-[#35586A] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#426B80]"
            >
              {t('hero.cta', 'Report an Emergency')}
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-[#263640] hover:bg-[#F3F7F8] focus-visible:outline-2 focus-visible:outline-[#426B80]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="lg:hidden border-t border-[#D9E2E6] bg-white px-4 py-3 space-y-1"
          >
            <div className="px-3 py-1.5 text-xs font-medium text-[#71818A] flex items-center gap-1.5">
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-[#5D9678]" aria-hidden="true" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-[#B47A1E]" aria-hidden="true" />
              )}
              <span>{isOnline ? t('conn.online') : t('conn.offline')}</span>
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive(link.to)
                    ? 'bg-[#E5EEE9] text-[#263640]'
                    : 'text-[#71818A] hover:bg-[#F3F7F8] hover:text-[#263640]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t border-[#D9E2E6] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <div className="bg-[#F3F7F8] border border-[#D9E2E6] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#263640]">
                Important Emergency Notice
              </p>
              <p className="text-sm text-[#71818A] leading-relaxed max-w-3xl">
                SafeResponse is a demonstration platform and is not connected to official emergency dispatch services. In a real emergency, contact your local emergency services directly. Submitting a report does not guarantee immediate assistance.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-3 bg-white border border-[#D9E2E6] rounded-lg px-4 py-3">
              <PhoneCall className="w-5 h-5 text-[#426B80]" aria-hidden="true" />
              <div>
                <p className="text-xs text-[#71818A]">India National Emergency</p>
                <p className="text-base font-bold text-[#263640] tabular-nums">Dial 112 Directly</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 text-sm text-[#71818A]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#263640]">SafeResponse</span>
              <span aria-hidden="true">·</span>
              <span>Smart Emergency Response & Disaster Management Platform</span>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Link to="/" className="hover:text-[#263640] transition-colors">
                Home
              </Link>
              <Link to="/report" className="hover:text-[#263640] transition-colors">
                Report Emergency
              </Link>
              <Link to="/track" className="hover:text-[#263640] transition-colors">
                Track Report
              </Link>
              <Link to="/admin/login" className="hover:text-[#263640] transition-colors">
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
