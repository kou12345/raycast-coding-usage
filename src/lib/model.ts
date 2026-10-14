export type Window = { id: string; label: string; used: number; resetAt?: string };
export type Usage = {
  provider: "Codex" | "Claude";
  windows: Window[];
  fetchedAt?: string;
  checkedAt?: string;
  error?: string;
  retryAt?: number;
};
type ObjectData = Record<string, unknown>;
export function object(value: unknown): ObjectData {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("使用量APIの応答形式が変わりました。");
  return value as ObjectData;
}
function percent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("使用量APIから有効な使用率を取得できませんでした。");
  }
  return value;
}
function reset(value: unknown, seconds = false): string | undefined {
  if (value == null) return undefined;
  if (seconds && (typeof value !== "number" || !Number.isFinite(value))) throw new Error("リセット時刻が不正です。");
  if (!seconds && typeof value !== "string") throw new Error("リセット時刻が不正です。");
  const date = new Date(seconds ? (value as number) * 1000 : (value as string));
  if (!Number.isFinite(date.getTime())) throw new Error("リセット時刻が不正です。");
  return date.toISOString();
}
function windowLabel(seconds: unknown, fallback: string): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return fallback;
  if (seconds === 604800) return "週次";
  if (seconds % 3600 === 0) return `${seconds / 3600}時間`;
  return `${seconds / 60}分`;
}
export function parseCodex(value: unknown): Window[] {
  const data = object(value);
  const windows: Window[] = [];
  const add = (value: unknown, id: string, prefix = "") => {
    if (value == null) return;
    const limits = object(value);
    for (const [key, fallback] of [
      ["primary_window", "主枠"],
      ["secondary_window", "追加枠"],
    ]) {
      if (limits[key] == null) continue;
      const w = object(limits[key]);
      windows.push({
        id: `${id}-${key}`,
        label: prefix + windowLabel(w.limit_window_seconds, fallback),
        used: percent(w.used_percent),
        resetAt: reset(w.reset_at, true),
      });
    }
  };
  add(data.rate_limit, "codex");
  add(data.code_review_rate_limit, "review", "Code Review · ");
  if (data.additional_rate_limits != null) {
    if (!Array.isArray(data.additional_rate_limits)) throw new Error("追加枠の応答形式が変わりました。");
    data.additional_rate_limits.forEach((value, i) => {
      const additional = object(value);
      add(
        additional.rate_limit,
        `additional-${i}`,
        `${typeof additional.limit_name === "string" ? additional.limit_name : "追加枠"} · `,
      );
    });
  }
  if (!windows.length) throw new Error("このアカウントの使用制限枠を取得できませんでした。");
  return windows;
}
export function parseClaude(value: unknown): Window[] {
  const data = object(value);
  const labels: Record<string, string> = {
    five_hour: "5時間",
    seven_day: "週次",
    seven_day_sonnet: "Sonnet · 週次",
    seven_day_opus: "Opus · 週次",
    seven_day_oauth_apps: "OAuth Apps · 週次",
  };
  const windows = Object.entries(data)
    .filter(
      ([key, value]) =>
        value != null &&
        key !== "seven_day_breakdown" &&
        (key === "five_hour" || key === "seven_day" || key.startsWith("seven_day_")),
    )
    .map(([id, value]) => {
      const w = object(value);
      return {
        id,
        label: labels[id] ?? `${id.slice(10).replaceAll("_", " ")} · 週次`,
        used: percent(w.utilization),
        resetAt: reset(w.resets_at),
      };
    });
  if (!windows.length) throw new Error("このアカウントの使用制限枠を取得できませんでした。");
  return windows;
}
export function mergeFailure(
  previous: Usage | undefined,
  provider: Usage["provider"],
  error: string,
  retryAt?: number,
): Usage {
  return {
    provider,
    windows: previous?.windows ?? [],
    fetchedAt: previous?.fetchedAt,
    checkedAt: new Date().toISOString(),
    error,
    retryAt,
  };
}
export function formatReset(value?: string): string {
  return value
    ? new Date(value).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "時刻未提供";
}
export const usageUrl = (provider: Usage["provider"]) =>
  provider === "Codex" ? "https://chatgpt.com/codex/settings/usage" : "https://claude.ai/settings/usage";
