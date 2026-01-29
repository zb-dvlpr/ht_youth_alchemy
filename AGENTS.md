## Versioning
- Follow SemVer: MAJOR.MINOR.PATCH.
- Increment the version on every change, including documentation or configuration edits.
- Decide the bump based on scope: PATCH for bugfixes or tiny changes, MINOR for small new features, MAJOR for big new features or paradigm shifts, or the user requests a specific bump.
- Apply the version bump automatically; do not request confirmation.

## Documentation
- Update `README.md` whenever a feature is introduced, modified, or removed.

## Localization
- Any new visible user-facing text must be added in a multi-language ready way (i.e., sourced from the i18n messages table rather than hardcoded).

## Tooltips
- All tooltip UI must use the shared tooltip framework/component so tooltips stay within the viewport.

## Notifications
- When the user specifies a notification message, use the notification framework.

## Date/Time
- Any new date/time display must use the shared date/time formatting framework.

## Clarification
- If an instruction is unclear, ask clarifying questions before starting any coding.
