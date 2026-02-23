/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "lib", "i18n", "locales");

const NON_EN_FILES = ["de.ts", "fr.ts", "es.ts", "sv.ts", "it.ts", "pt.ts"];
const EN_FILE = "en.ts";

const ENGLISH_LEAK_SNIPPETS = [
  "new formations & tactics panel with most-used setup and distribution charts.",
  "club chronicle help overlay with guided callouts and full panel documentation.",
  "club chronicle adds a likely training regimen panel inferred from recent formations.",
  "club chronicle guide",
  "global refresh pulls all club chronicle panels in one run.",
  "latest updates shows only changed attributes grouped by team.",
  "header controls: use refresh for a full data pass",
  "transfer market: players currently on market and sold/bought totals.",
  "formations & tactics: most-used formation and tactic from the latest 20 relevant matches.",
  "likely training regimen: inferred from recent formations",
  "latest updates keeps per-attribute change groups by team",
  "fetching team details",
  "fetching league performance",
  "fetching arena data",
  "fetching transfer, finance, tsi, and wages data",
  "fetching formations and tactics data",
  "finalizing updates",
  "match archives {completed}/{total}",
  "match details {completed}/{total}",
  "asking price",
];

const NON_ENGLISH_LEAK_IN_EN = [
  "formationen & taktiken",
  "top-taktik",
  "verteilung formationen",
  "wahrscheinliches trainingsschema",
  "wahrscheinliches schema",
  "analysierte spiele",
  "sicherheit",
  "flügelspiel",
  "spielaufbau",
  "verteidigung",
  "passspiel",
  "torschuss",
  "torwart / standards",
];

function fail(message) {
  console.error(`[check:i18n] ${message}`);
  process.exitCode = 1;
}

function checkFileForSnippets(filePath, snippets, label) {
  const content = fs.readFileSync(filePath, "utf8");
  const lower = content.toLowerCase();
  for (const snippet of snippets) {
    if (lower.includes(snippet.toLowerCase())) {
      fail(`${label}: found forbidden snippet "${snippet}" in ${filePath}`);
    }
  }
}

for (const file of NON_EN_FILES) {
  const filePath = path.join(LOCALES_DIR, file);
  checkFileForSnippets(filePath, ENGLISH_LEAK_SNIPPETS, "non-en locale");
}

checkFileForSnippets(
  path.join(LOCALES_DIR, EN_FILE),
  NON_ENGLISH_LEAK_IN_EN,
  "en locale"
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[check:i18n] passed");
