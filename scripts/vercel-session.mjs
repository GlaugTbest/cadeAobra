// O token entra por stdin, permanece na memória e nunca é gravado no projeto.
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
console.log("Ready for session JSON on stdin (input is hidden).");
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume();
const input = await new Promise((resolve) => {
  let value = "";
  process.stdin.on("data", (chunk) => {
    value += chunk;
    if (/[\r\n]/.test(value)) {
      process.stdin.pause();
      resolve(value.trim());
    }
  });
});
const { token, scope } = JSON.parse(input);
const cache = join(process.env.LOCALAPPDATA, "npm-cache", "_npx");
const cli = readdirSync(cache)
  .map((d) => join(cache, d, "node_modules/vercel/dist/index.js"))
  .find(existsSync);
if (!cli) throw Error("Execute npx --yes vercel@65.4.0 --help primeiro.");
const child = spawn(
  process.execPath,
  [
    cli,
    ...process.argv.slice(2),
    "--token",
    token,
    ...(scope ? ["--scope", scope] : []),
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" },
    windowsHide: true,
  },
);
for (const stream of [child.stdout, child.stderr])
  stream.on("data", (b) =>
    process.stdout.write(String(b).replaceAll(token, "[redacted]")),
  );
child.on("close", (code) => process.exit(code ?? 1));
