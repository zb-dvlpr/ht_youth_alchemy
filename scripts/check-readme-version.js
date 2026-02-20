#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const packagePath = path.join(repoRoot, "package.json");
const readmePath = path.join(repoRoot, "README.md");

const readVersion = (raw) => {
  const parsed = JSON.parse(raw);
  return parsed.version || "0.0.0";
};

const parseSemver = (version) => {
  const [major = "0", minor = "0", patch = "0"] = version.split(".");
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
  };
};

const resolveBaseRef = () => {
  const candidates = ["main", "origin/main", "refs/heads/main"];
  for (const candidate of candidates) {
    try {
      execSync(`git rev-parse --verify ${candidate}`, { stdio: "ignore" });
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
};

if (!fs.existsSync(packagePath) || !fs.existsSync(readmePath)) {
  console.error("package.json or README.md not found.");
  process.exit(1);
}

const baseRef = resolveBaseRef();

if (!baseRef) {
  console.warn("main reference not found; skipping README/version check.");
  process.exit(0);
}

let mainPackageRaw = "";
let mainReadmeRaw = "";
try {
  mainPackageRaw = execSync(`git show ${baseRef}:package.json`, {
    encoding: "utf8",
  });
  mainReadmeRaw = execSync(`git show ${baseRef}:README.md`, {
    encoding: "utf8",
  });
} catch {
  console.warn(
    `Unable to read package.json or README.md from ${baseRef}; skipping check.`
  );
  process.exit(0);
}

const currentPackageRaw = fs.readFileSync(packagePath, "utf8");
const currentReadmeRaw = fs.readFileSync(readmePath, "utf8");

const mainVersion = parseSemver(readVersion(mainPackageRaw));
const currentVersion = parseSemver(readVersion(currentPackageRaw));
const readmeChanged = currentReadmeRaw !== mainReadmeRaw;
const majorOrMinorChanged =
  currentVersion.major !== mainVersion.major ||
  currentVersion.minor !== mainVersion.minor;

if (readmeChanged && !majorOrMinorChanged) {
  console.error(
    "README.md changed, but package version did not bump MAJOR or MINOR compared to main."
  );
  console.error(
    `main=${mainVersion.major}.${mainVersion.minor}.${mainVersion.patch}, current=${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`
  );
  process.exit(1);
}

process.exit(0);
