import { Usage, Window } from "./model";

function windowLabel(window: Window): string {
  const label = window.label.replace(/週次/g, "w").replace(/(\d+)時間/g, "$1h");
  const remaining = Number((100 - window.used).toFixed(1));
  return `${label} 残${remaining}%`;
}

export function formatMenuTitle(data: Usage[]): string {
  return data
    .map((usage) => {
      const provider = usage.provider === "Codex" ? "Cx" : "Cl";
      if (usage.error) return `${provider} 取得エラー`;
      const main = usage.windows.filter((window) =>
        usage.provider === "Codex"
          ? window.id.startsWith("codex-")
          : window.id === "five_hour" || window.id === "seven_day",
      );
      const windows = main.length ? main : usage.windows;
      return `${provider} ${windows.length ? windows.map(windowLabel).join(" / ") : "未取得"}`;
    })
    .join(" · ");
}
