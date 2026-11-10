import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Map as MapIcon,
  BarChart3,
  History,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  ArrowLeft,
  Package,
  UserCheck,
  Wifi,
  WifiOff,
  Globe,
  Flame,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGE_LABELS, type AppLanguage } from '../utils/i18n';

export function AdminLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { admin, logout } = useAuth();
  const { lang, setLang, isOnline } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isVolunteer = admin?.role === 'Volunteer';

  const navItems = isVolunteer
    ? [
        { to: '/volunteer', label: 'Volunteer Portal', icon: UserCheck },
      ]
    : [
        { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/priority-queue', label: 'Priority Queue', icon: Flame },
        { to: '/admin/incidents', label: 'Incident Management', icon: ClipboardList },
        { to: '/admin/citizens', label: 'Citizen Profiles', icon: Users },
        { to: '/admin/volunteers', label: 'Volunteers & Teams', icon: ShieldAlert },
        { to: '/admin/resources', label: 'Resources', icon: Package },
        { to: '/admin/map', label: 'Incident Map', icon: MapIcon },
        { to: '/admin/analytics', label: 'Analytics & Reports', icon: BarChart3 },
        { to: '/admin/activity', label: 'Activity Log', icon: History },
      ];

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#D9E2E6]">
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#D9E2E6]">
        <Link
          to="/admin"
          className="flex items-center gap-2.5 font-bold text-[#263640] whitespace-nowrap"
        >
          <span className="w-8 h-8 rounded-lg bg-[#426B80] text-white flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          </span>
          <span>SafeResponse</span>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden p-2 rounded-lg text-[#71818A] hover:bg-[#F3F7F8]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="Administrator navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#426B80] text-white'
                  : 'text-[#263640] hover:bg-[#F3F7F8]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#D9E2E6] space-y-1">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#71818A] hover:bg-[#F3F7F8] hover:text-[#263640] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Public Home</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#962825] hover:bg-[#D9534F]/10 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F3F7F8] text-[#263640]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#263640]/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-[#D9E2E6] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open administrator menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-[#263640] hover:bg-[#F3F7F8]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-[#263640] truncate">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-3 text-sm shrink-0">
            <span
              className={`hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${
                isOnline
                  ? 'bg-[#E5EEE9] border-[#5D9678]/30 text-[#2E5A44]'
                  : 'bg-[#E8AD52]/15 border-[#E8AD52]/40 text-[#7A5011]'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" aria-hidden="true" /> : <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </span>

            <label className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#D9E2E6] bg-white text-xs text-[#263640]">
              <Globe className="w-3.5 h-3.5 text-[#426B80]" aria-hidden="true" />
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

            <span className="hidden xl:inline text-[#71818A] tabular-nums">{todayFormatted}</span>
            <span className="hidden xl:inline text-[#D9E2E6]" aria-hidden="true">
              |
            </span>
            <div className="text-right">
              <p className="font-medium text-[#263640] leading-tight whitespace-nowrap">
                {admin?.name || 'Administrator'}
              </p>
              <p className="text-xs text-[#71818A] hidden md:block">
                {admin?.role || 'Operations'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9E2E6] text-xs font-medium text-[#263640] hover:bg-[#F3F7F8] transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
