import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { object, parseCodex, parseClaude, Usage } from "./model";
const run = promisify(execFile);
export type Paths = { codexAuthFile: string; claudeCredentialsFile: string };
export const defaultPaths: Paths = {
  codexAuthFile: "~/.codex/auth.json",
  claudeCredentialsFile: "~/.claude/.credentials.json",
};
export class UsageError extends Error {
  constructor(
    message: string,
    public retryAt?: number,
  ) {
    super(message);
  }
}
function expand(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}
async function jsonFile(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(expand(path), "utf8"));
  } catch {
    throw new UsageError("認証ファイルを読めません。CLIでログインし、拡張の設定でパスを確認してください。");
  }
}
function token(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new UsageError("ログイン情報がありません。CLIで再ログインしてください。");
  return value;
}
async function claudeToken(path: string): Promise<string> {
  const candidates: unknown[] = [];
  try {
    candidates.push(await jsonFile(path));
  } catch {
    /* Keychain can hold macOS credentials. */
  }
  function valid(value: unknown): string | undefined {
    try {
      const c = object(object(value).claudeAiOauth);
      if (typeof c.expiresAt === "number" && c.expiresAt <= Date.now()) return undefined;
      return token(c.accessToken);
    } catch {
      return undefined;
    }
  }
  const fileToken = candidates.map(valid).find(Boolean);
  if (fileToken) return fileToken;
  // No shell and no logging: the credential stays only in memory.
  try {
    const { stdout } = await run(
      "/usr/bin/security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { timeout: 10000, maxBuffer: 1024 * 1024 },
    );
    const keychainToken = valid(JSON.parse(stdout));
    if (keychainToken) return keychainToken;
  } catch {
    /* Do not expose security stdout/stderr or credentials in errors. */
  }
  throw new UsageError(
    "Claudeの認証情報が未取得、期限切れ、またはKeychainにアクセスできません。ターミナルで claude auth login を実行してください。",
  );
}
async function request(url: string, headers: Record<string, string>): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new UsageError("使用量APIに接続できません。ネットワークを確認してください。");
  }
  if (!response.ok) {
    if (response.status === 401)
      throw new UsageError("ログインの有効期限が切れています。CLIで再ログインしてください。");
    if (response.status === 403)
      throw new UsageError("使用量APIへのアクセスが拒否されました。ログイン状態・プランを確認してください。");
    if (response.status === 429) {
      const value = response.headers.get("retry-after");
      const parsed = value && /^\d+$/.test(value) ? Date.now() + Number(value) * 1000 : Date.parse(value ?? "");
      const retryAt = Number.isFinite(parsed) && parsed > Date.now() ? parsed : Date.now() + 5 * 60 * 1000;
      throw new UsageError("APIの取得回数制限に達しました。時間を置いて更新してください。", retryAt);
    }
    throw new UsageError(`使用量APIでエラーが発生しました (HTTP ${response.status})。`);
  }
  try {
    return await response.json();
  } catch {
    throw new UsageError("使用量APIがJSONを返しませんでした。");
  }
}
export async function fetchProvider(provider: Usage["provider"], paths: Paths): Promise<Usage> {
  let windows;
  if (provider === "Codex") {
    const auth = object(await jsonFile(paths.codexAuthFile));
    if (!auth.tokens)
      throw new UsageError("CodexのChatGPTログインが必要です。ターミナルで codex login を実行してください。");
    const credentials = object(auth.tokens);
    const headers: Record<string, string> = { Authorization: `Bearer ${token(credentials.access_token)}` };
    if (typeof credentials.account_id === "string") headers["ChatGPT-Account-Id"] = credentials.account_id;
    windows = parseCodex(await request("https://chatgpt.com/backend-api/wham/usage", headers));
  } else {
    const accessToken = await claudeToken(paths.claudeCredentialsFile);
    windows = parseClaude(
      await request("https://api.anthropic.com/api/oauth/usage", {
        Authorization: `Bearer ${accessToken}`,
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": "coding-usage/0.1.0",
      }),
    );
  }
  const fetchedAt = new Date().toISOString();
  return { provider, windows, fetchedAt, checkedAt: fetchedAt };
}
