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
LinkedIn search page, a fake EPO careers page, a fake Google Jobs search,
and two fake company career pages) — no network, no credentials, safe to
run repeatedly. `output/2026-08-03/` and `output/2026-08-10/` in this repo
are real example output from those runs, including real (mock-data) drafted
cover letters, so you can see the whole pipeline without running anything.

Then, in a Claude session: open `ANALYZE.md` and follow it to draft cover
letters for any new matched jobs.

## Configuring for real use

1. Replace `config/resume.md` with your actual resume.
2. Edit `config/profile.yaml`: target titles, keywords used for scoring,
   locations, `min_match_score` (raise it to be pickier), and
   `min_salary_k` — a jobs with a *parseable* salary below this is excluded
   outright, even if it scores well on keywords. Most EU/Swiss postings
   (EPO included) don't publish a number at all; those are scored on
   keywords only, with salary shown as "not listed" in the output so a
   human can judge.
3. Edit `config/sources.yaml`:
   - Company career pages (incl. EPO, which uses the same scraper as a
     generic company career page): switch a source to `mode: live` and
     fill in `live.url` + `live.selectors` (job card / title / location /
     link CSS selectors — every career page's HTML is different, there's
     no way around inspecting each one).
   - Google Jobs and LinkedIn: **live mode isn't implemented.** See below.

## Going live: EPO, Google Jobs, LinkedIn

None of these three are live yet. Two separate problems block them,
independently of each other:

1. **This environment's network policy.** The sandbox this v1 was built in
   only allowlists a small set of domains (GitHub, npm, etc.) — outbound
   requests to `jobs.epo.org`, `google.com`, and `linkedin.com` are all
   blocked at the egress proxy, so none of the "live" selectors above have
   actually been verified against the real DOM. If you run this from an
   environment with normal internet access, that blocker goes away, but the
   selectors in the commented-out `live:` blocks are still just best
   guesses and need to be checked by hand against the real page first.
2. **LinkedIn specifically** also requires an authenticated session to see
   full search results, and rate-limits/fingerprints automated browsers on
   top of that — its ToS prohibits scraping. Even with network access,
   treat it as the highest-risk source:
   - Launch Playwright with a persistent context signed into your own
     account (`chromium.launchPersistentContext`), never headless.
   - Expect selectors to break; LinkedIn's DOM changes often and has no
     stable class names to rely on long-term.
   - Go slowly (one search per run, real delays) — this is the source most
     likely to get an account flagged.

EPO and company career pages (Greenhouse, Lever, or bespoke) are the most
reliable live sources once network access allows reaching them — no login
wall, and a much more forgiving ToS posture than LinkedIn or Google's SERP.

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
