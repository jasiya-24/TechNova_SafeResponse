import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { HomePage } from './pages/HomePage';
import { ReportPage } from './pages/ReportPage';
import { SosPage } from './pages/SosPage';
import { TrackPage } from './pages/TrackPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminIncidentsPage } from './pages/AdminIncidentsPage';
import { AdminIncidentDetailPage } from './pages/AdminIncidentDetailPage';
import { AdminResourcesPage } from './pages/AdminResourcesPage';
import { AdminMapPage } from './pages/AdminMapPage';
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage';
import { AdminActivityPage } from './pages/AdminActivityPage';
import { AdminPriorityQueuePage } from './pages/AdminPriorityQueuePage';
import { AdminCitizensPage } from './pages/AdminCitizensPage';
import { AdminVolunteersPage } from './pages/AdminVolunteersPage';
import { VolunteerPortalPage } from './pages/VolunteerPortalPage';
import { VolunteerRegisterPage } from './pages/VolunteerRegisterPage';
import { CitizenAuthPage } from './pages/CitizenAuthPage';
import { CitizenDashboardPage } from './pages/CitizenDashboardPage';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F7F8] text-sm text-[#71818A]">
        Verifying session...
      </div>
    );
  }
  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }
  if (admin.role === 'Volunteer') {
    return <Navigate to="/volunteer" replace />;
  }
  if (admin.role === 'Citizen') {
    return <Navigate to="/citizen" replace />;
  }
  return <>{children}</>;
}

function RequireCitizen({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F7F8] text-sm text-[#71818A]">
        Verifying session...
      </div>
    );
  }
  if (!admin) {
    return <Navigate to="/citizen/login" replace />;
  }
  if (admin.role === 'Volunteer') {
    return <Navigate to="/volunteer" replace />;
  }
  if (admin.role !== 'Citizen') {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}

function RequireVolunteer({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F7F8] text-sm text-[#71818A]">
        Verifying session...
      </div>
    );
  }
  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }
  if (admin.role === 'Citizen') {
    return <Navigate to="/citizen" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/sos" element={<SosPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/track" element={<TrackPage />} />
            <Route path="/citizen/login" element={<CitizenAuthPage />} />
            <Route
              path="/citizen"
              element={
                <RequireCitizen>
                  <CitizenDashboardPage />
                </RequireCitizen>
              }
            />
            <Route path="/admin/login" element={<AdminLoginPage />} />

            <Route path="/volunteer/register" element={<VolunteerRegisterPage />} />

            {/* Volunteer Portal */}
            <Route
              path="/volunteer"
              element={
                <RequireVolunteer>
                  <VolunteerPortalPage />
                </RequireVolunteer>
              }
            />

            {/* Protected Administrator / Client Coordinator Routes */}
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminDashboardPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/priority-queue"
              element={
                <RequireAdmin>
                  <AdminPriorityQueuePage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/incidents"
              element={
                <RequireAdmin>
                  <AdminIncidentsPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/incidents/:id"
              element={
                <RequireAdmin>
                  <AdminIncidentDetailPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/citizens"
              element={
                <RequireAdmin>
                  <AdminCitizensPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/volunteers"
              element={
                <RequireAdmin>
                  <AdminVolunteersPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/resources"
              element={
                <RequireAdmin>
                  <AdminResourcesPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/map"
              element={
                <RequireAdmin>
                  <AdminMapPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RequireAdmin>
                  <AdminAnalyticsPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/activity"
              element={
                <RequireAdmin>
                  <AdminActivityPage />
                </RequireAdmin>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
