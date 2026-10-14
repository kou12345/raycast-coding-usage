import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchProvider, UsageError } from "../src/lib/providers";
async function fixture(fn: (paths: { codexAuthFile: string; claudeCredentialsFile: string }) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "coding-usage-test-"));
  const paths = { codexAuthFile: join(dir, "auth.json"), claudeCredentialsFile: join(dir, ".credentials.json") };
  await writeFile(
    paths.codexAuthFile,
    JSON.stringify({ tokens: { access_token: "fake-test-token", account_id: "fake-account" } }),
  );
  await writeFile(
    paths.claudeCredentialsFile,
    JSON.stringify({ claudeAiOauth: { accessToken: "fake-test-token", expiresAt: Date.now() + 60000 } }),
  );
  const original = globalThis.fetch;
  try {
    await fn(paths);
  } finally {
    globalThis.fetch = original;
    await rm(dir, { recursive: true, force: true });
  }
}
test("Claude reads logged-in file and only sends token to fixed usage endpoint", async () =>
  fixture(async (paths) => {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "https://api.anthropic.com/api/oauth/usage");
      assert.equal(init?.redirect, "error");
      assert.equal((init?.headers as Record<string, string>)["anthropic-beta"], "oauth-2025-04-20");
      return new Response(JSON.stringify({ five_hour: { utilization: 10 }, seven_day: { utilization: 25 } }));
    };
    const usage = await fetchProvider("Claude", paths);
    assert.deepEqual(
      usage.windows.map((w) => w.used),
      [10, 25],
    );
    assert.equal(JSON.stringify(usage).includes("fake-test-token"), false);
  }));
test("429 obeys Retry-After and doesn't resend", async () =>
  fixture(async (paths) => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response("server-body-with-secret", { status: 429, headers: { "retry-after": "120" } });
    };
    const now = Date.now();
    await assert.rejects(
      fetchProvider("Codex", paths),
      (error: unknown) =>
        error instanceof UsageError && (error.retryAt ?? 0) >= now + 120000 && !error.message.includes("server-body"),
    );
    assert.equal(calls, 1);
  }));
test("401 reports login needed without exposing response body or credential", async () =>
  fixture(async (paths) => {
    globalThis.fetch = async () => new Response("fake-test-token", { status: 401 });
    await assert.rejects(
      fetchProvider("Claude", paths),
      (error: unknown) =>
        error instanceof UsageError && error.message.includes("ログイン") && !error.message.includes("fake-test-token"),
    );
  }));
