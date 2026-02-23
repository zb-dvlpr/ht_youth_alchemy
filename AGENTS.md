## Versioning
- Follow SemVer: MAJOR.MINOR.PATCH.
- Increment the version on every change, including documentation or configuration edits.
- Decide the bump based on scope: PATCH for bugfixes or tiny changes, MINOR for small new features, MAJOR for big new features or paradigm shifts, or the user requests a specific bump.
- Apply the version bump automatically; do not request confirmation.

## Documentation
- Keep `README.md` project-level and concise: include durable overview/setup/usage information, not per-change historical bullet logs.
- Update `README.md` only when the MAJOR/MINOR version is bumped. In the case of MINOR, decide whether it would make sense adding it to `README.md` or whether it reads as a git commit message. If it is the latter, do not add to `README.md`.
- Use git history/commits for detailed change-by-change tracking instead of expanding README with incremental release notes.

## Localization
- Any new visible user-facing text must be added in a multi-language ready way (i.e., sourced from the i18n messages table rather than hardcoded).
- Localization messages are split per locale file; keep locale content in the correct locale file and never bulk copy translated blocks between locales.
- When adding or changing i18n keys, update all supported locales (`en`, `de`, `fr`, `es`, `sv`, `it`, `pt`) in the same change.
- For any localization edit, verify the changed keys in each locale file before finishing to prevent cross-locale text leakage.
- Run `npm run check:i18n` after locale changes and before finishing. If it fails, fix locale leakage before any other work.

## Tooltips
- All tooltip UI must use the shared tooltip framework/component so tooltips stay within the viewport.

## Notifications
- When the user specifies a notification message, use the notification framework.

## Date/Time
- Any new date/time display must use the shared date/time formatting framework.

## Modals
- All modal UI must use the shared modal framework/component.

## Changelog
- When a MAJOR or MINOR version changes, the changelog should auto-expand.
- Every MAJOR or MINOR bump must append a one-line changelog entry describing what’s new.

## Local Data Export
- Any new localStorage key or cached client data must be included in the settings export/import routines.

## Persistence
- Any new feature, tool, panel, or workflow must persist user state/context and restore it when users navigate away and return.
- Do not ship additions that reset existing user selections, layout, or in-progress state unless explicitly requested.

## Clarification
- If an instruction is unclear, ask clarifying questions before starting any coding.

## Vibecoding Output
- At the end of each vibecoding run for a prompt, provide a one-line git commit message suggestion.

## Code Reuse
- When writing code, prioritize maximizing reuse and minimizing repetitive implementations.
- When multiple panels/features need overlapping API data during the same refresh cycle, fetch once and reuse the result instead of calling the same endpoint multiple times.
- For new fetch/refresh flows, prefer bounded parallel execution whenever dependencies allow it; keep correctness first and preserve deterministic aggregation/progress behavior.

## Club Chronicle Tables
- All Club Chronicle tables must use the shared ChronicleTable framework/component.

## Panels
- Use the shared ChroniclePanel framework/component for any new panels anywhere in the app.

## Latest Updates Methodology
- For all future Club Chronicle panels, track changes at the attribute level (not only panel-level blobs).
- On each refresh, compare previous vs current values per attribute and show only changed attributes in Latest Updates.
- Latest Updates must remain grouped by team, regardless of panel content.
