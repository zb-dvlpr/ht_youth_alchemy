#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const MANDATORY_PERMISSIONS = ["manage_youthplayers"];
const OPTIONAL_PERMISSIONS = ["place_bid", "set_matchorder", "set_training"];
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const errors = [];

const permissionsSource = read("src/lib/chpp/permissions.ts");
if (!permissionsSource.includes("MANDATORY_CHPP_EXTENDED_PERMISSIONS")) {
  errors.push("Missing MANDATORY_CHPP_EXTENDED_PERMISSIONS baseline.");
}
if (!permissionsSource.includes("OPTIONAL_CHPP_EXTENDED_PERMISSIONS")) {
  errors.push("Missing OPTIONAL_CHPP_EXTENDED_PERMISSIONS allowlist.");
}
if (!permissionsSource.includes("normalizeOptionalChppPermissions")) {
  errors.push("Missing optional CHPP permission normalizer.");
}
if (!permissionsSource.includes("buildRequestedChppPermissions")) {
  errors.push("Missing mandatory-plus-optional permission builder.");
}
if (!permissionsSource.includes("buildChppScopeParam")) {
  errors.push("Missing mandatory CHPP scope builder.");
}
for (const permission of MANDATORY_PERMISSIONS) {
  if (!permissionsSource.includes(`"${permission}"`)) {
    errors.push(`Missing mandatory CHPP permission "${permission}".`);
  }
}
for (const permission of OPTIONAL_PERMISSIONS) {
  if (!permissionsSource.includes(`"${permission}"`)) {
    errors.push(`Missing optional CHPP permission "${permission}".`);
  }
}

const oauthStartSource = read("src/app/api/chpp/oauth/start/route.ts");
if (!oauthStartSource.includes("normalizeOptionalChppPermissions(")) {
  errors.push("OAuth start route does not normalize requested permissions.");
}
if (!oauthStartSource.includes("buildChppScopeParam(selectedPermissions)")) {
  errors.push(
    "OAuth start route does not combine mandatory permissions with validated optional permissions."
  );
}
if (!permissionsSource.includes("...MANDATORY_CHPP_EXTENDED_PERMISSIONS")) {
  errors.push("Requested CHPP scope does not include the mandatory baseline.");
}

const checkTokenSource = read("src/app/api/chpp/oauth/check-token/route.ts");
if (!checkTokenSource.includes("assertChppPermissions(auth, undefined, permissions)")) {
  errors.push("OAuth check-token route does not enforce mandatory permissions.");
}
if (!checkTokenSource.includes('get("skipPermissionCheck") === "1"')) {
  errors.push("OAuth check-token route no longer supports skipPermissionCheck.");
}

const routeChecks = [
  [
    "src/app/api/chpp/playerdetails/route.ts",
    'assertChppPermissions(auth, ["place_bid"])',
    "Player details route no longer enforces place_bid permission.",
  ],
  [
    "src/app/api/chpp/matchorders/route.ts",
    'assertChppPermissions(auth, ["set_matchorder"])',
    "Match orders route no longer enforces set_matchorder permission.",
  ],
  [
    "src/app/api/chpp/training/route.ts",
    'assertChppPermissions(auth, ["set_training"])',
    "Training route no longer enforces set_training permission.",
  ],
  [
    "src/app/api/chpp/youth/player-details/route.ts",
    'assertChppPermissions(auth, ["manage_youthplayers"])',
    "Youth player details route no longer enforces manage_youthplayers permission.",
  ],
];
for (const [file, marker, message] of routeChecks) {
  if (!read(file).includes(marker)) errors.push(message);
}

const accessGateSource = read("src/app/components/ChppAccessGate.tsx");
if (!accessGateSource.includes("OPTIONAL_CHPP_PERMISSION_OPTIONS.map")) {
  errors.push("Connection UI does not render the optional permission options.");
}
if (accessGateSource.includes('permission: "manage_youthplayers"')) {
  errors.push("Connection UI incorrectly exposes manage_youthplayers as optional.");
}

const i18nSource = read("src/lib/i18n.ts");
for (const key of [
  "chppPermissionSelectionIntro",
  "chppMissingPlaceBidTooltip",
  "chppMissingSetMatchOrderTooltip",
  "chppMissingSetTrainingTooltip",
]) {
  if (!i18nSource.includes(`${key}: string`)) {
    errors.push(`Missing i18n message key ${key}.`);
  }
}
const englishMessagesSource = read("src/lib/i18n/locales/en.ts");
if (
  !englishMessagesSource.includes(
    "Core youth-team access will be requested automatically."
  )
) {
  errors.push(
    "Permission-selection copy does not explain the automatic core youth-team permission."
  );
}

const sessionCookieSource = read("src/lib/chpp/session-cookie.ts");
const invalidateTokenSource = read(
  "src/app/api/chpp/oauth/invalidate-token/route.ts"
);
for (const cookieName of [
  "__Host-ya_chpp_session",
  "ya_chpp_session",
  "chpp_access_token",
  "chpp_access_secret",
  "chpp_req_token",
  "chpp_req_secret",
]) {
  if (!sessionCookieSource.includes(`"${cookieName}"`)) {
    errors.push(`CHPP logout does not clear "${cookieName}".`);
  }
}
if (
  !sessionCookieSource.includes(
    "response.cookies.set(CHPP_PRODUCTION_SESSION_COOKIE"
  ) ||
  !sessionCookieSource.includes("secure: true")
) {
  errors.push(
    "Production CHPP session-cookie clearing does not explicitly use Secure."
  );
}
if (!sessionCookieSource.includes("maxAge: 0")) {
  errors.push("CHPP logout does not explicitly expire cookies with maxAge 0.");
}
if (
  invalidateTokenSource.includes("cookieStore.delete(CHPP_SESSION_COOKIE)")
) {
  errors.push(
    "CHPP invalidate-token route still relies on cookieStore.delete for the session cookie."
  );
}
if (
  !invalidateTokenSource.includes("clearChppSessionCookies(response);") ||
  !invalidateTokenSource.includes("return response;")
) {
  errors.push(
    "CHPP invalidate-token route does not clear cookies on its returned response."
  );
}
if (/export\s+async\s+function\s+GET\b/.test(invalidateTokenSource)) {
  errors.push("CHPP token invalidation must remain POST-only.");
}

if (errors.length > 0) {
  console.error("CHPP permission regression check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("CHPP permission regression check passed.");
