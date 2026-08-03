const fs = require("fs");
const crypto = require("crypto");

function jobId(job) {
  return crypto
    .createHash("sha1")
    .update(`${job.company}|${job.title}|${job.url}`.toLowerCase())
    .digest("hex")
    .slice(0, 12);
}

function loadSeen(seenPath) {
  if (!fs.existsSync(seenPath)) return {};
  return JSON.parse(fs.readFileSync(seenPath, "utf8"));
}

function saveSeen(seenPath, seen) {
  fs.writeFileSync(seenPath, JSON.stringify(seen, null, 2) + "\n");
}

function filterNewJobs(jobs, seen) {
  return jobs
    .map((job) => ({ ...job, id: jobId(job) }))
    .filter((job) => !seen[job.id]);
}

module.exports = { jobId, loadSeen, saveSeen, filterNewJobs };
