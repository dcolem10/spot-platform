import { Navigate } from 'react-router-dom';
import { flags, type FeatureFlagKey } from '../lib/featureFlags';

interface FeatureGateProps {
  flag: FeatureFlagKey;
  children: React.ReactNode;
  fallback?: string;
}

export function FeatureGate({ flag: flagKey, children, fallback = '/app/dashboard' }: FeatureGateProps) {
  if (!flags[flagKey]) {
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}
