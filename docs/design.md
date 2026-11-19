# UI designs

High-fidelity designs (6 screens + loading, empty, validation and delete-confirm states): https://claude.ai/artifact/3o1H1Y2QhqWfddWcS4VRkj
Generated from the prompt in `docs/prompts/design-prompt.md`, then reviewed.

## Changes made after review
- Removed the logged-in user from the header: there is no auth in v1, so it would be misleading.
- Removed the global Ctrl K search: it duplicates the directory search.
- Removed the "View all outliers" link: the directory has no outlier filter.
- Kept "median for this role" on the employee page.
- Range bars on the country page are built last and dropped if time runs short.
