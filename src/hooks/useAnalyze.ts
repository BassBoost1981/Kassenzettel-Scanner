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
  const runIdRef = useRef(0);

  const startAnalysis = useCallback(async (imagePath: string) => {
    runIdRef.current += 1;
    const runId = runIdRef.current;

    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    setAnalyzing(true);
    setTokens("");
    setResult(null);
    setError(null);

    // Listen for streaming tokens / Auf Streaming-Tokens lauschen
    try {
      unlistenRef.current = await listen<string>("analysis-token", (event) => {
        if (runIdRef.current !== runId) return;
        setTokens((prev) => prev + event.payload);
      });
    } catch {
      // Events may not be available in dev / Events evtl. nicht verfügbar in Entwicklung
    }

    try {
      const analysisResult = await analyzeReceipt(imagePath);
      if (runIdRef.current !== runId) return null;
      setResult(analysisResult);
      return analysisResult;
    } catch (err) {
      if (runIdRef.current !== runId) return null;
      const message = String(err);
      setError(message);
      return null;
    } finally {
      if (runIdRef.current === runId) {
        setAnalyzing(false);
        if (unlistenRef.current) {
          unlistenRef.current();
          unlistenRef.current = null;
        }
      }
    }
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    setAnalyzing(false);
    setTokens("");
    setResult(null);
    setError(null);
  }, []);

  return { analyzing, tokens, result, error, startAnalysis, reset };
}
