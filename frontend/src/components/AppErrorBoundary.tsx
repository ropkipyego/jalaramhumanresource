import React from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Props = { children: React.ReactNode };

type State = { error: Error | null };

/** Catches render crashes so login never shows a blank white page. */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <Alert variant="destructive" className="max-w-lg">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="space-y-3">
              <p className="text-sm break-words">{this.state.error.message}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    this.setState({ error: null });
                    window.location.assign("/dashboard");
                  }}
                >
                  Go to dashboard
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    localStorage.clear();
                    window.location.assign("/auth");
                  }}
                >
                  Sign in again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    return this.props.children;
  }
}
