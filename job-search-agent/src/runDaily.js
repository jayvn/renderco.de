const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const { scrapeAllSources } = require("./scrapeSource");
const { loadSeen, saveSeen, filterNewJobs } = require("./dedupe");
const { scoreJobs } = require("./match");

const ROOT = path.resolve(__dirname, "..");
const SEEN_PATH = path.join(ROOT, "state", "seen.json");

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const profile = yaml.load(
    fs.readFileSync(path.join(ROOT, "config", "profile.yaml"), "utf8")
  );
  const sources = yaml.load(
    fs.readFileSync(path.join(ROOT, "config", "sources.yaml"), "utf8")
  );

  console.log(`Scraping ${sources.length} source(s)...`);
  const rawJobs = await scrapeAllSources(sources);
  console.log(`Found ${rawJobs.length} listing(s) total.`);

  const seen = loadSeen(SEEN_PATH);
  const newJobs = filterNewJobs(rawJobs, seen);
  console.log(`${newJobs.length} are new (not previously processed).`);

  const scored = scoreJobs(newJobs, profile);
  const matched = scored.filter((j) => j.matched);
  const skipped = scored.filter((j) => !j.matched);

  const outDir = path.join(ROOT, "output", todayStamp());
  fs.mkdirSync(outDir, { recursive: true });

  for (const job of matched) {
    const jobDir = path.join(
      outDir,
      `${job.id}-${slugify(job.company)}-${slugify(job.title)}`
    );
    fs.mkdirSync(jobDir, { recursive: true });
    fs.writeFileSync(path.join(jobDir, "job.json"), JSON.stringify(job, null, 2) + "\n");
    fs.writeFileSync(
      path.join(jobDir, "listing.md"),
      [
        `# ${job.title} — ${job.company}`,
        "",
        `- Source: ${job.source}`,
        `- Location: ${job.location || "unknown"}`,
        `- URL: ${job.url}`,
        `- Match score: ${job.score} (keywords: ${job.matchedKeywords.join(", ") || "none"})`,
        `- Salary: ${job.salary || "not listed"}${job.salaryK ? ` (parsed ~${job.salaryK}k)` : ""}`,
        "",
        "## Description",
        "",
        job.description || "(no description scraped)",
        "",
        "## Cover letter",
        "",
        "_Not yet drafted. See ANALYZE.md — this is written by the Claude session, not this script._",
        "",
      ].join("\n")
    );
  }

  const summaryLines = [
    `# Daily job search — ${todayStamp()}`,
    "",
    `- Sources scraped: ${sources.length}`,
    `- Listings found: ${rawJobs.length}`,
    `- New (unseen) listings: ${newJobs.length}`,
    `- Matched (>= score ${profile.min_match_score}, salary floor ${profile.min_salary_k ?? "none"}k): ${matched.length}`,
    `- Skipped (below score threshold or salary floor): ${skipped.length}`,
    "",
    "## Matched jobs (drafts pending in this folder)",
    "",
    ...(matched.length
      ? matched.map(
          (j) =>
            `- **${j.title}** at ${j.company} — score ${j.score}, salary ${
              j.salary || "not listed"
            } (${j.source})`
        )
      : ["_None today._"]),
    "",
    "## Skipped (below match threshold or salary floor)",
    "",
    ...(skipped.length
      ? skipped.map(
          (j) =>
            `- ${j.title} at ${j.company} — score ${j.score}` +
            (j.belowSalaryFloor ? ` (salary ${j.salary} below floor)` : "")
        )
      : ["_None._"]),
    "",
  ];
  fs.writeFileSync(path.join(outDir, "summary.md"), summaryLines.join("\n"));

  for (const job of scored) {
    seen[job.id] = {
      title: job.title,
      company: job.company,
      firstSeen: seen[job.id]?.firstSeen || new Date().toISOString(),
      matched: job.matched,
    };
  }
  saveSeen(SEEN_PATH, seen);

  console.log(`Wrote ${matched.length} job packet(s) to ${outDir}`);
  console.log("Next: have Claude read ANALYZE.md and draft cover letters for each matched job.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
