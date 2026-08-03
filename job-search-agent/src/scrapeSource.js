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
    }))
  );
  return jobs.map((job) => ({ ...job, company: source.name }));
}

async function scrapeSource(browser, source) {
  const page = await browser.newPage();
  try {
    let jobs;
    if (source.type === "linkedin_search") {
      jobs = await scrapeLinkedInSearch(page, source);
    } else if (source.type === "company_career_page") {
      jobs = await scrapeCompanyCareerPage(page, source);
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
