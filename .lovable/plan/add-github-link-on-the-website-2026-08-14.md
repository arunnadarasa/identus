# Add GitHub link on the website

**Repo:** https://github.com/arunnadarasa/identus

## Goal
Surface the project's GitHub repository with a visible, clickable link from the public website so visitors can find and star the source.

## Changes

### 1. Landing page footer (`src/routes/index.tsx`, lines 235-250)
Add a GitHub link next to the existing "identus.io documentation" link in the footer row. Use the `Github` icon from `lucide-react` followed by the text "GitHub", styled as a primary-colored hover-underline anchor (matching the existing identus.io link style). Keep the existing community-project note and identus.io link intact.

### 2. Landing page header desktop nav (lines 90-114)
Add a compact GitHub icon-only `Button asChild` link (ghost variant) at the right end of the desktop nav, opening the repo in a new tab. This gives a persistent entry point above the fold on desktop.

### 3. Landing page mobile menu (lines 129-143)
Add a "GitHub" entry to the mobile nav list (alongside Learn / NHS / Docs) so mobile visitors reach the repo from the burger menu.

### 4. Console header (`src/components/AppShell.tsx`, lines 83-92)
Add a ghost icon `Button` with the `Github` icon to the desktop header actions (next to Sign out), linking to the repo in a new tab. Skip the mobile Sheet menu to avoid clutter — the footer link covers mobile console users.

## Non-goals
- No changes to docs route footers (out of scope; the landing/console coverage is enough).
- No OAuth, no GitHub connector, no API calls.

## Notes
- All links use `target="_blank" rel="noreferrer"`.
- `Github` is already available via the existing `lucide-react` dependency used elsewhere in the app.
