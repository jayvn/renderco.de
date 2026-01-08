// Browser App Gallery Navigation Component
// Usage: Include this script in any page to add the navigation bar

(function () {
    'use strict';

    const nav = {
        brand: {
            name: 'App Gallery',
            subtitle: '',
            logo: '/images/logo.png',
            home: '/'
        },
        links: [
            { name: 'Apps', path: '/#apps', icon: '📱' }
        ],
        apps: [
            { name: 'ChoreoMarker', path: '/choreo/', icon: '💃' },
            { name: "Anil's Library", path: '/anils-library/', icon: '⚛️' },
            { name: 'Shopping List', path: '/shopping/', icon: '🛒' },
            { name: '3D Colorizer', path: '/3d_colorizer/', icon: '🎨' },
            { name: 'Secret Santa', path: '/secret-santa/', icon: '🎅🏽' },
            { name: 'Trip Planner', path: '/trip_helper/', icon: '✈️' },
            { name: 'Matrix Code Gen', path: '/matrix_draw/', icon: '🟩' }
        ],
        moreLinks: [
            { name: 'Events', path: '/events', icon: '📅' }
        ]
    };

    function createNavHTML() {
        const currentPath = window.location.pathname;

        return `
            <nav class="karayogam-nav">
                <div class="nav-container">
                    <a href="${nav.brand.home}" class="nav-brand">
                        <img src="${nav.brand.logo}" alt="Logo" class="nav-logo">
                        <div class="nav-brand-text">
                            <span class="nav-brand-name">${nav.brand.name}</span>
                            ${nav.brand.subtitle ? `<span class="nav-brand-subtitle">${nav.brand.subtitle}</span>` : ''}
                        </div>
                    </a>

                    <button class="nav-toggle" aria-label="Toggle menu">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>

                    <div class="nav-menu">
                        <div class="nav-links">
                            ${nav.links.map(link => `
                                <a href="${link.path}" class="nav-link ${currentPath === link.path ? 'active' : ''}">
                                    <span class="nav-icon">${link.icon}</span>
                                    ${link.name}
                                </a>
                            `).join('')}

                            <div class="nav-dropdown">
                                <button class="nav-link nav-dropdown-toggle">
                                    <span class="nav-icon">⚡</span>
                                    Quick Launch
                                    <span class="dropdown-arrow">▼</span>
                                </button>
                                <div class="nav-dropdown-menu">
                                    ${nav.apps.map(app => `
                                        <a href="${app.path}" class="nav-dropdown-item">
                                            <span class="nav-icon">${app.icon}</span>
                                            ${app.name}
                                        </a>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="nav-dropdown">
                                <button class="nav-link nav-dropdown-toggle">
                                    <span class="nav-icon">⋮</span>
                                    More
                                    <span class="dropdown-arrow">▼</span>
                                </button>
                                <div class="nav-dropdown-menu">
                                    ${nav.moreLinks.map(link => `
                                        <a href="${link.path}" class="nav-dropdown-item">
                                            <span class="nav-icon">${link.icon}</span>
                                            ${link.name}
                                        </a>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        `;
    }

    function injectNav() {
        // Check if running as installed PWA (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone ||
            document.referrer.includes('android-app://');

        // Don't inject nav if running as installed PWA
        if (isStandalone) {
            console.log('Running in standalone mode - navigation hidden');
            return;
        }

        // Create nav element
        const navElement = document.createElement('div');
        navElement.innerHTML = createNavHTML();

        // Insert at the beginning of body
        document.body.insertBefore(navElement.firstElementChild, document.body.firstChild);

        // Add event listeners
        setupEventListeners();
    }

    function setupEventListeners() {
        // Mobile menu toggle
        const toggle = document.querySelector('.nav-toggle');
        const menu = document.querySelector('.nav-menu');

        if (toggle && menu) {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                menu.classList.toggle('active');
            });
        }

        // Dropdown toggles
        const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
        const dropdowns = document.querySelectorAll('.nav-dropdown');

        dropdownToggles.forEach((toggle, index) => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const dropdown = dropdowns[index];

                // Close other dropdowns
                dropdowns.forEach((d, i) => {
                    if (i !== index) d.classList.remove('active');
                });

                dropdown.classList.toggle('active');
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-dropdown')) {
                dropdowns.forEach(d => d.classList.remove('active'));
            }
        });

        // Close mobile menu when clicking a link
        document.querySelectorAll('.nav-link:not(.nav-dropdown-toggle), .nav-dropdown-item').forEach(link => {
            link.addEventListener('click', () => {
                menu?.classList.remove('active');
                toggle?.classList.remove('active');
            });
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectNav);
    } else {
        injectNav();
    }
})();
