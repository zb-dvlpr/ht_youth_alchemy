## Versioning
- Follow SemVer: MAJOR.MINOR.PATCH.
- Increment the version on every change, including documentation or configuration edits.
- Decide the bump based on scope: PATCH for bugfixes or tiny changes, MINOR for small new features, MAJOR for big new features or paradigm shifts, or the user requests a specific bump.
- Apply the version bump automatically; do not request confirmation.

## Documentation
- Keep `README.md` project-level and concise: include durable overview/setup/usage information, not per-change historical bullet logs.
- Update `README.md` only when the MAJOR/MINOR version is bumped. In the case of MINOR, decide whether it would make sense adding it to `README.md` or whether it reads as a git commit message. If it is the latter, do not add to `README.md`.
- Use git history/commits for detailed change-by-change tracking instead of expanding README with incremental release notes.

## Manual
- Treat the in-app manual as user-facing product documentation that must stay in sync with the app without requiring a separate reminder.
- Whenever anything user-facing is added, removed, moved, renamed, redesigned, or behaviorally changed, update the manual in the same change.
- This includes tools, panels, workflows, settings, menu items, buttons, modals, warnings, disclaimers, tooltips, platform scope, feature locations, and meaningful behavior changes.
- If a change affects where users find something or how they should use it, the manual must reflect the new location or behavior before the task is considered complete.

## Localization
- Any new visible user-facing text must be added in a multi-language ready way (i.e., sourced from the i18n messages table rather than hardcoded).
- Localization messages are split per locale file; keep locale content in the correct locale file and never bulk copy translated blocks between locales.
- When adding or changing i18n keys, update all supported locales (`en`, `de`, `fr`, `es`, `sv`, `it`, `pt`, `pl`, `nl`) in the same change.
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

## Currency
- Any time currency is displayed in the UI, convert and display it in EUR.

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
- If it is not clear which tool/panel/workflow is being referenced, clarify with the user before making changes.
- Never apply the same behavior change across multiple tools/panels unless the user explicitly confirms the cross-tool scope.
- When tools have overlapping functionality, double-check scope with the user before implementing shared-component changes.

## Mobile UX
- For mobile-only prompts, default to mobile-only scope unless the user explicitly requests cross-platform changes.
- Preserve desktop behavior, layout, navigation, and visual structure unless the user explicitly approves desktop changes.
- Prefer breakpoint-scoped mobile shells, wrappers, and layout variants over shared rewrites when reducing desktop regression risk.
- If a requested mobile change would materially alter shared desktop behavior, pause and clarify before broadening scope.
- If a request targets a shared component or shared surface and the desktop/mobile impact is meaningfully different, clarify whether the requested change applies to desktop, mobile, or both before implementing it.
- Do not assume that a shared data or feature request automatically implies the same layout or density change on both desktop and mobile.
- For ambiguous shared-UI requests such as added columns, controls, or panels, confirm platform scope before changing both experiences.
- For mobile work, refer to `docs/mobile-roadmap.md` before making changes so implementation stays aligned with the tracked rollout plan.
- When a mobile task or milestone is completed, update `docs/mobile-roadmap.md` in the same change and check off the relevant item(s).
- For mobile navigation redesigns, do not silently replace desktop navigation patterns; keep desktop navigation intact unless explicitly requested.
- After mobile changes, verify core desktop flows most likely to regress, especially shell layout, tool switching, panels, and submission workflows.
- For mobile prompts, aim for an app-like UX rather than a compressed responsive website.
- Avoid mobile solutions that simply shrink desktop UI, including persistent desktop sidebars, dense multi-column carryover, and viewport-scaling workarounds as the primary mobile strategy.

## Vibecoding Output
- At the end of each vibecoding run for a prompt, provide a one-line git commit message suggestion that covers all changes since the last commit.
- Never suggest a commit message that only describes the latest delta if multiple uncommitted changes exist.
- Before suggesting the commit message, quickly scan `git status`/`git diff --stat` and ensure the message summarizes the full staged+unstaged scope.
- Anchor the suggestion to git history, not memory: check `git log -1 --oneline` and `git diff --name-status HEAD` (or equivalent) before writing the message.
- The suggested message must describe exactly what changed in `HEAD..working tree` at suggestion time; do not include work that has already been committed.
- Use git commands for this verification every time (do not rely on memory), even if the change seems small.
- Do not include version numbers in the suggested commit message.

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
