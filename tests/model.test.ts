import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeFailure, parseClaude, parseCodex } from "../src/lib/model";
test("Codex: weekly-only primary stays weekly; missing windows aren't fabricated", () => {
  const result = parseCodex({
    rate_limit: {
      primary_window: { used_percent: 15, limit_window_seconds: 604800, reset_at: 1792472293 },
      secondary_window: null,
    },
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].label, "週次");
  assert.equal(result[0].used, 15);
});
test("Codex: review and additional buckets remain separate", () => {
  const rate_limit = { primary_window: { used_percent: 25, limit_window_seconds: 18000 } };
  const result = parseCodex({
    rate_limit,
    code_review_rate_limit: rate_limit,
    additional_rate_limits: [{ limit_name: "Astra", rate_limit }],
  });
  assert.deepEqual(
    result.map((w) => w.label),
    ["5時間", "Code Review · 5時間", "Astra · 5時間"],
  );
});
test("Claude: zero is valid and null windows are absent", () => {
  const result = parseClaude({
    five_hour: { utilization: 0, resets_at: "2026-10-14T12:00:00Z" },
    seven_day: null,
    seven_day_sonnet: { utilization: 78.5 },
  });
  assert.deepEqual(
    result.map((w) => w.used),
    [0, 78.5],
  );
  assert.equal(result[1].resetAt, undefined);
});
test("Malformed, absent and out-of-range usage fail instead of displaying zero", () => {
  for (const utilization of [undefined, null, "15", NaN, -1, 101])
    assert.throws(() => parseClaude({ five_hour: { utilization } }));
  assert.throws(() => parseClaude({}));
  assert.throws(() => parseCodex({ rate_limit: {} }));
  assert.throws(() => parseClaude({ five_hour: { utilization: 1, resets_at: "bad" } }));
});
test("Failure preserves last success and marks it stale, with retry cooldown", () => {
  const previous = {
    provider: "Codex" as const,
    windows: [{ id: "weekly", label: "週次", used: 15 }],
    fetchedAt: "2026-10-14T00:00:00Z",
  };
  const result = mergeFailure(previous, "Codex", "HTTP 429", 1234);
  assert.deepEqual(result.windows, previous.windows);
  assert.equal(result.fetchedAt, previous.fetchedAt);
  assert.equal(result.error, "HTTP 429");
  assert.equal(result.retryAt, 1234);
});

test("Claude: weekly breakdown metadata is not a quota window", () => {
  const result = parseClaude({
    five_hour: { utilization: 61, resets_at: "2026-10-14T08:20:00Z" },
    seven_day: { utilization: 26, resets_at: "2026-10-18T22:00:00Z" },
    seven_day_breakdown: { as_of: "2026-10-14T07:00:00Z", rows: [{ key: "claude_code", percent: 100 }] },
  });
  assert.deepEqual(
    result.map((w) => [w.label, w.used]),
    [
      ["5時間", 61],
      ["週次", 26],
    ],
  );
});
