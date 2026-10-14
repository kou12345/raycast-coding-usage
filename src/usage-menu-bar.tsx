import { Icon, launchCommand, LaunchType, MenuBarExtra, open } from "@raycast/api";
import { useUsage } from "./lib/use-usage";
import { formatReset, usageUrl } from "./lib/model";
import { formatMenuTitle } from "./lib/menu-title";
export default function Command() {
  const { data, loading, refresh } = useUsage();
  const title = formatMenuTitle(data);
  return (
    <MenuBarExtra
      icon={Icon.Gauge}
      title={title || undefined}
      isLoading={loading}
      tooltip="各枠の残り割合。wは週次、5hは5時間枠です。クリックするとリセット日時が見られます。"
    >
      {data.map((usage) => (
        <MenuBarExtra.Section key={usage.provider} title={usage.provider}>
          {usage.error && (
            <MenuBarExtra.Item
              title="取得エラー · 詳細を開く"
              icon={Icon.ExclamationMark}
              tooltip={usage.error}
              onAction={() => launchCommand({ name: "usage", type: LaunchType.UserInitiated })}
            />
          )}
          {usage.windows.map((window) => (
            <MenuBarExtra.Item
              key={window.id}
              title={`${window.label} · 残${Number((100 - window.used).toFixed(1))}%${usage.error ? "（前回）" : ""}`}
              subtitle={`リセット ${formatReset(window.resetAt)}`}
              onAction={() => open(usageUrl(usage.provider))}
            />
          ))}
          <MenuBarExtra.Item title={`最終取得 ${usage.fetchedAt ? formatReset(usage.fetchedAt) : "なし"}`} />
        </MenuBarExtra.Section>
      ))}
      <MenuBarExtra.Section>
        <MenuBarExtra.Item title="使用量を更新" icon={Icon.ArrowClockwise} onAction={refresh} />
        <MenuBarExtra.Item
          title="一覧を開く"
          icon={Icon.List}
          onAction={() => launchCommand({ name: "usage", type: LaunchType.UserInitiated })}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
