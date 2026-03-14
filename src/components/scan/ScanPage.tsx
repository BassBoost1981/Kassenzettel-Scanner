// Scan workflow orchestrator / Scan-Workflow-Orchestrator
import { useState, useCallback } from "react";
import { DropZone } from "./DropZone";
import { ScanProgress } from "./ScanProgress";
import { CorrectionTable } from "./CorrectionTable";
import type { AnalysisResult } from "@/types/receipt";

type ScanStage = "import" | "analyzing" | "correction";

export function ScanPage() {
  const [stage, setStage] = useState<ScanStage>("import");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // Image selected from DropZone / Bild aus DropZone ausgewaehlt
  const handleImageSelected = useCallback((path: string) => {
    setImagePath(path);
    setStage("analyzing");
  }, []);

  // Analysis complete / Analyse abgeschlossen
  const handleAnalysisComplete = useCallback((analysisResult: AnalysisResult) => {
    setResult(analysisResult);
    setStage("correction");
  }, []);

  // Reset to import stage / Zurueck zur Import-Phase
  const resetToImport = useCallback(() => {
    setStage("import");
    setImagePath(null);
    setResult(null);
  }, []);

  switch (stage) {
    case "import":
      return <DropZone onImageSelected={handleImageSelected} />;
    case "analyzing":
      return (
        <ScanProgress
          imagePath={imagePath!}
          onComplete={handleAnalysisComplete}
        />
      );
    case "correction":
      return (
        <CorrectionTable
          imagePath={imagePath!}
          result={result!}
          onSave={resetToImport}
          onDiscard={resetToImport}
        />
      );
  }
}
