const path = require("path");
const { chromium } = require("playwright");

function fixtureUrl(fixturePath) {
  return "file://" + path.resolve(fixturePath);
}

async function scrapeLinkedInSearch(page, source) {
  if (source.mode === "live") {
    throw new Error(
      `Live LinkedIn scraping is not implemented in v1 (source "${source.name}"). ` +
        "LinkedIn requires an authenticated session and actively blocks automated " +
        "browsers; see README.md 'Going live' before attempting this."
    );
  }
  await page.goto(fixtureUrl(source.fixture));
  return page.$$eval(".job-card", (cards) =>
    cards.map((card) => ({
      title: card.querySelector(".base-search-card__title")?.textContent.trim(),
      company: card.querySelector(".base-search-card__subtitle")?.textContent.trim(),
      location: card.querySelector(".job-search-card__location")?.textContent.trim(),
      url: card.querySelector(".base-card__full-link")?.href,
      description: card.querySelector(".job-card__description")?.textContent.trim(),
    }))
  );
}

async function scrapeCompanyCareerPage(page, source) {
  if (source.mode === "live") {
    const sel = source.live.selectors;
    await page.goto(source.live.url);
    return page.$$eval(
      sel.job_card,
      (cards, sel) =>
        cards.map((card) => ({
          title: card.querySelector(sel.title)?.textContent.trim(),
          location: card.querySelector(sel.location)?.textContent.trim(),
          url: card.querySelector(sel.link)?.href,
          description: card.textContent.trim(),
        })),
      sel
    );
  }
  await page.goto(fixtureUrl(source.fixture));
  const jobs = await page.$$eval(".opening", (cards) =>
    cards.map((card) => ({
      title: card.querySelector(".opening-title")?.textContent.trim(),
      location: card.querySelector(".opening-location")?.textContent.trim(),
      url: card.querySelector("a")?.href,
      description: card.querySelector(".opening-description")?.textContent.trim(),
      salary: card.querySelector(".opening-salary")?.textContent.trim() || null,
    }))
  );
  return jobs.map((job) => ({ ...job, company: source.name }));
}

// EPO's mock fixture reuses the same .opening markup as a generic company
// career page — it's a career-page scrape either way, just a different name.
async function scrapeEpoCareers(page, source) {
  if (source.mode === "live") {
    throw new Error(
      `Live EPO scraping not enabled (source "${source.name}"): selectors were never ` +
        "verified against the real site because this environment's network policy " +
        "blocks jobs.epo.org. Confirm the DOM structure manually before flipping this to live."
    );
  }
  return scrapeCompanyCareerPage(page, { ...source, name: source.name });
}

async function scrapeGoogleJobsSearch(page, source) {
  if (source.mode === "live") {
    throw new Error(
      `Live Google Jobs scraping not enabled (source "${source.name}"): this ` +
        "environment's network policy blocks google.com, and the jobs SERP is " +
        "JS-heavy/anti-scraping even when reachable. See README.md."
    );
  }
  await page.goto(fixtureUrl(source.fixture));
  return page.$$eval(".job-listing", (cards) =>
    cards.map((card) => ({
      title: card.querySelector(".job-title")?.textContent.trim(),
      company: card.querySelector(".job-company")?.textContent.trim(),
      location: card.querySelector(".job-location")?.textContent.trim(),
      url: card.querySelector(".job-link")?.href,
      description: card.querySelector(".job-description")?.textContent.trim(),
      salary: card.querySelector(".job-salary")?.textContent.trim() || null,
    }))
  );
}

async function scrapeSource(browser, source) {
  const page = await browser.newPage();
  try {
    let jobs;
    if (source.type === "linkedin_search") {
      jobs = await scrapeLinkedInSearch(page, source);
    } else if (source.type === "company_career_page") {
      jobs = await scrapeCompanyCareerPage(page, source);
    } else if (source.type === "epo_careers") {
      jobs = await scrapeEpoCareers(page, source);
    } else if (source.type === "google_jobs_search") {
      jobs = await scrapeGoogleJobsSearch(page, source);
    } else {
      throw new Error(`Unknown source type: ${source.type}`);
    }
    return jobs.map((job) => ({ ...job, source: source.name }));
  } finally {
    await page.close();
  }
}

async function scrapeAllSources(sources) {
  const browser = await chromium.launch();
  try {
    const results = [];
    for (const source of sources) {
      const jobs = await scrapeSource(browser, source);
      results.push(...jobs);
    }
    return results;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeAllSources };
