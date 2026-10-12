import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runTerminal, testEnvironment as isolatedEnvironment, verifyTerminalSupport } from "../integration/terminal-fixture";

await verifyTerminalSupport();
if (!Bun.which('node') || !Bun.which('npm')) throw new Error('Package checks require Node.js and npm (CI uses Node.js 24). Install them before running release:check.');

type PackageManifest = {
  private?: boolean;
  bin?: Record<string, string>;
  files?: string[];
  publishConfig?: { access?: string };
  dependencies?: Record<string, string>;
};

type PackResult = {
  filename: string;
  files: Array<{ path: string }>;
};

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const testRuntimeBase = resolve(
  process.env.SENDEROS_TEST_RUNTIME_ROOT ??
    resolve(import.meta.dir, "../../../../.tmp/test-runtime"),
);
const testRuntimeRoot = resolve(testRuntimeBase, "cli-package-check");
rmSync(testRuntimeRoot, { recursive: true, force: true });
mkdirSync(testRuntimeRoot, { recursive: true });
process.on("exit", () => {
  rmSync(testRuntimeRoot, { recursive: true, force: true });
  if (existsSync(testRuntimeBase) && readdirSync(testRuntimeBase).length === 0) {
    rmSync(testRuntimeBase, { recursive: true, force: true });
  }
});
const testEnvironment = isolatedEnvironment({
  SENDEROS_TEST_RUNTIME_ROOT: testRuntimeRoot,
  TMPDIR: testRuntimeRoot,
  TMP: testRuntimeRoot,
  TEMP: testRuntimeRoot,
});

const manifest: PackageManifest = JSON.parse(readFileSync("package.json", "utf8"));
invariant(manifest.private === false, "The CLI package must be public.");
invariant(manifest.publishConfig?.access === "public", "publishConfig.access must be public.");
invariant(manifest.bin?.senderos === "dist/index.js", "The senderos binary must point to the built artifact.");
invariant(manifest.files?.includes("dist") === true, "The published file allowlist must include dist.");
invariant(
  !Object.values(manifest.dependencies ?? {}).some((version) => version.startsWith("workspace:")),
  "Published dependencies cannot use the workspace protocol.",
);

const executable = readFileSync("dist/index.js", "utf8");
invariant(executable.startsWith("#!/usr/bin/env bun"), "The built CLI must have a Bun executable shebang.");
invariant(
  existsSync("dist/skills/senderos/SKILL.md"),
  "The built CLI must contain the canonical Senderos skill.",
);

const help = Bun.spawnSync(["bun", "dist/index.js", "--help"], { env: testEnvironment });
invariant(help.exitCode === 0, `Built CLI help failed:\n${help.stderr.toString()}`);
invariant(help.stdout.toString().includes("senderos"), "Built CLI help did not render the command name.");

const builtSkill = Bun.spawnSync([
  "bun", "dist/index.js", "bootstrap-agent-skill", "--print",
], { env: testEnvironment });
invariant(
  builtSkill.exitCode === 0,
  `Built CLI skill bootstrap failed:\n${builtSkill.stderr.toString()}`,
);
invariant(
  builtSkill.stdout.toString().includes("bunx --bun senderos@latest --help"),
  "Built CLI skill bootstrap did not return the canonical skill.",
);

const smokeHome = mkdtempSync(join(testRuntimeRoot, "senderos-package-check-"));
try {
  const smoke = Bun.spawnSync([
    "bun", "dist/index.js", "init", "--home", smokeHome,
    "--harness", "codex", "--name", "Package smoke test", "--approve",
  ], { env: { ...testEnvironment, SENDEROS_DATABASE_URL: `file:${join(smokeHome, "senderos.db")}` } });
  invariant(smoke.exitCode === 0, `Built CLI initialization failed:\n${smoke.stderr.toString()}`);
} finally {
  rmSync(smokeHome, { recursive: true, force: true });
}

const packageCheckRoot = mkdtempSync(join(testRuntimeRoot, "senderos-packed-artifact-"));
try {
  const packed = Bun.spawnSync([
    "npm", "pack", "--ignore-scripts", "--json", "--pack-destination", packageCheckRoot,
  ], {
    env: { ...testEnvironment, npm_config_dry_run: "false" },
  });
  invariant(packed.exitCode === 0, `npm pack failed:\n${packed.stderr.toString()}`);
  const packResults: PackResult[] = JSON.parse(packed.stdout.toString());
  const packResult = packResults[0];
  invariant(Boolean(packResult), "npm pack did not report a packed artifact.");
  const publishedFiles = packResult.files.map((file) => file.path);
  invariant(publishedFiles.includes("dist/index.js"), "The npm package does not contain dist/index.js.");
  invariant(
    publishedFiles.includes("dist/skills/senderos/SKILL.md"),
    "The npm package does not contain the canonical Senderos skill.",
  );
  invariant(publishedFiles.includes("README.md"), "The npm package does not contain its README.");
  invariant(
    publishedFiles.every((file) => file === "package.json" || file === "README.md" || file.startsWith("dist/")),
    `Unexpected files would be published: ${publishedFiles.join(", ")}`,
  );

  const installRoot = join(packageCheckRoot, "install");
  mkdirSync(installRoot);
  writeFileSync(join(installRoot, "package.json"), '{"private":true}');
  const install = Bun.spawnSync(
    ["bun", "add", `../${packResult.filename}`],
    { cwd: installRoot, env: testEnvironment },
  );
  invariant(install.exitCode === 0, `Packed CLI installation failed:\n${install.stderr.toString()}`);
  const installedHelp = Bun.spawnSync(
    [join(installRoot, "node_modules/.bin/senderos"), "--help"],
    { cwd: installRoot, env: testEnvironment },
  );
  invariant(installedHelp.exitCode === 0, `Installed CLI failed:\n${installedHelp.stderr.toString()}`);
  const installedSkill = Bun.spawnSync(
    [
      join(installRoot, "node_modules/.bin/senderos"),
      "bootstrap-agent-skill",
      "--print",
    ],
    { cwd: installRoot, env: testEnvironment },
  );
  invariant(
    installedSkill.exitCode === 0,
    `Installed CLI skill bootstrap failed:\n${installedSkill.stderr.toString()}`,
  );
  invariant(
    installedSkill.stdout.toString().includes("bunx --bun senderos@latest --help"),
    "Installed CLI did not return the canonical Senderos skill.",
  );

  // Exercise migration/seed discovery from the installed tarball, not source imports.
  const installedHome = join(packageCheckRoot, 'installed-runtime');
  const installedEnvironment = {
    ...testEnvironment,
    SENDEROS_DATABASE_URL: `file:${join(installedHome, 'senderos.db')}`,
  };
  const installedBinary = join(installRoot, 'node_modules/.bin/senderos');
  const invokeInstalled = (args: string[]) => {
    const result = Bun.spawnSync([installedBinary, ...args, '--home', installedHome], {
      cwd: installRoot, env: installedEnvironment, timeout: 10_000,
      stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    });
    invariant(result.exitCode === 0, `Installed CLI command failed:\n${result.stderr.toString()}`);
    return JSON.parse(result.stdout.toString());
  };
  invokeInstalled(['init', '--name', 'Installed reset smoke', '--harness', 'codex', '--approve']);
  invokeInstalled(['project', 'create', '--name', 'Disposable package project']);
  const originalConfig = readFileSync(join(installedHome, 'config.json'));
  const originalDatabase = readFileSync(join(installedHome, 'senderos.db'));
  const declined = await runTerminal([installedBinary, 'db', 'reset', '--home', installedHome], {
    cwd: installRoot, env: installedEnvironment,
    prompt: 'or press Enter to cancel:', input: '\n',
  });
  invariant(declined.exitCode === 0 && declined.output.includes('"reset": false'), `Installed CLI decline failed:\n${declined.output}`);
  const piped = Bun.spawnSync([installedBinary, 'db', 'reset', '--home', installedHome], {
    cwd: installRoot, env: installedEnvironment, timeout: 10_000,
    stdin: Buffer.from(`RESET ${join(installedHome, 'senderos.db')}\n`), stdout: 'pipe', stderr: 'pipe',
  });
  invariant(piped.exitCode === 1 && piped.stderr.toString().includes('Database reset requires an interactive terminal on stdin and stderr.'), `Installed CLI accepted piped confirmation:\n${piped.stderr}`);
  invariant(readFileSync(join(installedHome, 'senderos.db')).equals(originalDatabase), 'Installed decline or piped input changed database bytes.');
  const reset = await runTerminal([installedBinary, 'db', 'reset', '--home', installedHome], {
    cwd: installRoot, env: installedEnvironment,
    prompt: 'or press Enter to cancel:',
    input: `RESET ${join(installedHome, 'senderos.db')}\n`,
  });
  invariant(reset.exitCode === 0 && reset.output.includes('"reset": true'), `Installed CLI reset failed:\n${reset.output}`);
  const backupMatch = reset.output.match(/"backupPath":\s*"([^"\r\n]+)"/);
  invariant(Boolean(backupMatch && existsSync(backupMatch[1]!)), 'Installed reset did not retain its recovery backup.');
  invariant(readFileSync(join(installedHome, 'config.json')).equals(originalConfig), 'Installed reset changed config bytes.');
  invariant(invokeInstalled(['project', 'list']).length === 0, 'Installed reset retained old projects.');
  invariant(invokeInstalled(['sendero', 'list']).length === 5, 'Installed reset did not restore built-in Senderos.');
  invariant(invokeInstalled(['doctor']).ok === true, 'Installed reset failed runtime health validation.');

  console.log(JSON.stringify({ publishedFiles }, null, 2));
} finally {
  rmSync(packageCheckRoot, { recursive: true, force: true });
}
