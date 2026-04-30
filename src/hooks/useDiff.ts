import { useState, useEffect } from "react";
import { getDiff } from "../api";

export function useDiff(base: string, head: string) {
  const [diff, setDiff] = useState<string>("");
  const [baseCommit, setBaseCommit] = useState("");
  const [headCommit, setHeadCommit] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base || !head || base === head) {
      setDiff("");
      return;
    }
    setLoading(true);
    setError(null);
    getDiff(base, head)
      .then(({ diff, baseCommit, headCommit }) => {
        setDiff(diff);
        setBaseCommit(baseCommit);
        setHeadCommit(headCommit);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [base, head]);

  return { diff, baseCommit, headCommit, loading, error };
}
