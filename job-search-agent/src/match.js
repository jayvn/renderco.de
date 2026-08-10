// Best-effort only: pulls the largest number out of a salary string and
// normalizes "150k" style shorthand. Treats EUR/CHF/USD as equivalent,
// which is wrong for precise comparison but fine for a coarse floor filter.
// Returns null (salary unknown) rather than guessing when nothing parses —
// unknown salary must never be treated as "below threshold".
function parseSalaryK(salaryText) {
  if (!salaryText) return null;
  const matches = [...salaryText.matchAll(/(\d[\d,]*)\s*(k\b)?/gi)]
    .map(([, num, k]) => {
      const n = parseInt(num.replace(/,/g, ""), 10);
      if (Number.isNaN(n)) return null;
      return k ? n : n / 1000;
    })
    .filter((n) => n !== null && n > 1); // drop noise like a lone "8" or "10"
  if (!matches.length) return null;
  return Math.max(...matches);
}

function scoreJob(job, profile) {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const matchedKeywords = profile.keywords.filter((kw) =>
    text.includes(kw.toLowerCase())
  );
  const titleMatch = profile.target_titles.some((t) =>
    job.title?.toLowerCase().includes(t.toLowerCase())
  );
  return {
    score: matchedKeywords.length + (titleMatch ? 1 : 0),
    matchedKeywords,
    titleMatch,
  };
}

function scoreJobs(jobs, profile) {
  return jobs.map((job) => {
    const { score, matchedKeywords, titleMatch } = scoreJob(job, profile);
    const salaryK = parseSalaryK(job.salary);
    const belowSalaryFloor =
      profile.min_salary_k != null && salaryK != null && salaryK < profile.min_salary_k;
    return {
      ...job,
      score,
      matchedKeywords,
      titleMatch,
      salaryK,
      belowSalaryFloor,
      matched: score >= profile.min_match_score && !belowSalaryFloor,
    };
  });
}

module.exports = { scoreJob, scoreJobs, parseSalaryK };
