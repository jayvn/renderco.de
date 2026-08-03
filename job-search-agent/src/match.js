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
    return {
      ...job,
      score,
      matchedKeywords,
      titleMatch,
      matched: score >= profile.min_match_score,
    };
  });
}

module.exports = { scoreJob, scoreJobs };
