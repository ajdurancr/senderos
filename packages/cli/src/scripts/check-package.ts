import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

const help = Bun.spawnSync(["bun", "dist/index.js", "--help"]);
invariant(help.exitCode === 0, `Built CLI help failed:\n${help.stderr.toString()}`);
invariant(help.stdout.toString().includes("senderos"), "Built CLI help did not render the command name.");

const smokeHome = mkdtempSync(join(tmpdir(), "senderos-package-check-"));
try {
  const smoke = Bun.spawnSync([
    "bun", "dist/index.js", "init", "--home", smokeHome,
    "--harness", "codex", "--name", "Package smoke test", "--approve",
  ]);
  invariant(smoke.exitCode === 0, `Built CLI initialization failed:\n${smoke.stderr.toString()}`);
} finally {
  rmSync(smokeHome, { recursive: true, force: true });
}

const packageCheckRoot = mkdtempSync(join(tmpdir(), "senderos-packed-artifact-"));
try {
  const packed = Bun.spawnSync([
    "npm", "pack", "--ignore-scripts", "--json", "--pack-destination", packageCheckRoot,
  ], {
    env: { ...process.env, npm_config_dry_run: "false" },
  });
  invariant(packed.exitCode === 0, `npm pack failed:\n${packed.stderr.toString()}`);
  const packResults: PackResult[] = JSON.parse(packed.stdout.toString());
  const packResult = packResults[0];
  invariant(Boolean(packResult), "npm pack did not report a packed artifact.");
  const publishedFiles = packResult.files.map((file) => file.path);
  invariant(publishedFiles.includes("dist/index.js"), "The npm package does not contain dist/index.js.");
  invariant(publishedFiles.includes("README.md"), "The npm package does not contain its README.");
  invariant(
    publishedFiles.every((file) => file === "package.json" || file === "README.md" || file.startsWith("dist/")),
    `Unexpected files would be published: ${publishedFiles.join(", ")}`,
  );

  const installRoot = join(packageCheckRoot, "install");
  mkdirSync(installRoot);
  writeFileSync(join(installRoot, "package.json"), '{"private":true}');
  const install = Bun.spawnSync(
    ["bun", "add", join(packageCheckRoot, packResult.filename)],
    { cwd: installRoot },
  );
  invariant(install.exitCode === 0, `Packed CLI installation failed:\n${install.stderr.toString()}`);
  const installedHelp = Bun.spawnSync(
    [join(installRoot, "node_modules/.bin/senderos"), "--help"],
    { cwd: installRoot },
  );
  invariant(installedHelp.exitCode === 0, `Installed CLI failed:\n${installedHelp.stderr.toString()}`);

  console.log(JSON.stringify({ publishedFiles }, null, 2));
} finally {
  rmSync(packageCheckRoot, { recursive: true, force: true });
}
