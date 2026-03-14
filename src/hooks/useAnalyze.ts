// Analysis hook with streaming support / Analyse-Hook mit Streaming-Unterstützung
import { useState, useCallback, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { analyzeReceipt } from "../lib/tauri-commands";
import type { AnalysisResult } from "../types/receipt";

interface UseAnalyzeReturn {
  analyzing: boolean;
  tokens: string;
  result: AnalysisResult | null;
  error: string | null;
  startAnalysis: (imagePath: string) => Promise<AnalysisResult | null>;
  reset: () => void;
}

export function useAnalyze(): UseAnalyzeReturn {
  const [analyzing, setAnalyzing] = useState(false);
  const [tokens, setTokens] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const startAnalysis = useCallback(async (imagePath: string) => {
    setAnalyzing(true);
    setTokens("");
    setResult(null);
    setError(null);

    // Listen for streaming tokens / Auf Streaming-Tokens lauschen
    try {
      unlistenRef.current = await listen<string>("llm-token", (event) => {
        setTokens((prev) => prev + event.payload);
      });
    } catch {
      // Events may not be available in dev / Events evtl. nicht verfügbar in Entwicklung
    }

    try {
      const analysisResult = await analyzeReceipt(imagePath);
      setResult(analysisResult);
      return analysisResult;
    } catch (err) {
      const message = String(err);
      setError(message);
      return null;
    } finally {
      setAnalyzing(false);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    }
  }, []);

  const reset = useCallback(() => {
    setAnalyzing(false);
    setTokens("");
    setResult(null);
    setError(null);
  }, []);

  return { analyzing, tokens, result, error, startAnalysis, reset };
}
