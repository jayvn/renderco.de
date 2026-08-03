# Instructions for the Claude session (not for the script)

`src/runDaily.js` does the mechanical work only: scrape sources, dedupe
against `state/seen.json`, score against `config/profile.yaml`, and write
one folder per matched job under `output/<date>/` containing `listing.md`
and `job.json`. It deliberately does **not** write cover letters — that's
the part that needs judgment, and is done by whichever Claude session runs
this (interactively or via the daily Cron prompt in `cron/daily-prompt.md`).

After running `node src/runDaily.js`, for each new folder under
`output/<date>/`:

1. Read `config/resume.md` and the job's `listing.md`.
2. Decide if the match is actually good, not just keyword-good — skip (note
   why in `summary.md`) if the role is a poor fit despite scoring above
   threshold.
3. Write a tailored `cover_letter.md` in that job's folder: 3-4 paragraphs,
   grounded only in things actually in the resume (never invent experience
   or credentials), referencing 1-2 specifics from the job description.
4. Update `output/<date>/summary.md` if your judgment changed anything from
   the mechanical pass.
5. `git add -A && git commit -m "Daily job search: <date>" && git push`

This repo never auto-submits applications. Every folder under `output/` is
a draft for a human to review, and then apply manually.
