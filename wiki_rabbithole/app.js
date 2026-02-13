const feedContainer = document.getElementById('feed-container');
const modal = document.getElementById('article-modal');
const modalBody = document.getElementById('modal-body');
const modalHeader = document.querySelector('.modal-header');
const searchWrapper = document.getElementById('search-wrapper');
const searchInput = document.getElementById('wiki-search');
const searchResults = document.getElementById('search-results');
const overlayView = document.getElementById('overlay-view');
const overlayTitle = document.getElementById('overlay-title');
const overlayContent = document.getElementById('overlay-content');
const readingProgress = document.getElementById('reading-progress');
const swipeHint = document.getElementById('swipe-hint');
const toast = document.getElementById('toast');

let articlesMap = new Map();
let loading = false;
let currentArticle = null;
let navStack = [];
let feedMode = localStorage.getItem('feedMode') || 'random';
let likedArticles = JSON.parse(localStorage.getItem('likedArticles') || '{}');
let history = JSON.parse(localStorage.getItem('readHistory') || '[]');

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const wikiApi = async (params) => {
    const res = await fetch(`${WIKI_API}?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`);
    return res.json();
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadArticles();
    
    // Hide swipe hint after first scroll
    if (localStorage.getItem('seenHint')) {
        swipeHint.classList.add('hidden');
    } else {
        feedContainer.addEventListener('scroll', () => {
            swipeHint.classList.add('hidden');
            localStorage.setItem('seenHint', '1');
        }, { once: true });
    }

    // Infinite scroll
    feedContainer.addEventListener('scroll', () => {
        if (feedContainer.scrollTop + feedContainer.clientHeight >= feedContainer.scrollHeight - 800) {
            loadArticles();
        }
    }, { passive: true });

    // Search
    document.getElementById('search-toggle-btn').onclick = () => {
        searchWrapper.classList.toggle('active');
        if (searchWrapper.classList.contains('active')) searchInput.focus();
    };

    let searchTimer;
    searchInput.oninput = (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => handleSearch(e.target.value), 300);
    };

    // Nav buttons
    document.getElementById('home-btn').onclick = () => switchFeed('random');
    document.getElementById('foryou-btn').onclick = () => switchFeed('foryou');
    document.getElementById('history-btn').onclick = () => showOverlay('history');
    document.getElementById('saved-btn').onclick = () => showOverlay('saved');

    // Reading progress
    modalBody.onscroll = () => {
        const pct = (modalBody.scrollTop / (modalBody.scrollHeight - modalBody.clientHeight)) * 100;
        readingProgress.style.width = Math.min(100, pct) + '%';
    };

    // Back button
    window.onpopstate = (e) => {
        if (modal.classList.contains('active')) {
            if (navStack.length > 1) {
                navStack.pop();
                openArticle(navStack[navStack.length - 1].title, true);
            } else {
                closeArticle(true);
            }
        } else if (overlayView.classList.contains('active')) {
            closeOverlay(true);
        }
    };

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
});

function switchFeed(mode) {
    const newMode = mode === 'foryou' ? 'recommended' : 'random';
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === mode || (mode === 'random' && btn.dataset.target === 'home'));
    });

    if (feedMode === newMode) return;
    
    feedMode = newMode;
    localStorage.setItem('feedMode', feedMode);
    articlesMap.clear();
    feedContainer.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
    loadArticles();
}

async function loadArticles() {
    if (loading) return;
    loading = true;

    let articles;
    if (feedMode === 'recommended' && Object.keys(likedArticles).length > 0) {
        articles = await fetchRecommended();
    } else {
        if (feedMode === 'recommended') {
            // Show empty state for For You when no likes
            feedContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">✨</div>
                    <h3>Your personal feed</h3>
                    <p>Like some articles from Discover to get personalized recommendations</p>
                </div>
            `;
            loading = false;
            return;
        }
        articles = await fetchRandom();
    }

    document.querySelector('.loading-state')?.remove();
    document.querySelector('.empty-state')?.remove();

    articles.forEach(article => {
        if (!articlesMap.has(article.title)) {
            feedContainer.appendChild(createFeedItem(article));
            articlesMap.set(article.title, article);
        }
    });
    
    loading = false;
}

async function fetchRandom() {
    const data = await wikiApi({
        action: 'query', generator: 'random', grnnamespace: 0, prop: 'extracts|pageimages',
        grnlimit: 5, exintro: 1, explaintext: 1, pithumbsize: 800
    });
    return Object.values(data.query?.pages || {})
        .filter(p => p.extract)
        .map(p => ({
            title: p.title,
            summary: p.extract,
            image: p.thumbnail?.source
        }));
}

async function fetchRecommended() {
    const allCats = Object.values(likedArticles).flatMap(a => a.categories || []);
    if (!allCats.length) return fetchRandom();

    const cat = allCats[Math.floor(Math.random() * allCats.length)];
    const data = await wikiApi({
        action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`,
        cmlimit: 15, cmnamespace: 0
    });

    const members = (data.query?.categorymembers || [])
        .filter(m => !likedArticles[m.title] && !articlesMap.has(m.title))
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);

    if (!members.length) return fetchRandom();

    const details = await wikiApi({
        action: 'query', titles: members.map(m => m.title).join('|'),
        prop: 'extracts|pageimages', exintro: 1, explaintext: 1, pithumbsize: 800
    });

    return Object.values(details.query?.pages || {})
        .filter(p => p.extract)
        .map(p => ({
            title: p.title,
            summary: p.extract,
            image: p.thumbnail?.source
        }));
}

function createFeedItem(article) {
    const item = document.createElement('div');
    item.className = 'feed-item';
    if (article.image) item.style.backgroundImage = `url(${article.image})`;
    
    const liked = !!likedArticles[article.title];
    const safeTitle = article.title.replace(/'/g, "\\'");
    
    item.innerHTML = `
        <div class="content-overlay">
            <h2 class="article-title">${article.title}</h2>
            <p class="article-excerpt">${article.summary}</p>
            <div class="feed-actions">
                <button class="feed-btn read-btn" onclick="openArticle('${safeTitle}')">Read →</button>
                <button class="feed-btn like-btn ${liked ? 'liked' : ''}" data-title="${article.title}" onclick="event.stopPropagation(); toggleLike('${safeTitle}')">
                    ${liked ? '❤️ Saved' : '🤍 Save'}
                </button>
            </div>
        </div>
    `;
    
    item.onclick = (e) => {
        if (!e.target.closest('.feed-btn')) openArticle(article.title);
    };
    
    return item;
}

async function handleSearch(query) {
    if (query.length < 2) {
        searchResults.innerHTML = '';
        return;
    }

    const data = await wikiApi({ action: 'opensearch', search: query, limit: 6 });
    searchResults.innerHTML = (data[1] || []).map(title => {
        const safeTitle = title.replace(/'/g, "\\'");
        return `<div class="search-result-item" onclick="openArticle('${safeTitle}'); closeSearch()">${title}</div>`;
    }).join('') || '<div style="padding:12px;color:#666">No results</div>';
}

window.closeSearch = () => {
    searchWrapper.classList.remove('active');
    searchInput.value = '';
    searchResults.innerHTML = '';
};

window.openArticle = async function(title, isBack = false) {
    modal.classList.add('active');
    modalBody.innerHTML = '<div class="loader" style="margin:40px auto"></div>';
    readingProgress.style.width = '0%';
    currentArticle = { title };

    if (!isBack) {
        navStack.push({ title });
        window.history.pushState({ article: title }, '', '#' + encodeURIComponent(title));
        addToHistory(title);
    }

    const data = await wikiApi({ action: 'parse', page: title, prop: 'text', mobileformat: 1 });
    if (!data?.parse) {
        modalBody.innerHTML = '<p style="padding:20px">Failed to load article</p>';
        return;
    }

    const articleTitle = data.parse.title;
    currentArticle = { title: articleTitle, ...articlesMap.get(articleTitle) };
    
    const liked = !!likedArticles[articleTitle];
    const safeTitle = articleTitle.replace(/'/g, "\\'");
    const depth = navStack.length;
    
    modalHeader.innerHTML = `
        ${depth > 1 ? '<button class="circle-btn" onclick="goBack()">←</button>' : ''}
        <div style="flex:1;min-width:0">
            ${depth > 1 ? `<div class="nav-path">📚 ${depth} articles deep</div>` : ''}
            <h2 class="modal-title">${articleTitle}</h2>
        </div>
        <div class="modal-actions">
            <button class="circle-btn" id="modal-like" onclick="toggleLike('${safeTitle}')">${liked ? '❤️' : '🤍'}</button>
            <button class="circle-btn" onclick="shareArticle()">↗️</button>
            <button class="circle-btn" onclick="closeArticle()">✕</button>
        </div>
    `;

    // Parse content
    const div = document.createElement('div');
    div.innerHTML = data.parse.text['*'];
    div.querySelectorAll('.mw-editsection, .reference, .mbox-small, .navbox, .sistersitebox').forEach(el => el.remove());
    
    modalBody.innerHTML = '';
    modalBody.appendChild(div);
    modalBody.scrollTop = 0;

    // Handle links
    modalBody.querySelectorAll('a').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href?.startsWith('/wiki/') && !href.includes(':')) {
                openArticle(decodeURIComponent(href.split('/wiki/')[1].split('#')[0]));
            } else if (href?.startsWith('http')) {
                window.open(href, '_blank');
            }
        };
    });
};

window.goBack = () => {
    if (navStack.length > 1) {
        navStack.pop();
        openArticle(navStack[navStack.length - 1].title, true);
    }
};

window.closeArticle = (fromPopstate = false) => {
    modal.classList.remove('active');
    navStack = [];
    currentArticle = null;
    if (!fromPopstate) window.history.pushState({}, '', location.pathname);
};

window.shareArticle = async () => {
    if (!currentArticle) return;
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(currentArticle.title)}`;
    
    if (navigator.share) {
        navigator.share({ title: currentArticle.title, url });
    } else {
        await navigator.clipboard.writeText(url);
        showToast('Link copied!');
    }
};

window.toggleLike = async function(title) {
    const wasLiked = !!likedArticles[title];

    if (wasLiked) {
        delete likedArticles[title];
        showToast('Removed from saved');
    } else {
        const meta = articlesMap.get(title) || {};
        const cats = await fetchCategories(title);
        likedArticles[title] = { title, image: meta.image, summary: meta.summary, categories: cats };
        showToast('Saved!');
    }

    localStorage.setItem('likedArticles', JSON.stringify(likedArticles));
    const nowLiked = !wasLiked;

    // Update feed buttons
    document.querySelectorAll('.like-btn').forEach(btn => {
        if (btn.dataset.title === title) {
            btn.innerHTML = nowLiked ? '❤️ Saved' : '🤍 Save';
            btn.classList.toggle('liked', nowLiked);
        }
    });

    // Update modal button
    if (currentArticle?.title === title) {
        const btn = document.getElementById('modal-like');
        if (btn) btn.innerHTML = nowLiked ? '❤️' : '🤍';
    }
};

async function fetchCategories(title) {
    const data = await wikiApi({
        action: 'query', titles: title, prop: 'categories', cllimit: 10, clshow: '!hidden'
    });
    const page = Object.values(data.query?.pages || {})[0];
    return (page?.categories || [])
        .map(c => c.title.replace('Category:', ''))
        .filter(c => !/articles|Pages|Wikipedia|CS1|stub/i.test(c));
}

function addToHistory(title) {
    history = history.filter(h => h.title !== title);
    history.unshift({ title, time: Date.now(), image: articlesMap.get(title)?.image });
    history = history.slice(0, 50);
    localStorage.setItem('readHistory', JSON.stringify(history));
}

function showOverlay(type) {
    overlayTitle.textContent = type === 'history' ? 'History' : 'Saved';
    overlayView.classList.add('active');
    window.history.pushState({ overlay: type }, '', '#' + type);

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === type);
    });

    if (type === 'history') {
        if (!history.length) {
            overlayContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🕐</div>
                    <h3>No history yet</h3>
                    <p>Articles you read will appear here</p>
                </div>
            `;
            return;
        }
        overlayContent.innerHTML = history.map(h => {
            const safeTitle = h.title.replace(/'/g, "\\'");
            const time = formatTime(h.time);
            return `
                <div class="history-item" onclick="closeOverlay(); openArticle('${safeTitle}')">
                    <div class="item-thumb" style="${h.image ? `background-image:url(${h.image})` : ''}"></div>
                    <div class="item-info">
                        <div class="item-title">${h.title}</div>
                        <div class="item-meta">${time}</div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        const saved = Object.values(likedArticles);
        if (!saved.length) {
            overlayContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❤️</div>
                    <h3>No saved articles</h3>
                    <p>Tap the heart on articles you want to save for later</p>
                </div>
            `;
            return;
        }
        overlayContent.innerHTML = saved.map(a => {
            const safeTitle = a.title.replace(/'/g, "\\'");
            return `
                <div class="saved-item" onclick="closeOverlay(); openArticle('${safeTitle}')">
                    <div class="item-thumb" style="${a.image ? `background-image:url(${a.image})` : ''}"></div>
                    <div class="item-info">
                        <div class="item-title">${a.title}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

window.closeOverlay = (fromPopstate = false) => {
    overlayView.classList.remove('active');
    if (!fromPopstate) window.history.pushState({}, '', location.pathname);
    
    // Reset nav to current feed mode
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', 
            (feedMode === 'recommended' && btn.dataset.target === 'foryou') ||
            (feedMode === 'random' && btn.dataset.target === 'home')
        );
    });
};

function formatTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return new Date(ts).toLocaleDateString();
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}
