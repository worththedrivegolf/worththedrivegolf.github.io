# CLAUDE.md — Worth The Drive Website

## Purpose
This repository powers the public Worth The Drive Golf Studio website. Prioritize a polished, premium golf experience, mobile usability, clear CTAs, correct forms/integrations, and efficient implementation.

## Read First
1. Read the repo `README.md` and project docs if present.
2. Run `git status`.
3. Inspect the last 5 commits.
4. Identify the exact page/component/assets involved.
5. Work from those files first.

## Usage / Agent Control
Default to ONE agent.

Do not spawn subagents for copy/content changes, styling, responsive fixes, navigation changes, image swaps, social links, CTA changes, Mailchimp/FormSubmit changes, or ordinary front-end bugs.

Do not create multiple competing implementations or worktrees unless explicitly requested. Ask before parallel work.

## Context Efficiency
- Do not scan all assets unless the task concerns the asset library.
- Search by page, component, class, image filename, or integration name.
- Avoid repeatedly reading generated/build output.
- Batch small UI changes before a production build.
- Reuse the current dev server/browser session where possible.
- Do not run broad audits unless explicitly requested.

## Brand / UX Priorities
The site should feel premium, modern, golf-specific, clean, and mobile-friendly.

Keep primary CTAs obvious:
- Book
- Join
- Book an Event

Do not bury booking or membership actions.

## UI Rules
- Preserve mobile usability.
- Maintain established spacing/component patterns.
- Avoid unnecessary visual churn.
- Do not redesign unrelated pages.
- Reuse existing components.
- Validate common desktop/mobile widths.

## Forms / Integrations
For contact forms, FormSubmit, Mailchimp, or similar:
- preserve working submission behavior,
- do not expose secrets,
- verify redirects/captcha behavior if relevant,
- verify merge/tag fields,
- verify required fields,
- test an appropriate end-to-end path when needed.

## Assets
- Do not delete assets unless clearly unused and requested.
- Prefer existing optimized assets.
- Do not replace high-resolution source assets with lower-quality versions.
- Keep filenames/paths stable when possible.
- Avoid scanning/reprocessing the full image library for a small change.

## Testing
1. affected component/page
2. responsive/mobile check
3. affected form/integration
4. targeted lint/test
5. production build once near completion

## Session Boundaries
After a meaningful feature/fix, commit and start a fresh Claude session for unrelated work.

Use `/compact` only when continuing the SAME task.
