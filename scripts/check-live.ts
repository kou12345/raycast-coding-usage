import { defaultPaths, fetchProvider } from "../src/lib/providers";
async function main() {
  for (const provider of ["Codex", "Claude"] as const) {
    try {
      const usage = await fetchProvider(provider, defaultPaths);
      console.log(JSON.stringify({ provider, windows: usage.windows, fetchedAt: usage.fetchedAt }));
    } catch (error) {
      console.log(JSON.stringify({ provider, error: error instanceof Error ? error.message : "Failed" }));
      process.exitCode = 1;
    }
  }
}
void main();
