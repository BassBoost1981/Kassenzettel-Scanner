// Drop zone for receipt image import / Ablagezone fuer Kassenzettel-Bildimport
import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanDocument, isScannerAvailable } from "@/lib/tauri-commands";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onImageSelected: (path: string) => void;
}

const SUPPORTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif"];

function isValidImageFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_EXTENSIONS.includes(ext);
}

export function DropZone({ onImageSelected }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [scannerAvailable, setScannerAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check scanner availability / Scanner-Verfuegbarkeit pruefen
  useEffect(() => {
    isScannerAvailable()
      .then(setScannerAvailable)
      .catch(() => setScannerAvailable(false));
  }, []);

  // Listen for Tauri drag-drop events / Auf Tauri Drag-Drop-Events lauschen
  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
      setIsDragOver(false);
      const paths = event.payload.paths;
      if (paths && paths.length > 0) {
        const filePath = paths[0];
        if (isValidImageFile(filePath)) {
          setError(null);
          onImageSelected(filePath);
        } else {
          setError("Nicht unterstuetztes Dateiformat. Bitte JPG, PNG, WebP oder HEIC verwenden.");
        }
      }
    });

    const unlistenOver = listen("tauri://drag-over", () => {
      setIsDragOver(true);
    });

    const unlistenLeave = listen("tauri://drag-leave", () => {
      setIsDragOver(false);
    });

    return () => {
      unlisten.then((fn) => fn());
      unlistenOver.then((fn) => fn());
      unlistenLeave.then((fn) => fn());
    };
  }, [onImageSelected]);

  // Open file dialog / Datei-Dialog oeffnen
  const handleFileSelect = useCallback(async () => {
    try {
      const path = await open({
        filters: [
          {
            name: "Bilder",
            extensions: SUPPORTED_EXTENSIONS,
          },
        ],
        multiple: false,
      });
      if (path) {
        setError(null);
        onImageSelected(path as string);
      }
    } catch (err) {
      setError(`Fehler beim Oeffnen des Datei-Dialogs: ${String(err)}`);
    }
  }, [onImageSelected]);

  // Scan document / Dokument scannen
  const handleScan = useCallback(async () => {
    try {
      setError(null);
      const path = await scanDocument();
      onImageSelected(path);
    } catch (err) {
      setError(`Scanner-Fehler: ${String(err)}`);
    }
  }, [onImageSelected]);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex w-full max-w-lg flex-col items-center gap-6">
        {/* Drop zone area / Ablagezone-Bereich */}
        <div
          className={cn(
            "flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-all duration-200",
            isDragOver
              ? "border-primary bg-primary/5 scale-[1.02] shadow-lg shadow-primary/10"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <div
            className={cn(
              "flex size-16 items-center justify-center rounded-2xl transition-colors duration-200",
              isDragOver
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Upload className="size-8" />
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              Kassenzettel hierher ziehen
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              oder eine der folgenden Optionen nutzen
            </p>
          </div>

          <p className="text-xs text-muted-foreground/60">
            JPG, PNG, WebP, HEIC
          </p>
        </div>

        {/* Action buttons / Aktions-Buttons */}
        <div className="flex w-full gap-3">
          <Button
            variant="default"
            size="lg"
            className="flex-1"
            onClick={handleFileSelect}
          >
            <Upload className="mr-2 size-4" />
            Datei auswaehlen
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            disabled={!scannerAvailable}
            onClick={handleScan}
            title={
              scannerAvailable
                ? "Dokument mit Scanner erfassen"
                : "Kein Scanner verfuegbar"
            }
          >
            <ScanLine className="mr-2 size-4" />
            Scanner
          </Button>
        </div>

        {/* Error message / Fehlermeldung */}
        {error && (
          <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
