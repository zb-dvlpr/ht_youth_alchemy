# Mobile Roadmap

Status: in progress
Last updated: 2026-04-06

## Goals
- Deliver a mobile UX that feels like a real app, not a compressed desktop website.
- Keep desktop behavior and layout stable while mobile support is introduced incrementally.
- Build mobile support in small, testable milestones rather than a single broad rewrite.

## Non-Goals
- Do not replace the desktop shell/navigation unless explicitly requested.
- Do not treat viewport scaling as the primary mobile strategy.
- Do not expand ambiguous shared-component changes to both desktop and mobile without clarifying scope.

## Rules
- Mobile implementation should be mobile-first and desktop-safe.
- Use breakpoint-scoped shells, wrappers, and variants where possible.
- Preserve persistence and restore in-progress state across navigation.
- Update this roadmap as mobile tasks are completed or re-scoped.

## Phase 1: Mobile Shell
- [x] Build a mobile-only launcher/home screen with primary tool entry points.
- [x] Add mobile top-bar navigation that supports returning to the launcher.
- [x] Add mobile tool switching without exposing the desktop sidebar.
- [x] Preserve the existing desktop shell unchanged.
- [x] Verify desktop shell and tool switching after the mobile shell lands.

## Phase 2: Youth Mobile
- [x] Establish the overall Youth mobile look and feel.
- [x] Make Youth player details mobile-friendly.
- [x] Adapt the Youth skills matrix for mobile readability.
- [x] Adapt the Youth ratings matrix for mobile readability.
- [x] Make the Youth lineup optimizer mobile-friendly.
- [x] Verify desktop Youth layout and interactions after mobile Youth changes.

## Phase 3: Senior Mobile
- [x] Establish the overall Senior mobile look and feel.
- [x] Make Senior player details mobile-friendly.
- [x] Adapt the Senior skills matrix for mobile readability.
- [x] Adapt the Senior ratings matrix for mobile readability.
- [x] Make the Senior lineup optimizer mobile-friendly.
- [x] Verify desktop Senior layout and interactions after mobile Senior changes.

## Phase 4: Club Chronicle Mobile
- [x] Show one Chronicle panel at a time on mobile.
- [x] Preserve full Chronicle tab switching and tab management on mobile.
- [x] Add elegant previous/next edge navigation between Chronicle panels.
- [x] Add direct panel jumping so users do not need to step through every panel.
- [x] Keep panel order, active tab, and current panel position persisted.
- [x] Move Latest Updates to a separate vertical mobile screen grouped by team.
- [ ] Adapt Chronicle tables, dense panels, filters, and modal content as part of finishing Club Chronicle.
  - [x] Reworked Latest Updates into a readable mobile comparison layout with per-attribute Previous/Current blocks.
- [ ] Verify desktop Chronicle layout and interactions after mobile Chronicle changes.

## Phase 5: Polish and Verification
- [ ] Tune spacing, touch targets, and motion for mobile ergonomics.
  - [x] Reworked transfer search modals so mobile shows only Results, Search criteria, or Market summary at a time.
  - [x] Made transfer search mobile panels scroll inside the viewport without hiding criteria behind the footer.
  - [x] Stacked transfer search bid and max-bid controls on mobile to prevent cramped action rows.
  - [x] Fixed transfer search table view on landscape phones so the results pane keeps full usable height while horizontal scrolling remains available.
  - [x] Compacted the mobile transfer search modal in portrait and landscape so table view prioritizes visible rows over roomy spacing.
  - [x] Fixed the mobile table fallback notice wrapping and tightened column density further so portrait uses more of the available width.
  - [x] Fixed transfer search table wrapper sizing so horizontal scrolling works again on mobile and desktop while fallback notices wrap inside the results width.
  - [x] Added direct Player list shortcuts to the Youth and Senior floating mobile dropdowns.
  - [x] Added a mobile launcher Help submenu for Manual, Bug report, and Feature request, with on-demand manual table of contents access.
  - [x] Added bottom Manual entries to all mobile floating dropdowns.
- [ ] Audit persistence and state restoration on mobile navigation flows.
- [ ] Clean up any remaining truly cross-cutting mobile component issues left after Youth, Senior, and Chronicle are complete.
- [ ] Run a desktop regression pass across Youth, Senior, and Club Chronicle.
- [ ] Run a mobile usability pass across launcher, navigation, and core workflows.

## Open Decisions
- [ ] Decide whether mobile should always open on the launcher or remember the last-used tool after first launch.
- [ ] Decide whether the mobile tool switcher should be a bottom sheet, full-screen picker, or launcher-only flow.
- [ ] Decide which Club Chronicle panels need custom mobile content treatment beyond the one-panel-at-a-time model.
