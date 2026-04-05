# Mobile Roadmap

Status: in progress
Last updated: 2026-04-05

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
- [ ] Adapt the Youth skills matrix for mobile readability.
- [ ] Adapt the Youth ratings matrix for mobile readability.
- [ ] Make the Youth lineup optimizer mobile-friendly.
- [ ] Verify desktop Youth layout and interactions after mobile Youth changes.

## Phase 3: Senior Mobile
- [ ] Establish the overall Senior mobile look and feel.
- [ ] Make Senior player details mobile-friendly.
- [ ] Adapt the Senior skills matrix for mobile readability.
- [ ] Adapt the Senior ratings matrix for mobile readability.
- [ ] Make the Senior lineup optimizer mobile-friendly.
- [ ] Verify desktop Senior layout and interactions after mobile Senior changes.

## Phase 4: Club Chronicle Mobile
- [ ] Show one Chronicle panel at a time on mobile.
- [ ] Add horizontal swipe or snap navigation between Chronicle panels.
- [ ] Add explicit previous/next or picker controls so swipe is not the only navigation path.
- [ ] Keep panel order, active tab, and current panel position persisted.
- [ ] Move Latest Updates to a separate vertical mobile screen grouped by team.
- [ ] Adapt Chronicle tables, dense panels, filters, and modal content as part of finishing Club Chronicle.
- [ ] Verify desktop Chronicle layout and interactions after mobile Chronicle changes.

## Phase 5: Polish and Verification
- [ ] Tune spacing, touch targets, and motion for mobile ergonomics.
- [ ] Audit persistence and state restoration on mobile navigation flows.
- [ ] Clean up any remaining truly cross-cutting mobile component issues left after Youth, Senior, and Chronicle are complete.
- [ ] Run a desktop regression pass across Youth, Senior, and Club Chronicle.
- [ ] Run a mobile usability pass across launcher, navigation, and core workflows.

## Open Decisions
- [ ] Decide whether mobile should always open on the launcher or remember the last-used tool after first launch.
- [ ] Decide whether the mobile tool switcher should be a bottom sheet, full-screen picker, or launcher-only flow.
- [ ] Decide which Club Chronicle panels need custom mobile content treatment beyond the one-panel-at-a-time model.
