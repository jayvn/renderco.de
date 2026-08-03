Prompt used with Claude Code's Cron tool to fire this pipeline daily.

IMPORTANT CAVEAT: this only works while the Claude Code session that
scheduled it is still alive. It is session-scoped and auto-expires after 7
days at the latest — it is NOT a durable "forever" scheduler. For a
permanent daily job, replace this with a GitHub Actions scheduled workflow
instead (see README.md "Making this durable").

---

cd into the job-search-agent repo (clone if not already present), git pull,
then:

1. Run `npm install` if node_modules is missing, then `node src/runDaily.js`.
2. Read ANALYZE.md and follow it: for each new folder under
   `output/<today>/`, read config/resume.md and listing.md, use your own
   judgment on whether it's a genuinely good match (not just a keyword
   match), and write a tailored cover_letter.md. Skip (and note why in
   summary.md) anything that scored above threshold but isn't actually a
   good fit.
3. Never edit or fill in an actual job application form, and never submit
   anything — this repo is draft-only.
4. git add -A, commit as "Daily job search: <date>", and push.
