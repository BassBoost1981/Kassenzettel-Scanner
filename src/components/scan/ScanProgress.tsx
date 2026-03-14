// Scan progress view with streaming AI output / Scan-Fortschritt mit KI-Streaming-Ausgabe
import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAnalyze } from "@/hooks/useAnalyze";
import type { AnalysisResult } from "@/types/receipt";

interface ScanProgressProps {
  imagePath: string;
  onComplete: (result: AnalysisResult) => void;
}

const TIMEOUT_MS = 120_000; // 120 seconds / 120 Sekunden

export function ScanProgress({ imagePath, onComplete }: ScanProgressProps) {
  const { analyzing, tokens, result, error, startAnalysis, reset } = useAnalyze();
  const [timedOut, setTimedOut] = useState(false);
  const tokenEndRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStarted = useRef(false);

  // Start analysis on mount / Analyse beim Mounten starten
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    startAnalysis(imagePath);

    // Set timeout / Timeout setzen
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true);
    }, TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle completion / Abschluss behandeln
  useEffect(() => {
    if (result) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onComplete(result);
    }
  }, [result, onComplete]);

  // Auto-scroll token output / Token-Ausgabe automatisch scrollen
  useEffect(() => {
    tokenEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tokens]);

  // Retry analysis / Analyse wiederholen
  const handleRetry = () => {
    setTimedOut(false);
    reset();
    hasStarted.current = false;
    startAnalysis(imagePath);
    timeoutRef.current = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
  };

  const imageSrc = convertFileSrc(imagePath);
  const hasError = error || timedOut;

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* Left: Image preview / Links: Bildvorschau */}
      <div className="flex w-[40%] flex-col border-r border-border bg-muted/20">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium text-muted-foreground">Vorschau</h3>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          <img
            src={imageSrc}
            alt="Kassenzettel"
            className="max-h-full max-w-full rounded-lg object-contain shadow-md"
          />
        </div>
      </div>

      {/* Right: Progress / Rechts: Fortschritt */}
      <div className="flex w-[60%] flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          {analyzing && !hasError && (
            <Loader2 className="size-5 animate-spin text-primary" />
          )}
          {hasError && (
            <AlertCircle className="size-5 text-destructive" />
          )}
          <div>
            <h2 className="text-lg font-semibold">
              {hasError ? "Fehler bei der Analyse" : "KI analysiert..."}
            </h2>
            <p className="text-sm text-muted-foreground">
              {hasError
                ? timedOut
                  ? "Die Analyse hat zu lange gedauert (Timeout)."
                  : error
                : "Der Kassenzettel wird von der KI ausgelesen."}
            </p>
          </div>
        </div>

        {/* Token stream / Token-Stream */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              {tokens ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-foreground/80">
                  {tokens}
                  {analyzing && (
                    <span className="inline-block animate-pulse text-primary">|</span>
                  )}
                  <div ref={tokenEndRef} />
                </pre>
              ) : (
                !hasError && (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                    <Loader2 className="size-8 animate-spin text-primary/50" />
                    <p className="text-sm">Warte auf KI-Antwort...</p>
                  </div>
                )
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer with progress or retry / Fusszeile mit Fortschritt oder Wiederholen */}
        <div className="border-t border-border px-6 py-4">
          {hasError ? (
            <Button onClick={handleRetry} variant="default" size="lg">
              <RotateCcw className="mr-2 size-4" />
              Erneut versuchen
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">
                <span className="inline-block size-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                <span className="inline-block size-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                <span className="inline-block size-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
              </div>
              <span>Analyse laeuft...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
