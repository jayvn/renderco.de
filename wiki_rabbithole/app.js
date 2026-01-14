const feedContainer = document.getElementById('feed-container');

// UI Elements
const modal = document.getElementById('article-modal');
const modalTitle = document.querySelector('#article-modal h2') || document.createElement('h2'); // Fallback/Caution
const modalBody = document.getElementById('modal-body');
const closeModalBtn = document.querySelector('.close-modal');
const minimizeModalBtn = document.querySelector('.minimize-modal');

const searchToggleBtn = document.getElementById('search-toggle-btn');
const searchWrapper = document.getElementById('search-wrapper');
const searchInput = document.getElementById('wiki-search');
const searchResults = document.getElementById('search-results');

const treeView = document.getElementById('tree-view');
const treeContainer = document.getElementById('tree-container');
const exploreBtn = document.getElementById('explore-btn');
const closeTreeBtn = document.querySelector('.close-tree-btn');

const profileView = document.getElementById('profile-view');
const bookmarksContainer = document.getElementById('bookmarks-container');
const profileBtn = document.querySelector('[data-target="profile"]');
const homeBtn = document.querySelector('[data-target="home"]');

// State
let articles = [];
let loading = false;
let historyTree = []; // Array of {nodeId, articleTitle, parentId}
let navStack = []; // For back button: [{title, nodeId}]
let currentArticleId = null;
let likedArticles = new Set(JSON.parse(localStorage.getItem('likedArticles') || '[]'));
let offlineCache = JSON.parse(localStorage.getItem('offlineCache') || '[]'); // Array of {title, html}
let streakCount = parseInt(localStorage.getItem('streakCount') || '0');
const streakEl = document.getElementById('streak-count');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadArticles();
    updateStreakUI();

    // Infinite Scroll
    feedContainer.addEventListener('scroll', () => {
        if (feedContainer.scrollTop + feedContainer.clientHeight >= feedContainer.scrollHeight - 600) {
            loadArticles();
        }
    });

    // Modal Events
    closeModalBtn.addEventListener('click', closeModal);
    minimizeModalBtn.addEventListener('click', closeModal);

    // Swipe down to close modal
    let touchStartY = 0;
    modal.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    });
    modal.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        if (touchEndY - touchStartY > 100) { // Swiped down 100px+
            closeModal();
        }
    });

    // Search Events
    searchToggleBtn.addEventListener('click', () => {
        searchWrapper.classList.toggle('active');
        if (searchWrapper.classList.contains('active')) searchInput.focus();
    });

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => handleSearch(e.target.value), 300);
    });

    // Navigation Events
    exploreBtn.addEventListener('click', () => {
        renderTree();
        hideAllViews();
        treeView.classList.add('active');
        setActiveNav('explore');
    });

    closeTreeBtn.addEventListener('click', () => {
        treeView.classList.remove('active');
        setActiveNav('home');
    });

    profileBtn.addEventListener('click', () => {
        renderProfile();
        hideAllViews();
        profileView.classList.add('active');
        setActiveNav('profile');
    });

    homeBtn.addEventListener('click', () => {
        hideAllViews();
        setActiveNav('home');
    });
});

function hideAllViews() {
    treeView.classList.remove('active');
    profileView.classList.remove('active');
    // search wrapper usually closes on selection, but good to ensure
    searchWrapper.classList.remove('active');
}

function setActiveNav(target) {
    document.querySelectorAll('.nav-item').forEach(btn => {
        if (btn.dataset.target === target) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

function closeModal() {
    modal.classList.remove('active');
    navStack = []; // Clear nav stack when fully closing
}

window.goBack = function () {
    if (navStack.length > 1) {
        navStack.pop(); // Remove current
        const prev = navStack[navStack.length - 1];
        // Re-open without adding to navStack
        openFullArticle(null, prev.title, prev.parentId, true); // true = isBackNav
    } else {
        closeModal();
    }
};

// --- CORE FEED LOGIC ---

async function loadArticles() {
    if (loading) return;
    loading = true;

    try {
        const newArticles = await fetchRandomArticles();
        // Remove initial loader if present
        const loader = document.querySelector('.loading-state');
        if (loader) loader.remove();

        newArticles.forEach(article => {
            if (!articles.find(a => a.id === article.id)) {
                createFeedItem(article);
                articles.push(article);
            }
        });
    } catch (error) {
        console.error("Failed to fetch articles:", error);
    }
    loading = false;
}

async function fetchRandomArticles() {
    // Standard random generator
    const endpoint = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=random&grnnamespace=0&prop=extracts|pageimages&grnlimit=5&exintro&explaintext&pithumbsize=1000&origin=*`;
    const response = await fetch(endpoint);
    const data = await response.json();
    if (!data.query || !data.query.pages) return [];

    return Object.values(data.query.pages)
        .filter(page => page.thumbnail && page.extract)
        .map(page => ({
            id: page.pageid,
            title: page.title,
            summary: page.extract,
            image: page.thumbnail.source,
            fullUrl: `https://en.wikipedia.org/?curid=${page.pageid}`
        }));
}

function createFeedItem(article) {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.style.backgroundImage = `url(${article.image})`;

    const isLiked = likedArticles.has(article.id);
    const likeBtnId = `like-btn-${article.id}`;

    item.innerHTML = `
        <div class="actions">
            <button class="action-btn like-btn" id="${likeBtnId}" onclick="toggleLike(this, ${article.id})">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart" style="color: ${isLiked ? 'red' : 'white'}"></i>
                <span class="action-label">Like</span>
            </button>
            <button class="action-btn" onclick="openFullArticle(${article.id}, '${article.title.replace(/'/g, "\\'")}', null)">
                <i class="far fa-eye"></i>
                <span class="action-label">Read</span>
            </button>
            <button class="action-btn">
                <i class="fas fa-share"></i>
                <span class="action-label">Share</span>
            </button>
        </div>
        <div class="content-overlay">
            <h2 class="article-title">${article.title}</h2>
            <p class="article-excerpt">${article.summary}</p>
            <button class="read-more-btn" onclick="openFullArticle(${article.id}, '${article.title.replace(/'/g, "\\'")}', null)">Read Article</button>
        </div>
    `;
    feedContainer.appendChild(item);
}

// --- SEARCH LOGIC ---

async function handleSearch(query) {
    if (query.length < 2) {
        searchResults.innerHTML = '';
        return;
    }

    const endpoint = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&origin=*`;
    const response = await fetch(endpoint);
    const [searchTerm, titles, urls, links] = await response.json();

    searchResults.innerHTML = '';
    titles.forEach((title, index) => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = title;
        div.onclick = () => {
            // Fetch ID for this title to open it properly
            // Ideally opensearch gave us URL but we need ID/PageContent.
            // We can just open by Title.
            openFullArticle(null, title, null);
            searchWrapper.classList.remove('active');
            searchInput.value = '';
            searchResults.innerHTML = '';
        };
        searchResults.appendChild(div);
    });
}

// --- FULL ARTICLE & RABBITHOLE LOGIC ---

window.openFullArticle = async function (id, title, parentId, isBackNav = false) {
    // Gamification
    if (!isBackNav) {
        streakCount++;
        localStorage.setItem('streakCount', streakCount.toString());
        updateStreakUI();
    }

    // Show Modal Loading
    modal.classList.add('active');
    modalBody.innerHTML = '<div class="loader"></div>';

    // 1. Fetch Full Content (Check Offline Cache First if needed, or just fetch and cache)
    let data;
    try {
        data = await fetchWikiContent(title);
        // Cache success
        saveToOfflineCache(title, data);
    } catch (e) {
        console.log("Fetch failed, trying offline cache");
        // Try to find in cache
        const cached = offlineCache.find(item => item.title === title);
        if (cached) {
            data = cached.data;
            console.log("Loaded from cache");
        } else {
            modalBody.innerHTML = '<p>Error loading article. Check connection.</p>';
            return;
        }
    }

    if (!data) {
        modalBody.innerHTML = '<p>Error loading article.</p>';
        return;
    }

    // 2. Track History (Rabbithole) - only if not back navigation
    const nodeId = Date.now();
    if (!isBackNav) {
        historyTree.push({
            nodeId: nodeId,
            articleTitle: data.parse.title,
            parentId: parentId || 'root'
        });
        currentArticleId = nodeId;

        // Push to nav stack for back button
        navStack.push({ title: data.parse.title, parentId: parentId || 'root' });
    }

    // 3. Render with navigation header
    const contentHtml = processWikiHtml(data.parse.text['*']);
    const depth = navStack.length;
    const showBack = navStack.length > 1;

    // Update modal header with breadcrumbs
    const modalHeader = document.querySelector('.modal-header');
    modalHeader.innerHTML = `
        <div class="modal-nav">
            ${showBack ? '<button class="back-btn" onclick="goBack()"><i class="fas fa-arrow-left"></i></button>' : ''}
            <span class="breadcrumb-depth">Depth: ${depth}</span>
        </div>
        <button class="close-modal" onclick="closeModal()">&times;</button>
    `;

    modalTitle.textContent = data.parse.title;
    modalBody.innerHTML = `${contentHtml}`;

    // 4. Attach link interceptors
    modalBody.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            // Check if it's a wiki link (usually starts with /wiki/)
            if (href && href.startsWith('/wiki/')) {
                const newTitle = href.split('/wiki/')[1];
                openFullArticle(null, decodeURIComponent(newTitle), currentArticleId);
            } else if (href) {
                window.open(href, '_blank');
            }
        });
    });
};

async function fetchWikiContent(title) {
    const endpoint = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&format=json&prop=text&mobileformat=1&origin=*`;
    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        return data;
    } catch (e) {
        console.error(e);
        throw e; // Re-throw to be caught by openFullArticle
    }
}

function processWikiHtml(html) {
    // Remove some wikipedia clutter if possible, or just return
    // Maybe strip style tags or specific classes
    const div = document.createElement('div');
    div.innerHTML = html;

    // Remove edit sections, referecnes, etc.
    div.querySelectorAll('.mw-editsection, .reference, .mbox-small').forEach(el => el.remove());

    return div.innerHTML;
}

// --- OFFLINE CACHE LOGIC ---

function saveToOfflineCache(title, data) {
    // Check if already in cache to avoid dupes/re-ordering
    const existingIndex = offlineCache.findIndex(i => i.title === title);
    if (existingIndex !== -1) {
        // Move to end (fresh)
        offlineCache.splice(existingIndex, 1);
    }

    offlineCache.push({ title, data });

    // Strict limit of 5
    if (offlineCache.length > 5) {
        offlineCache.shift(); // Remove oldest
    }

    localStorage.setItem('offlineCache', JSON.stringify(offlineCache));
}

// --- TREE VISUALIZATION (Branching) ---

function renderTree() {
    treeContainer.innerHTML = '';

    if (historyTree.length === 0) {
        treeContainer.innerHTML = '<p>Start reading to build your journey!</p>';
        return;
    }

    // Build hierarchy map
    // { root: [child1, child2], child1: [child3] }
    const childrenMap = {};
    const nodesMap = {};
    let roots = [];

    historyTree.forEach(node => {
        nodesMap[node.nodeId] = node;
        if (!childrenMap[node.parentId]) childrenMap[node.parentId] = [];
        childrenMap[node.parentId].push(node.nodeId);

        if (node.parentId === 'root') {
            roots.push(node.nodeId);
        }
    });

    // If we have nodes with missing parents (e.g. restarts), treat them as roots
    // Or just simple recursion starting from known roots
    // Let's just render explicitly known roots. 
    // If a node says parentId=X but X isn't in tree, treat as root.
    historyTree.forEach(node => {
        if (node.parentId !== 'root' && !nodesMap[node.parentId]) {
            if (!roots.includes(node.nodeId)) roots.push(node.nodeId);
        }
    });

    const createTreeHTML = (nodeId, depth) => {
        const node = nodesMap[nodeId];
        if (!node) return '';

        let html = `
            <div class="tree-node" style="margin-left: ${depth * 20}px">
                <div class="tree-node-content" onclick="openFullArticle(null, '${node.articleTitle.replace(/'/g, "\\'")}', '${node.parentId}')">
                    <strong>${node.articleTitle}</strong>
                </div>
            </div>
        `;

        const children = childrenMap[nodeId] || [];
        children.forEach(childId => {
            html += createTreeHTML(childId, depth + 1);
        });

        return html;
    };

    roots.forEach(rootId => {
        treeContainer.innerHTML += createTreeHTML(rootId, 0);
    });
}

// --- PROFILE / BOOKMARKS ---

function renderProfile() {
    bookmarksContainer.innerHTML = '';

    if (likedArticles.size === 0) {
        bookmarksContainer.innerHTML = '<p style="color:#888; text-align:center;">No bookmarks yet. Like articles to save them!</p>';
        return;
    }

    const likedIds = Array.from(likedArticles);
    // Ideally we would have stored the full article metadata in likedArticles, 
    // but we only stored IDs. For now, we can try to find them in 'articles' (feed cache)
    // OR we might have to fetch them if missing. 
    // Simpler hack for this prototype: We only show ones we have metadata for, OR we just show ID?
    // Let's upgrade the 'like' logic so we store metadata in a separate 'likedMetadata' OR 
    // just re-fetch.
    // IMPROVEMENT: Let's assume for this session we only see ones in the feed.
    // BETTER IMPROVEMENT: Let's change how we store likes right now.

    // Attempt to lookup
    let renderedCount = 0;
    likedIds.forEach(id => {
        // Find in current feed array
        const meta = articles.find(a => a.id === id);
        if (meta) {
            createBookmarkItem(meta);
            renderedCount++;
        }
        // If not found, we can't easily render title/image without fetching. 
        // We'll skip for this prototype scope to keep code minimal as requested.
    });

    if (renderedCount === 0 && likedIds.length > 0) {
        bookmarksContainer.innerHTML = '<p style="color:#888; text-align:center;">Bookmarks from previous sessions are saved, but detailed metadata is not cached in this lightweight version.</p>';
    }
}

function createBookmarkItem(article) {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    item.style.backgroundImage = `url(${article.image})`;
    item.innerHTML = `
        <div class="bookmark-overlay">
            <h3>${article.title}</h3>
        </div>
    `;
    item.onclick = () => openFullArticle(article.id, article.title, 'root'); // Restart journey from bookmark
    bookmarksContainer.appendChild(item);
}

// --- UTILS ---

function toggleLike(btn, id) {
    const icon = btn.querySelector('i');
    const isLiked = likedArticles.has(id);

    if (isLiked) {
        likedArticles.delete(id);
        icon.classList.remove('fas');
        icon.classList.add('far');
        icon.style.color = 'white';
    } else {
        likedArticles.add(id);
        icon.classList.remove('far');
        icon.classList.add('fas');
        icon.style.color = 'red';
    }
    localStorage.setItem('likedArticles', JSON.stringify([...likedArticles]));
}

function updateStreakUI() {
    streakEl.textContent = streakCount;
}

// Legacy openArticle (redirect to new one if needed, or remove)
// Keeping simple for feed clicks if index passed
window.openArticle = function (id) {
    // This was the old function called by the button. 
    // Now mapped to openFullArticle in createFeedItem HTML generation
};
