"use client";
import { Component, type ReactNode, type ErrorInfo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Error Boundary — catches runtime errors in children                */
/* ------------------------------------------------------------------ */

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/*  Premium-styled Error Fallback Card                                 */
/* ------------------------------------------------------------------ */

function ErrorFallback({
  error,
  errorInfo,
  onRetry,
}: {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <GlassCard gold glow className="p-8">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/30 bg-gold/10">
                <AlertTriangle className="h-8 w-8 text-gold" />
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 animate-pulse-gold rounded-full" />
            </div>
          </div>

          {/* Title */}
          <div className="mt-5 text-center">
            <h3 className="text-lg font-semibold text-foreground">Something went wrong</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              An unexpected error occurred. This has been logged for investigation.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 rounded-lg border border-gold/15 bg-black/30 p-3">
              <p className="text-xs font-medium text-gold">{error.message}</p>
            </div>
          )}

          {/* Retry button */}
          <div className="mt-5 flex justify-center">
            <Button
              onClick={onRetry}
              className="bg-gold-gradient text-black hover:opacity-90 press-scale gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>

          {/* Collapsible error details */}
          <div className="mt-4">
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {detailsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {detailsOpen ? "Hide" : "Show"} error details
            </button>
            <AnimatePresence>
              {detailsOpen && errorInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-border/60 bg-black/40 p-3 text-[10px] leading-relaxed text-muted-foreground scroll-luxury">
                    {errorInfo.componentStack}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
