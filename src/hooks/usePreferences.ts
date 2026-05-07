import { useState, useEffect, useCallback, useMemo } from "react";
import { getPreferences, addIgnorePattern, removeIgnorePattern } from "../api";
import picomatch from "picomatch";

export function usePreferences() {
  const [patterns, setPatterns] = useState<{ global: string[]; repo: string[] }>({ global: [], repo: [] });

  const refresh = useCallback(() => {
    getPreferences().then(setPatterns);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const allPatterns = useMemo(() => [...patterns.global, ...patterns.repo], [patterns]);

  const isIgnored = useCallback((filePath: string) => {
    if (allPatterns.length === 0) return false;
    return picomatch.isMatch(filePath, allPatterns);
  }, [allPatterns]);

  const addPattern = useCallback(async (pattern: string, scope: "global" | "repo") => {
    await addIgnorePattern(pattern, scope);
    refresh();
  }, [refresh]);

  const removePattern = useCallback(async (pattern: string, scope: "global" | "repo") => {
    await removeIgnorePattern(pattern, scope);
    refresh();
  }, [refresh]);

  return { patterns, isIgnored, addPattern, removePattern, refresh };
}
