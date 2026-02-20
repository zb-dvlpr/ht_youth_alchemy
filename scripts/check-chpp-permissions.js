#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

const REQUIRED_PERMISSIONS = ["set_matchorder", "manage_youthplayers"];

const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const errors = [];

const permissionsSource = read("src/lib/chpp/permissions.ts");
for (const permission of REQUIRED_PERMISSIONS) {
  if (!permissionsSource.includes(`"${permission}"`)) {
    errors.push(
      `Missing required CHPP permission "${permission}" in src/lib/chpp/permissions.ts`
    );
  }
}

const oauthStartSource = read("src/app/api/chpp/oauth/start/route.ts");
if (!oauthStartSource.includes("toChppScopeParam(")) {
  errors.push(
    "OAuth start route no longer builds scope from toChppScopeParam()."
  );
}
if (!oauthStartSource.includes("&scope=")) {
  errors.push("OAuth start route no longer appends a scope query parameter.");
}

const checkTokenSource = read("src/app/api/chpp/oauth/check-token/route.ts");
if (!checkTokenSource.includes("assertChppPermissions(")) {
  errors.push("OAuth check-token route no longer enforces required permissions.");
}

const matchordersSource = read("src/app/api/chpp/matchorders/route.ts");
if (!matchordersSource.includes('assertChppPermissions(auth, ["set_matchorder"])')) {
  errors.push("Match orders route no longer enforces set_matchorder permission.");
}

const youthDetailsSource = read("src/app/api/chpp/youth/player-details/route.ts");
if (
  !youthDetailsSource.includes(
    'assertChppPermissions(auth, ["manage_youthplayers"])'
  )
) {
  errors.push(
    "Youth player details route no longer enforces manage_youthplayers permission for unlock."
  );
}

if (errors.length > 0) {
  console.error("CHPP permission regression check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("CHPP permission regression check passed.");
