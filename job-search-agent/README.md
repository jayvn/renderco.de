# job-search-agent

Playwright does the mechanical job-search work; a Claude session does the
judgment work (deciding if a match is real, writing the cover letter).
**Draft-only** — this never fills out or submits a real application form.
Everything it produces lands in `output/<date>/` for a human to review and
apply manually.

## Why draft-only

Most job boards (LinkedIn included) prohibit automated form submission in
their ToS, and letting an agent submit real applications unsupervised risks
duplicate/bad-fit applications and account bans. Search-and-draft carries
none of that risk and is where the actual value is anyway — the tedious
part of a job search is finding the right roles and writing the first draft
of a tailored letter, not clicking submit.

## How it's split

- **`src/` (Playwright, deterministic)** — scrapes configured sources,
  dedupes against `state/seen.json`, scores each listing against
  `config/profile.yaml` by keyword overlap, and writes one folder per
  matched job under `output/<date>/` with `listing.md` + `job.json`. Never
  writes a cover letter — a keyword match is not a judgment call.
- **Claude (via `ANALYZE.md`)** — reads the resume and each matched
  listing, applies actual judgment (a keyword match can still be a bad
  fit), and writes `cover_letter.md` per job. This is the step that makes
  "use Claude" true instead of templating a form letter.

## Quick start

```
npm install
node src/runDaily.js
```

This runs against the bundled **mock fixtures** in `fixtures/` (a fake
LinkedIn search page and two fake company career pages) — no network, no
credentials, safe to run repeatedly. `output/2026-08-03/` in this repo is
real example output from that run, including four real (mock-data) drafted
cover letters, so you can see the whole pipeline without running anything.

Then, in a Claude session: open `ANALYZE.md` and follow it to draft cover
letters for any new matched jobs.

## Configuring for real use

1. Replace `config/resume.md` with your actual resume.
2. Edit `config/profile.yaml`: target titles, keywords used for scoring,
   locations, and `min_match_score` (raise it to be pickier).
3. Edit `config/sources.yaml`:
   - Company career pages: switch a source to `mode: live` and fill in
     `live.url` + `live.selectors` (job card / title / location / link CSS
     selectors — every career page's HTML is different, there's no way
     around inspecting each one).
   - LinkedIn: **live mode isn't implemented.** See below.

## Going live on LinkedIn

v1 deliberately ships without a live LinkedIn scraper. LinkedIn requires an
authenticated session to see full search results, rate-limits and
fingerprints automated browsers, and its ToS prohibits scraping. A minimal
path if you want to try anyway:
- Launch Playwright with a persistent context signed into your own account
  (`chromium.launchPersistentContext`), never headless.
- Expect selectors to break; LinkedIn's DOM changes often and has no stable
  class names to rely on long-term.
- Go slowly (one search per run, real delays) — this is the source most
  likely to get an account flagged.

Company career pages (Greenhouse, Lever, or bespoke) are a much more
reliable live source and don't have this problem.

## Making this durable

The included `cron/daily-prompt.md` is meant for Claude Code's built-in
Cron tool, which is **session-scoped**: it stops firing the moment the
scheduling session ends, and auto-expires after 7 days regardless. That's
fine for testing, not for a real "every morning" job.

For an actual durable daily run, replace it with a GitHub Actions scheduled
workflow (`on: schedule`, `cron: '0 10 * * *'`) that checks out this repo,
runs `node src/runDaily.js`, calls the Claude API to do the ANALYZE.md step
programmatically, and commits the result. Not included in v1 — ask if you
want it built.

## Repo layout

```
config/         resume, matching profile, source list — yours to edit
fixtures/       mock HTML pages the scraper reads in mock mode
src/            the deterministic Playwright + matching pipeline
state/seen.json dedupe log so the same listing isn't reprocessed
output/<date>/  per-run results: matched job folders + summary.md
ANALYZE.md      instructions for the Claude step (not run by any script)
cron/           the Cron prompt, and its caveats
```
