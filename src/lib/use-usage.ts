import { Cache, getPreferenceValues } from "@raycast/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { createHash } from "node:crypto";
import { defaultPaths, fetchProvider, Paths, UsageError } from "./providers";
import { mergeFailure, Usage } from "./model";
const cache = new Cache();
export function useUsage() {
  const [data, setData] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);
  const refresh = useCallback(async (force = false) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const preferences = getPreferenceValues<Paths>();
      const paths = {
        codexAuthFile: preferences.codexAuthFile || defaultPaths.codexAuthFile,
        claudeCredentialsFile: preferences.claudeCredentialsFile || defaultPaths.claudeCredentialsFile,
      };
      const suffix = createHash("sha256").update(JSON.stringify(paths)).digest("hex").slice(0, 16);
      const results = await Promise.all(
        (["Codex", "Claude"] as const).map(async (provider): Promise<Usage> => {
          const key = `${provider}-${suffix}`;
          let previous: Usage | undefined;
          try {
            const raw = cache.get(key);
            if (raw) previous = JSON.parse(raw);
          } catch {
            /* Ignore invalid cache. */
          }
          const checkedAt = previous?.checkedAt ? Date.parse(previous.checkedAt) : 0;
          if (previous && ((previous.retryAt ?? 0) > Date.now() || (!force && Date.now() - checkedAt < 60000)))
            return previous;
          let result: Usage;
          try {
            result = await fetchProvider(provider, paths);
          } catch (error) {
            result = mergeFailure(
              previous,
              provider,
              error instanceof Error ? error.message : "使用量を取得できませんでした。",
              error instanceof UsageError ? error.retryAt : undefined,
            );
          }
          // Persist only sanitized usage windows, timestamps and errors, never credentials or raw API payloads.
          cache.set(key, JSON.stringify(result));
          return result;
        }),
      );
      setData(results);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, loading, refresh: () => refresh(true) };
}
