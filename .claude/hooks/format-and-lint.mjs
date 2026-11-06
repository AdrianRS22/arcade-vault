// PostToolUse hook (Write|Edit): runs Prettier and ESLint on the touched file.
// Reads the hook payload from stdin. Exit 2 feeds ESLint errors back to Claude.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const LINTABLE = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const SKIP_DIRS = ["node_modules", ".next", ".git"];

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let payload;
try {
  payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
} catch {
  process.exit(0);
}

const filePath =
  payload?.tool_input?.file_path ?? payload?.tool_response?.filePath;
if (!filePath) process.exit(0);

const projectDir = path.resolve(
  process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
);
const absolute = path.resolve(filePath);
const relative = path.relative(projectDir, absolute);

if (relative.startsWith("..") || path.isAbsolute(relative)) process.exit(0);
if (relative.split(path.sep).some((part) => SKIP_DIRS.includes(part)))
  process.exit(0);
if (!existsSync(absolute)) process.exit(0);

// Call the local CLIs through node directly: no shell, so paths with spaces are safe.
const bin = (...parts) => path.join(projectDir, "node_modules", ...parts);
const run = (script, args) =>
  execFileSync(process.execPath, [script, ...args], {
    cwd: projectDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

try {
  run(bin("prettier", "bin", "prettier.cjs"), [
    "--write",
    "--ignore-unknown",
    absolute,
  ]);
} catch (error) {
  console.error(
    `Prettier failed on ${relative}:\n${error.stderr || error.message}`,
  );
  process.exit(2);
}

if (LINTABLE.has(path.extname(absolute).toLowerCase())) {
  try {
    run(bin("eslint", "bin", "eslint.js"), [
      "--fix",
      "--no-warn-ignored",
      absolute,
    ]);
  } catch (error) {
    console.error(
      `ESLint errors in ${relative}:\n${error.stdout || ""}${error.stderr || ""}`,
    );
    process.exit(2);
  }
}
