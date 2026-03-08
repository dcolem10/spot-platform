import { Suspense, lazy, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

/* ─── Error Boundary for 3D Scene ──────────────────────────────────────────── */

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches runtime errors from the Spline runtime (CDN down,
 * WebGL unsupported, scene load failure, etc.) and renders a
 * graceful fallback instead of crashing the page.
 */
class SplineErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[SplineScene] 3D scene failed to load:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <SceneFallback />;
    }
    return this.props.children;
  }
}

/** Shown when the 3D scene fails — keeps the layout intact */
function SceneFallback() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle, rgba(249, 115, 22, 0.06) 0%, transparent 70%)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <span
        style={{
          color: 'var(--color-textMuted)',
          fontSize: 'var(--font-sm)',
          fontFamily: 'var(--font-family)',
        }}
      >
        3D scene unavailable
      </span>
    </div>
  );
}

/** Spinner shown while the Spline runtime loads (~2MB) */
function SceneLoader() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-accent)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  );
}

/* ─── Public Component ─────────────────────────────────────────────────────── */

interface SplineSceneProps {
  scene: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Lazy-loaded Spline 3D scene component with error boundary.
 * The @splinetool/react-spline runtime is ~2MB, so we lazy-load it
 * to keep the initial bundle small. If the CDN fails or WebGL isn't
 * supported, a graceful fallback is shown instead of crashing.
 */
export function SplineScene({ scene, className, style }: SplineSceneProps) {
  return (
    <SplineErrorBoundary>
      <Suspense fallback={<SceneLoader />}>
        <Spline scene={scene} className={className} style={style} />
      </Suspense>
    </SplineErrorBoundary>
  );
}
