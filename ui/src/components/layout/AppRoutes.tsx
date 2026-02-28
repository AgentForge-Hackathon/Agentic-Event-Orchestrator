import { Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Index } from '@/pages/Index';
import { AboutPage } from '@/pages/AboutPage';
import { EventsPage } from '@/pages/EventsPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlanPage } from '@/pages/PlanPage';
import { ItinerariesPage } from '@/pages/ItinerariesPage';
import { NotFound } from '@/pages/NotFound';

export function AppRoutes() {
  const location = useLocation();

  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<Index />} />
      <Route path="/about" element={<div className="animate-in fade-in"><AboutPage /></div>} />
      <Route path="/events" element={<div className="animate-in fade-in"><EventsPage /></div>} />
      <Route path="/login" element={<div className="animate-in fade-in"><LoginPage /></div>} />
      <Route path="/signup" element={<div className="animate-in fade-in"><SignupPage /></div>} />
      <Route
        path="/onboarding"
        element={
          <div className="animate-in fade-in">
            <ProtectedRoute requireOnboarding={false}>
              <OnboardingPage />
            </ProtectedRoute>
          </div>
        }
      />
      <Route
        path="/dashboard"
        element={
          <div className="animate-in fade-in">
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          </div>
        }
      />
      <Route
        path="/plan"
        element={
          <div className="animate-in fade-in">
            <ProtectedRoute>
              <PlanPage />
            </ProtectedRoute>
          </div>
        }
      />
      <Route
        path="/itineraries"
        element={
          <div className="animate-in fade-in">
            <ProtectedRoute>
              <ItinerariesPage />
            </ProtectedRoute>
          </div>
        }
      />
      <Route path="*" element={<div className="animate-in fade-in"><NotFound /></div>} />
    </Routes>
  );
}
