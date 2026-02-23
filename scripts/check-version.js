#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const packagePath = path.join(repoRoot, "package.json");

const readVersion = (raw) => {
  const parsed = JSON.parse(raw);
  return parsed.version || "0.0.0";
};

const compareSemver = (a, b) => {
  const parse = (v) => v.split(".").map((n) => Number(n));
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
};

const mainExists = () => {
  try {
    execSync("git rev-parse --verify main", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

if (!fs.existsSync(packagePath)) {
  console.error("package.json not found.");
  process.exit(1);
}

if (!mainExists()) {
  console.warn("main branch not found; skipping version check.");
  process.exit(0);
}

let mainVersion = "0.0.0";
try {
  const mainPkg = execSync("git show main:package.json", {
    encoding: "utf8",
  });
  mainVersion = readVersion(mainPkg);
} catch {
  console.warn("Unable to read version from main; skipping check.");
  process.exit(0);
}

const currentVersion = readVersion(fs.readFileSync(packagePath, "utf8"));
const diff = compareSemver(currentVersion, mainVersion);

if (diff < 0) {
  console.error(
    `Version regression detected: ${currentVersion} < ${mainVersion} (main).`
  );
  process.exit(1);
}

process.exit(0);
