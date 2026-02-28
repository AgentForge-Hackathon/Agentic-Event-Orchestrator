import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireOnboarding?: boolean;
};

export function ProtectedRoute({
  children,
  requireOnboarding = true,
}: ProtectedRouteProps) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireOnboarding && !user.isOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
