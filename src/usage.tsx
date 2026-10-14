import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { useUsage } from "./lib/use-usage";
import { formatReset, usageUrl } from "./lib/model";
export default function Command() {
  const { data, loading, refresh } = useUsage();
  return (
    <List isLoading={loading} searchBarPlaceholder="Codex・Claudeの使用量を検索" isShowingDetail>
      {data.map((usage) => {
        const actions = (
          <ActionPanel>
            <Action
              title="使用量を更新"
              icon={Icon.ArrowClockwise}
              onAction={refresh}
              shortcut={Keyboard.Shortcut.Common.Refresh}
            />
            <Action.OpenInBrowser title="使用量ページを開く" url={usageUrl(usage.provider)} />
            <Action.CopyToClipboard
              title="ログインコマンドをコピー"
              content={usage.provider === "Codex" ? "codex login" : "claude auth login"}
            />
          </ActionPanel>
        );
        const updated = usage.fetchedAt ? new Date(usage.fetchedAt).toLocaleString("ja-JP") : "取得なし";
        return (
          <List.Section
            key={usage.provider}
            title={usage.provider}
            subtitle={usage.error ? "取得エラー" : `更新 ${updated}`}
          >
            {usage.error && (
              <List.Item
                id={`${usage.provider}-error`}
                title={`${usage.provider} · 取得できません`}
                icon={{ source: Icon.ExclamationMark, tintColor: Color.Orange }}
                detail={
                  <List.Item.Detail
                    markdown={`## ${usage.provider}\n\n${usage.error}\n\n最終成功: ${updated}${usage.windows.length ? "\n\n下の数値は前回取得時の値です。" : ""}`}
                  />
                }
                actions={actions}
              />
            )}
            {usage.windows.map((window) => (
              <List.Item
                key={window.id}
                id={`${usage.provider}-${window.id}`}
                title={window.label}
                subtitle={`使用 ${window.used}%`}
                icon={{
                  source: Icon.Gauge,
                  tintColor: usage.error
                    ? Color.SecondaryText
                    : window.used >= 90
                      ? Color.Red
                      : window.used >= 70
                        ? Color.Orange
                        : Color.Green,
                }}
                accessories={[{ text: usage.error ? "前回の値" : formatReset(window.resetAt) }]}
                detail={
                  <List.Item.Detail
                    markdown={`## ${usage.provider} · ${window.label}\n\n${usage.error ? "> ⚠️ 前回取得時の値です。現在の使用量は未確認です。\n\n" : ""}使用率 **${window.used}%**\n\n残り **${Number((100 - window.used).toFixed(1))}%**\n\nリセット **${formatReset(window.resetAt)}**\n\n最終取得 ${updated}\n\nアカウント全体のサブスクリプション枠です。`}
                  />
                }
                actions={actions}
              />
            ))}
          </List.Section>
        );
      })}
    </List>
  );
}
