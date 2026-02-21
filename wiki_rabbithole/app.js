const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => el.querySelectorAll(s);

const feed = $('#feed');
const articleDialog = $('#article-dialog');
const overlayDialog = $('#overlay-dialog');
const searchResults = $('#search-results');
const toast = $('#toast');

let articles = new Map();
let loading = false;
let currentArticle = null;
let navStack = [];
let feedMode = localStorage.feedMode || 'random';
let liked = JSON.parse(localStorage.likedArticles || '{}');
let history = JSON.parse(localStorage.readHistory || '[]');
let tree = JSON.parse(localStorage.explorationTree || '{"nodes":{},"edges":[],"sessions":[]}');
let sessionId = null;

const wikiApi = async (params) => {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`);
    return res.json();
};

// Init
feed.addEventListener('scroll', () => {
    if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 800) loadArticles();
}, { passive: true });

$('#wiki-search').oninput = debounce(async (e) => {
    const q = e.target.value;
    if (q.length < 2) { searchResults.innerHTML = ''; return; }
    const data = await wikiApi({ action: 'opensearch', search: q, limit: 6 });
    searchResults.innerHTML = (data[1] || []).map(t =>
        `<div class="search-result-item" data-title="${t}">${t}</div>`
    ).join('') || '<div style="padding:12px;color:#666">No results</div>';
}, 300);

searchResults.onclick = (e) => {
    const item = e.target.closest('[data-title]');
    if (item) {
        openArticle(item.dataset.title);
        $('#search-popover').hidePopover();
    }
};

$('#nav').onclick = (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    if (btn.dataset.mode) switchFeed(btn.dataset.mode);
    else if (btn.dataset.view) showOverlay(btn.dataset.view);
};

$('.modal-body', articleDialog).onscroll = (e) => {
    const el = e.target;
    $('.reading-progress', articleDialog).style.width =
        Math.min(100, (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100) + '%';
};

$('.close-overlay', overlayDialog).onclick = () => history.back();

articleDialog.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'back') goBack();
    else if (action === 'like') toggleLike(currentArticle.title);
    else if (action === 'share') shareArticle();
    else if (action === 'close') history.back();
};

feed.onclick = (e) => {
    const item = e.target.closest('.feed-item');
    if (!item) return;
    const title = item.dataset.title;
    if (e.target.closest('.like-btn')) toggleLike(title);
    else openArticle(title);
};

overlayDialog.querySelector('.overlay-content').onclick = (e) => {
    const item = e.target.closest('[data-title]');
    if (item) {
        overlayDialog.close();
        openArticle(item.dataset.title);
    }
    if (e.target.closest('.clear-tree')) {
        tree = { nodes: {}, edges: [], sessions: [] };
        delete localStorage.explorationTree;
        showOverlay('tree');
        showToast('Tree cleared');
    }
};

articleDialog.addEventListener('close', () => {
    navStack = [];
    currentArticle = null;
    sessionId = null;
});

// Browser back button support
window.addEventListener('popstate', (e) => {
    if (e.state?.type === 'article' && articleDialog.open) {
        // Navigate back within articles
        if (navStack.length > 1) {
            navStack.pop();
            openArticle(navStack.at(-1).title, true);
        } else {
            articleDialog.close();
        }
    } else if (articleDialog.open) {
        articleDialog.close();
    } else if (overlayDialog.open) {
        overlayDialog.close();
    }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });

loadArticles();
setActiveNav();

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function switchFeed(mode) {
    if (feedMode === mode) return;
    feedMode = mode;
    localStorage.feedMode = mode;
    articles.clear();
    feed.innerHTML = '<div class="loading-state"><div class="loader"></div></div>';
    setActiveNav();
    loadArticles();
}

function setActiveNav() {
    $$('.nav-item', $('#nav')).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === feedMode);
    });
}

async function loadArticles() {
    if (loading) return;
    loading = true;

    try {
        let data;
        if (feedMode === 'foryou' && Object.keys(liked).length > 0) {
            data = await fetchRecommended();
        } else if (feedMode === 'foryou') {
            feed.innerHTML = `<div class="empty-state"><div class="empty-icon">✨</div><h3>Your personal feed</h3><p>Like some articles to get recommendations</p></div>`;
            return;
        } else {
            data = await fetchRandom();
        }

        feed.querySelector('.loading-state')?.remove();
        feed.querySelector('.empty-state')?.remove();

        for (const a of data) {
            if (articles.has(a.title)) continue;
            articles.set(a.title, a);
            feed.insertAdjacentHTML('beforeend', `
                <div class="feed-item ${a.image ? 'has-image' : ''}" data-title="${a.title}">
                    ${a.image ? `<img class="feed-bg" src="${a.image}" alt="" referrerpolicy="no-referrer" onerror="this.parentElement.classList.remove('has-image');this.remove()">` : ''}
                    <div class="content-overlay">
                        <h2>${a.title}</h2>
                        <p>${a.summary}</p>
                        <div class="feed-actions">
                            <button class="feed-btn read-btn">Read →</button>
                            <button class="feed-btn like-btn ${liked[a.title] ? 'liked' : ''}">${liked[a.title] ? '❤️' : '🤍'} Save</button>
                        </div>
                    </div>
                </div>
            `);
        }
    } catch (err) {
        console.error('Failed to load articles:', err);
        feed.querySelector('.loading-state')?.remove();
        if (!articles.size) {
            feed.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Failed to load</h3><p>Tap to retry</p></div>`;
            feed.querySelector('.empty-state').onclick = () => { feed.innerHTML = '<div class="loading-state"><div class="loader"></div></div>'; loadArticles(); };
        }
    } finally {
        loading = false;
    }
}

async function fetchRandom() {
    const data = await wikiApi({
        action: 'query', generator: 'random', grnnamespace: 0, prop: 'extracts|pageimages',
        grnlimit: 5, exintro: 1, explaintext: 1, pithumbsize: 800
    });
    return Object.values(data.query?.pages || {}).filter(p => p.extract).map(p => ({
        title: p.title, summary: p.extract, image: p.thumbnail?.source
    }));
}

async function fetchRecommended() {
    const allCats = Object.values(liked).flatMap(a => a.categories || []);
    if (!allCats.length) return fetchRandom();

    const cat = allCats[Math.floor(Math.random() * allCats.length)];
    const data = await wikiApi({
        action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`,
        cmlimit: 15, cmnamespace: 0
    });

    const members = (data.query?.categorymembers || [])
        .filter(m => !liked[m.title] && !articles.has(m.title))
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);

    if (!members.length) return fetchRandom();

    const details = await wikiApi({
        action: 'query', titles: members.map(m => m.title).join('|'),
        prop: 'extracts|pageimages', exintro: 1, explaintext: 1, pithumbsize: 800
    });

    return Object.values(details.query?.pages || {}).filter(p => p.extract).map(p => ({
        title: p.title, summary: p.extract, image: p.thumbnail?.source
    }));
}

async function openArticle(title, isBack = false) {
    if (!articleDialog.open) articleDialog.showModal();
    $('.modal-body', articleDialog).innerHTML = '<div class="loader" style="margin:40px auto"></div>';
    $('.reading-progress', articleDialog).style.width = '0%';
    currentArticle = { title };

    if (!isBack) {
        const parent = navStack.at(-1)?.title;
        navStack.push({ title });
        addToHistory(title);
        addToTree(title, parent);
        history.pushState({ type: 'article', title }, '', `#article/${encodeURIComponent(title)}`);
    }

    // Render header immediately so close/back buttons are always available
    const depth = navStack.length;
    renderArticleHeader(title, depth);

    let data;
    try {
        data = await wikiApi({ action: 'parse', page: title, prop: 'text', mobileformat: 1 });
    } catch (err) {
        console.error('Failed to load article:', err);
        $('.modal-body', articleDialog).innerHTML = '<p style="padding:20px">Failed to load. Check your connection.</p>';
        return;
    }
    if (!data?.parse) {
        $('.modal-body', articleDialog).innerHTML = '<p style="padding:20px">Failed to load</p>';
        return;
    }

    const t = data.parse.title;
    currentArticle = { title: t, ...articles.get(t) };
    renderArticleHeader(t, depth);

    const body = $('.modal-body', articleDialog);
    body.innerHTML = data.parse.text['*'];
    body.querySelectorAll('.mw-editsection, .reference, .mbox-small, .navbox, .sistersitebox').forEach(el => el.remove());
    body.scrollTop = 0;

    // Fix Wikipedia lazy-loaded images (mobile format uses data-src)
    body.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src;
    });
    body.querySelectorAll('.lazy-image-placeholder').forEach(el => {
        const src = el.dataset.src || el.getAttribute('data-src');
        if (src) {
            const img = document.createElement('img');
            img.src = src;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '8px';
            el.replaceWith(img);
        }
    });
    // Fix protocol-relative URLs
    body.querySelectorAll('img[src^="//"]').forEach(img => {
        img.src = 'https:' + img.getAttribute('src');
    });
    // Ensure all images can load from Wikimedia CDN
    body.querySelectorAll('img').forEach(img => {
        img.referrerPolicy = 'no-referrer';
        img.crossOrigin = 'anonymous';
    });

    body.querySelectorAll('a').forEach(link => {
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
}

function renderArticleHeader(title, depth) {
    $('.modal-header', articleDialog).innerHTML = `
        ${depth > 1 ? '<button class="circle-btn" data-action="back">←</button>' : ''}
        <div class="header-title">
            ${depth > 1 ? `<div class="nav-path">📚 ${depth} deep</div>` : ''}
            <h2>${title}</h2>
        </div>
        <div class="modal-actions">
            <button class="circle-btn" data-action="like">${liked[title] ? '❤️' : '🤍'}</button>
            <button class="circle-btn" data-action="share">↗️</button>
            <button class="circle-btn" data-action="close">✕</button>
        </div>
    `;
}

function goBack() {
    if (navStack.length > 1) {
        history.back();
    }
}

async function shareArticle() {
    if (!currentArticle) return;
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(currentArticle.title)}`;
    if (navigator.share) navigator.share({ title: currentArticle.title, url });
    else { await navigator.clipboard.writeText(url); showToast('Link copied!'); }
}

async function toggleLike(title) {
    if (liked[title]) {
        delete liked[title];
        showToast('Removed');
    } else {
        const meta = articles.get(title) || {};
        const cats = await fetchCategories(title);
        liked[title] = { title, image: meta.image, summary: meta.summary, categories: cats };
        showToast('Saved!');
    }
    localStorage.likedArticles = JSON.stringify(liked);

    // Update UI
    $$('.feed-item').forEach(item => {
        if (item.dataset.title === title) {
            const btn = $('.like-btn', item);
            btn.classList.toggle('liked', !!liked[title]);
            btn.innerHTML = liked[title] ? '❤️ Save' : '🤍 Save';
        }
    });
    if (currentArticle?.title === title) {
        $('[data-action="like"]', articleDialog).innerHTML = liked[title] ? '❤️' : '🤍';
    }
}

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
    history.unshift({ title, time: Date.now(), image: articles.get(title)?.image });
    history = history.slice(0, 50);
    localStorage.readHistory = JSON.stringify(history);
}

function addToTree(title, parent) {
    const now = Date.now();
    tree.nodes[title] ??= { title, firstSeen: now };

    if (!parent) {
        sessionId = 's' + now;
        tree.sessions.unshift({ id: sessionId, root: title, time: now });
    } else if (!tree.edges.some(e => e.from === parent && e.to === title && e.session === sessionId)) {
        tree.edges.push({ from: parent, to: title, time: now, session: sessionId });
    }

    while (tree.sessions.length > 30) {
        const old = tree.sessions.pop();
        tree.edges = tree.edges.filter(e => e.session !== old.id);
    }
    localStorage.explorationTree = JSON.stringify(tree);
}

function showOverlay(type) {
    const header = $('h2', overlayDialog);
    const content = $('.overlay-content', overlayDialog);

    header.textContent = type === 'history' ? 'History' : type === 'tree' ? 'Exploration Tree' : 'Saved';
    $$('.nav-item', $('#nav')).forEach(btn => btn.classList.toggle('active', btn.dataset.view === type));
    history.pushState({ type: 'overlay', view: type }, '', `#${type}`);

    if (type === 'tree') {
        content.innerHTML = renderTree();
    } else if (type === 'history') {
        content.innerHTML = history.length ? history.map(h => `
            <div class="list-item" data-title="${h.title}">
                <div class="item-thumb">${h.image ? `<img src="${h.image}" alt="" referrerpolicy="no-referrer">` : ''}</div>
                <div class="item-info"><div class="item-title">${h.title}</div><div class="item-meta">${timeAgo(h.time)}</div></div>
            </div>
        `).join('') : emptyState('🕐', 'No history yet', 'Articles you read will appear here');
    } else {
        const saved = Object.values(liked);
        content.innerHTML = saved.length ? saved.map(a => `
            <div class="list-item" data-title="${a.title}">
                <div class="item-thumb">${a.image ? `<img src="${a.image}" alt="" referrerpolicy="no-referrer">` : ''}</div>
                <div class="item-info"><div class="item-title">${a.title}</div></div>
            </div>
        `).join('') : emptyState('❤️', 'No saved articles', 'Tap the heart on articles to save');
    }

    overlayDialog.showModal();
}

function emptyState(icon, title, text) {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${text}</p></div>`;
}

function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return new Date(ts).toLocaleDateString();
}

function showToast(msg) {
    toast.textContent = msg;
    toast.showPopover();
    setTimeout(() => toast.hidePopover(), 2000);
}

function renderTree() {
    if (!tree.sessions.length) return emptyState('🌳', 'No explorations yet', 'Follow links to build your tree');

    const totalNodes = Object.keys(tree.nodes).length;
    let maxDepth = 1;

    const sessionData = tree.sessions.map(s => {
        const edges = tree.edges.filter(e => e.session === s.id);
        const children = {};
        edges.forEach(e => (children[e.from] ??= []).push(e.to));

        const getDepth = (node, d = 1) => {
            const kids = children[node] || [];
            return kids.length ? Math.max(...kids.map(k => getDepth(k, d + 1))) : d;
        };
        const depth = getDepth(s.root);
        maxDepth = Math.max(maxDepth, depth);
        return { s, children };
    });

    return `
        <div class="tree-stats">🌳 ${totalNodes} articles · ${tree.sessions.length} holes · deepest: ${maxDepth}</div>
        ${sessionData.map(({ s, children }) => `
            <div class="tree-session">
                <div class="tree-session-header">📅 ${new Date(s.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${s.root}</div>
                ${renderNode(s.root, children, true)}
            </div>
        `).join('')}
        <div style="text-align:center;padding:20px"><button class="feed-btn clear-tree">🗑️ Clear tree</button></div>
    `;
}

function renderNode(title, children, isRoot = false) {
    const kids = children[title] || [];
    return `
        <div class="tree-node ${isRoot ? 'tree-root' : ''}">
            <span class="tree-label" data-title="${title}">${title}</span>
            ${kids.length ? `<div class="tree-children">${kids.map(k => renderNode(k, children)).join('')}</div>` : ''}
        </div>
    `;
}
