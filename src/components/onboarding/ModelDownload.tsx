// Onboarding model download overlay / Onboarding-Modell-Download-Overlay
import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { downloadModel, selectModelFile, startLlamaServer } from "@/lib/tauri-commands";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  DownloadIcon,
  FolderOpenIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  XIcon,
  ReceiptTextIcon,
} from "lucide-react";

interface DownloadProgress {
  downloaded: number;
  total: number;
  speed: number;
  percentage: number;
}

interface ModelDownloadProps {
  onComplete: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function ModelDownload({ onComplete }: ModelDownloadProps) {
  const [state, setState] = useState<"idle" | "downloading" | "complete" | "error">("idle");
  const [progress, setProgress] = useState<DownloadProgress>({
    downloaded: 0,
    total: 0,
    speed: 0,
    percentage: 0,
  });
  const [errorMsg, setErrorMsg] = useState("");

  // Listen to download progress events / Download-Fortschrittsereignisse abonnieren
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<DownloadProgress>("model-download-progress", (event) => {
      setProgress(event.payload);
      if (event.payload.percentage >= 100) {
        setState("complete");
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const handleAutoDownload = async () => {
    setState("downloading");
    setErrorMsg("");
    try {
      await downloadModel();
      setState("complete");
    } catch (err) {
      setState("error");
      setErrorMsg(String(err));
    }
  };

  const handleManualSelect = async () => {
    try {
      await selectModelFile();
      setState("complete");
    } catch {
      // User cancelled / Benutzer hat abgebrochen
    }
  };

  const handleStart = async () => {
    try {
      await startLlamaServer();
    } catch {
      // Non-critical, server can be started later
    }
    onComplete();
  };

  const handleRetry = () => {
    setState("idle");
    setErrorMsg("");
    setProgress({ downloaded: 0, total: 0, speed: 0, percentage: 0 });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          {/* App logo / App-Logo */}
          <div className="mx-auto flex items-center justify-center size-16 rounded-2xl bg-primary/10">
            <ReceiptTextIcon className="size-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">
              Willkommen beim Kassenzettel Scanner
            </CardTitle>
            <CardDescription className="mt-2">
              Das KI-Modell wird für die Texterkennung benötigt (~2,1 GB).
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Idle state / Ausgangszustand */}
          {state === "idle" && (
            <div className="space-y-3">
              <Button className="w-full" onClick={handleAutoDownload}>
                <DownloadIcon className="size-4 mr-2" />
                Automatisch herunterladen
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleManualSelect}
              >
                <FolderOpenIcon className="size-4 mr-2" />
                Modell manuell auswählen
              </Button>
            </div>
          )}

          {/* Downloading state / Download-Zustand */}
          {state === "downloading" && (
            <div className="space-y-3">
              {/* Progress bar / Fortschrittsbalken */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Herunterladen...</span>
                  <span className="font-medium">
                    {Math.round(progress.percentage)}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
                  </span>
                  <span>{formatBytes(progress.speed)}/s</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setState("idle");
                }}
              >
                <XIcon className="size-4 mr-2" />
                Abbrechen
              </Button>
            </div>
          )}

          {/* Complete state / Abgeschlossen */}
          {state === "complete" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex items-center justify-center size-12 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircleIcon className="size-6 text-green-600" />
              </div>
              <p className="text-sm font-medium">Modell bereit!</p>
              <Button className="w-full" onClick={handleStart}>
                Los geht's
              </Button>
            </div>
          )}

          {/* Error state / Fehlerzustand */}
          {state === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
                <AlertCircleIcon className="size-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Download fehlgeschlagen</p>
                  <p className="text-muted-foreground mt-1 break-all">
                    {errorMsg || "Ein unbekannter Fehler ist aufgetreten."}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleRetry}>
                  Erneut versuchen
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleManualSelect}
                >
                  Manuell wählen
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
