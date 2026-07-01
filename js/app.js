// ========================================
// BORNE FARMS — Main App Controller
// ========================================

const App = {
    currentPage: 'dashboard',
    initialized: false,

    async init() {
        if (this.initialized) return;
        console.log('Initializing BORNE FARMS Dashboard...');

        // Check auth first; if not logged in, redirect to login page
        const authed = await this.checkAuth();
        if (!authed) {
            window.location.href = 'login.html';
            return;
        }

        // Initialize Lucide icons
        lucide.createIcons();

        // Bind navigation
        this.bindNavigation();
        this.initSidebarToggle();
        this.initHeaderDropdowns();
        this.initOrgSelector();

        // Drive the preloader sequence, then dismiss
        this.runPreloaderSequence();

        // Initialize modules
        try { await WeatherModule.init(); } catch (e) { console.error('Weather failed:', e); }

        DashboardModule.init();
        GeospatialModule.init();
        LivestockModule.init();
        MovementModule.init();
        HealthModule.init();
        FeedModule.init();
        FinanceModule.init();
        if (typeof CustomizeModule !== 'undefined') CustomizeModule.init();

        // Load saved page
        const hash = window.location.hash.replace('#', '');
        const isPhone = window.matchMedia('(max-width: 768px)').matches;
        if (hash && ['dashboard', 'geospatial', 'cctv', 'livestock', 'feed', 'health', 'movement', 'reports', 'finance'].includes(hash)) {
            this.navigateTo(hash);
        } else if (isPhone) {
            this.navigateTo('finance');
        }

        this.initialized = true;
        console.log('Borne Farms initialized!');
    },

    // ===== Preloader sequence: BORNEFARM rollout + cattle head loading =====
    runPreloaderSequence() {
        const roll = document.getElementById('borneRoll');
        const row = document.getElementById('cattleLoadRow');
        const status = document.getElementById('loaderStatus');
        if (!roll || !row || !status) { this.dismissPreloader(); return; }

        const WORD = 'BORNEFARM';
        const CATTLE = ['🐄', '🐮', '🐂', '🐃', '🦬', '🥛'];
        const STATUS_TEXTS = [
            'Booting core systems…',
            'Loading geospatial engine…',
            'Calibrating cattle sensors…',
            'Syncing weather feeds…',
            'Ready'
        ];

        let t = 0;
        // Phase 1 — roll out BORNEFARM letters (90ms apart)
        WORD.split('').forEach((ch, i) => {
            setTimeout(() => {
                const span = document.createElement('span');
                span.className = 'bf-char';
                span.textContent = ch;
                span.style.animationDelay = '0s';
                roll.appendChild(span);
            }, t);
            t += 90;
        });

        // Phase 2 — cattle heads load one after another (320ms apart)
        // starts right after the last letter
        const cattleStart = t + 250;
        CATTLE.forEach((emoji, i) => {
            setTimeout(() => {
                const head = document.createElement('span');
                head.className = 'cattle-head';
                head.textContent = emoji;
                row.appendChild(head);
                // after pop animation, switch to idle bob
                setTimeout(() => head.classList.add('loaded'), 560);
                // update status text proportionally
                const idx = Math.min(STATUS_TEXTS.length - 1,
                    Math.floor((i + 1) / CATTLE.length * STATUS_TEXTS.length));
                status.textContent = STATUS_TEXTS[idx];
            }, cattleStart + i * 320);
        });

        // Phase 3 — dismiss after the full sequence
        const totalMs = cattleStart + CATTLE.length * 320 + 600;
        setTimeout(() => {
            status.textContent = STATUS_TEXTS[STATUS_TEXTS.length - 1];
            this.dismissPreloader();
        }, totalMs);
    },

    dismissPreloader() {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.classList.add('fade-out');
            document.body.classList.remove('app-loading');
            setTimeout(() => {
                preloader.remove();
                // Re-render any lucide icons that may have been added during init
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 800);
        }
    },

    bindNavigation() {
        document.querySelectorAll('.nav-link, .card-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                if (page) {
                    e.preventDefault();
                    this.navigateTo(page);
                }
            });
        });
    },

    initSidebarToggle() {
        const sidebar = document.getElementById('sidebar');
        const main = document.getElementById('mainContent');
        const toggle = document.getElementById('desktopSidebarToggle');
        if (!sidebar || !main || !toggle) return;

        const saved = localStorage.getItem('borne_sidebar_collapsed');
        if (saved === 'true') {
            document.body.classList.add('sidebar-collapsed');
            toggle.setAttribute('aria-expanded', 'false');
        } else {
            toggle.setAttribute('aria-expanded', 'true');
        }

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const collapsed = document.body.classList.toggle('sidebar-collapsed');
            toggle.setAttribute('aria-expanded', String(!collapsed));
            localStorage.setItem('borne_sidebar_collapsed', String(collapsed));
        });
    },

    // ====================
    // AUTH
    // ====================
    async checkAuth() {
        const token = localStorage.getItem('borne_auth_token');
        if (!token) return false;
        try {
            const res = await backendFetch('/api/auth/me');
            if (res.ok) {
                const user = await res.json();
                setAuth(token, user);
                this.updateHeaderUser(user);
                const gate = document.getElementById('authGate');
                if (gate) gate.style.display = 'none';
                return true;
            }
        } catch (e) {
            console.error('Auth check failed:', e);
        }
        return false;
    },

    showAuthGate() {
        const gate = document.getElementById('authGate');
        if (!gate) return;
        gate.style.display = 'flex';
        document.body.classList.remove('app-loading');
        const preloader = document.getElementById('preloader');
        if (preloader) preloader.style.display = 'none';
        const form = document.getElementById('loginForm');
        const error = document.getElementById('loginError');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            error.style.display = 'none';
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            try {
                const res = await backendFetch('/api/auth/login', {
                    method: 'POST',
                    body: { email, password }
                });
                const data = await res.json();
                if (!res.ok) {
                    error.textContent = data.error || 'Login failed';
                    error.style.display = 'block';
                    return;
                }
                setAuth(data.token, data.user);
                this.updateHeaderUser(data.user);
                gate.style.display = 'none';
                // Sync backend data then init app
                await syncFromBackend();
                this.init();
            } catch (err) {
                error.textContent = 'Could not reach server. Make sure the backend is running.';
                error.style.display = 'block';
            }
        });
    },

    updateHeaderUser(user) {
        if (!user) return;
        const name = document.getElementById('headerUserName');
        const email = document.getElementById('headerUserEmail');
        if (name) name.textContent = user.name || 'Farm Manager';
        if (email) email.textContent = user.email || 'manager@bornefarms.com';
    },

    initHeaderDropdowns() {
        // Notification bell
        const notifBtn = document.getElementById('notificationBtn');
        const notifDropdown = document.getElementById('notificationDropdown');
        const notifList = document.getElementById('notificationList');
        const notifBadge = document.getElementById('notificationBadge');

        if (notifBtn && notifDropdown) {
            notifBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = notifDropdown.style.display !== 'none';
                notifDropdown.style.display = isOpen ? 'none' : 'block';
                if (!isOpen) this.renderNotifications();
            });
        }

        // User menu
        const userBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');
        if (userBtn && userDropdown) {
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = userDropdown.style.display !== 'none';
                userDropdown.style.display = isOpen ? 'none' : 'block';
            });
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (notifDropdown && !notifDropdown.contains(e.target) && e.target !== notifBtn) {
                notifDropdown.style.display = 'none';
            }
            if (userDropdown && !userDropdown.contains(e.target) && e.target !== userBtn && !userBtn?.contains(e.target)) {
                userDropdown.style.display = 'none';
            }
        });
    },

    renderNotifications() {
        const list = document.getElementById('notificationList');
        const badge = document.getElementById('notificationBadge');
        if (!list) return;

        const alerts = [];

        // Health alerts
        const issues = FarmData.activeHealthIssues || [];
        issues.forEach(h => {
            alerts.push({
                icon: 'alert-triangle',
                class: h.severity === 'high' ? 'notif-high' : 'notif-medium',
                text: `${h.disease} — ${h.severity} severity (${h.category})`
            });
        });

        // Low feed stock alerts
        const inv = FarmData.feedInventory || {};
        const daily = FarmData.dailyFeedConsumption || {};
        Object.entries(inv).forEach(([key, feed]) => {
            const consumption = daily[key] || 0;
            if (consumption > 0) {
                const days = Math.floor(feed.quantity / consumption);
                if (days <= 7) {
                    alerts.push({
                        icon: 'package-x',
                        class: 'notif-high',
                        text: `Low feed: ${key} — only ${days} days remaining`
                    });
                }
            }
        });

        // Pending tasks
        const tasks = (FarmData.goals && FarmData.goals.tasks) || [];
        tasks.forEach(t => {
            if (t.status === 'pending') {
                alerts.push({
                    icon: 'clock',
                    class: 'notif-info',
                    text: `Pending task: ${t.name}`
                });
            }
        });

        // Offline cameras
        const cameras = FarmData.cameras || [];
        cameras.forEach(c => {
            if (c.status === 'offline') {
                alerts.push({
                    icon: 'video-off',
                    class: 'notif-medium',
                    text: `Camera offline: ${c.name}`
                });
            }
        });

        // Render
        if (badge) badge.textContent = alerts.length;
        if (alerts.length === 0) {
            list.innerHTML = '<li class="notification-empty">No notifications</li>';
        } else {
            list.innerHTML = alerts.map(a => `
                <li>
                    <i data-lucide="${a.icon}" class="${a.class}"></i>
                    <span>${a.text}</span>
                </li>
            `).join('');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    initOrgSelector() {
        const select = document.getElementById('orgSelect');
        if (!select) return;
        select.addEventListener('change', (e) => {
            const val = e.target.value;
            const org = FarmData.organization;
            if (org && val === org.id) {
                showNotification(`Active: ${org.name}`, 'success');
            }
        });
    },

    navigateTo(page) {
        this.currentPage = page;
        window.location.hash = page;

        // Active nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Show page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById(`${page}Page`);
        if (pageEl) pageEl.classList.add('active');

        // Initialize full map when navigating to geospatial
        if (page === 'geospatial') {
            // First init attempt after page becomes visible
            setTimeout(() => GeospatialModule.initFullMap(), 150);
            // Second pass to fix any rendering issues after CSS transitions
            setTimeout(() => {
                if (GeospatialModule.mainMap) {
                    GeospatialModule.mainMap.invalidateSize();
                    GeospatialModule.mainMap.setView(GeospatialModule.center, 18);
                }
            }, 500);
        }

        // Initialize intelligence module when navigating to intelligence page
        if (page === 'intelligence') {
            setTimeout(() => IntelligenceModule.init(), 100);
        }

        lucide.createIcons();
    }
};

// ========================================
// Modal Functions
// ========================================

function openModal(type) {
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    let t = '', c = '';

    switch (type) {
        case 'addLivestock':
            t = 'Add Cattle';
            c = getAddCattleForm();
            break;
        case 'recordMovement':
            t = 'Record Movement';
            c = getRecordMovementForm();
            break;
        case 'logFeeding':
            t = 'Log Feeding';
            c = getLogFeedingForm();
            break;
        case 'logMilk':
            t = 'Log Milk Production';
            c = getLogMilkForm();
            break;
        case 'reportHealth':
            t = 'Report Health Issue';
            c = getReportHealthForm();
            break;
        case 'addCamera':
            t = 'Add Camera';
            c = getAddCameraForm();
            break;
        case 'updateGoals':
            t = 'Update Daily Goals';
            c = getUpdateGoalsForm();
            break;
        case 'buyBreed':
            t = 'Buy Cattle Units';
            c = FinanceModule.getBuyBreedForm();
            break;
        case 'makeOffer':
            t = 'Create Buyer Offer';
            c = FinanceModule.getMakeOfferForm();
            break;
        case 'lockInvestment':
            t = 'Lock Investment';
            c = FinanceModule.getLockInvestmentForm();
            break;
        case 'authSetup':
            t = 'Investor Auth & KYC';
            c = FinanceModule.getAuthSetupView();
            break;
        case 'paymentCheckout':
            t = 'Payment Checkout';
            c = FinanceModule.getPaymentCheckoutForm();
            break;
        case 'userProfile':
            t = 'Profile';
            c = getUserProfileView();
            break;
        case 'userSettings':
            t = 'Settings';
            c = getUserSettingsForm();
            break;
        default:
            t = 'Details';
            c = '<p>Loading...</p>';
    }

    title.textContent = t;
    body.innerHTML = c;
    overlay.classList.add('active');
    lucide.createIcons();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// ========================================
// Form Templates
// ========================================

function getAddCattleForm() {
    return `
        <form id="addCattleForm" onsubmit="LivestockModule.addAnimal(event)">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select class="form-select" name="category" required>
                        <option value="bull">Bull</option>
                        <option value="cow">Cow</option>
                        <option value="calf">Calf</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Count</label>
                    <input type="number" class="form-input" name="count" value="1" min="1" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Breed</label>
                    <select class="form-select" name="breed">
                        <option value="angus">Angus</option>
                        <option value="brahman">Brahman</option>
                        <option value="hereford">Hereford</option>
                        <option value="holstein">Holstein</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Weight (kg)</label>
                    <input type="number" class="form-input" name="weight" placeholder="e.g., 450">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Zone / Location</label>
                <select class="form-select" name="location">
                    <option value="paddock">Paddock</option>
                    <option value="pasture">Pasture</option>
                </select>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Cattle</button>
            </div>
        </form>
    `;
}

function getLogMilkForm() {
    const hist = FarmData.milkHistory || [];
    const lastEntry = hist.length ? hist[hist.length - 1] : null;
    const last = lastEntry ? (typeof lastEntry === 'object' ? lastEntry.liters : lastEntry) : 0;
    const today = new Date().toISOString().split('T')[0];
    return `
        <form id="logMilkForm" onsubmit="DashboardModule.logMilk(event)">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Date</label>
                    <input type="date" class="form-input" name="date" value="${today}" max="${today}">
                </div>
                <div class="form-group">
                    <label class="form-label">Milk yield (litres)</label>
                    <input type="number" class="form-input" name="liters" min="0" step="1"
                        value="${last}" placeholder="e.g., 845" required autofocus>
                </div>
            </div>
            <small style="color: var(--text-muted); font-size: 0.75rem;">Pick today, or backfill a past day — re-logging a date overwrites that day's reading.</small>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Log Milk</button>
            </div>
        </form>
    `;
}

function getRecordMovementForm() {
    return `
        <form id="recordMovementForm" onsubmit="MovementModule.recordMovement(event)">
            <div class="form-group">
                <label class="form-label">Cattle ID / Tag</label>
                <input type="text" class="form-input" name="animalId" placeholder="e.g., BRN-001" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">From</label>
                    <select class="form-select" name="from" required>
                        <option value="paddock">Paddock</option>
                        <option value="pasture">Pasture</option>
                        <option value="quarantine">Quarantine</option>
                        <option value="transport">Transport</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">To</label>
                    <select class="form-select" name="to" required>
                        <option value="paddock">Paddock</option>
                        <option value="pasture">Pasture</option>
                        <option value="quarantine">Quarantine</option>
                        <option value="transport">Transport</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Reason</label>
                <input type="text" class="form-input" name="reason" placeholder="e.g., Grazing rotation" required>
            </div>
            <div class="form-group">
                <label class="form-label">Handler</label>
                <input type="text" class="form-input" name="handler" placeholder="Staff name" required>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Record</button>
            </div>
        </form>
    `;
}

function getLogFeedingForm() {
    const feedOptions = Object.entries(FarmData.feedInventory)
        .map(([key, f]) => `<option value="${key}">${FeedLabels[key] || key} (Tier ${f.tier}, ${f.quantity} kg)</option>`)
        .join('');

    return `
        <form id="logFeedingForm" onsubmit="FeedModule.logFeeding(event)">
            <div class="form-group">
                <label class="form-label">Location / Zone</label>
                <input type="text" class="form-input" name="location" placeholder="e.g., Pasture Zone A" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Feed Type</label>
                    <select class="form-select" name="feedType" required>${feedOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">Quantity (kg)</label>
                    <input type="number" class="form-input" name="quantity" placeholder="50" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Cattle Fed</label>
                    <input type="number" class="form-input" name="animalsCount" placeholder="Number" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Handler</label>
                    <input type="text" class="form-input" name="handler" placeholder="Staff name" required>
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Log Feeding</button>
            </div>
        </form>
    `;
}

function getReportHealthForm() {
    return `
        <form id="reportHealthForm" onsubmit="HealthModule.reportHealth(event)">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select class="form-select" name="category" required>
                        <option value="bull">Bull</option>
                        <option value="cow">Cow</option>
                        <option value="calf">Calf</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Record Type</label>
                    <select class="form-select" name="type" required onchange="toggleHealthFields(this.value)">
                        <option value="disease">Disease</option>
                        <option value="vaccination">Vaccination</option>
                        <option value="checkup">Checkup</option>
                    </select>
                </div>
            </div>
            <div id="diseaseFields">
                <div class="form-group">
                    <label class="form-label">Disease</label>
                    <input type="text" class="form-input" name="disease" placeholder="e.g., Foot-and-Mouth">
                </div>
                <div class="form-group">
                    <label class="form-label">Symptoms</label>
                    <textarea class="form-textarea" name="symptoms" placeholder="Describe symptoms"></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Treatment</label>
                        <input type="text" class="form-input" name="treatment" placeholder="Treatment given">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Severity</label>
                        <select class="form-select" name="severity">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="vaccineFields" style="display:none;">
                <div class="form-group">
                    <label class="form-label">Vaccine Name</label>
                    <input type="text" class="form-input" name="vaccine" placeholder="e.g., FMD Vaccine">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea class="form-textarea" name="notes" placeholder="Additional notes"></textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Record</button>
            </div>
        </form>
    `;
}

function getAddCameraForm() {
    return `
        <form onsubmit="addCamera(event)">
            <div class="form-group">
                <label class="form-label">Camera Name</label>
                <input type="text" class="form-input" name="name" placeholder="e.g., North Pasture Cam" required>
            </div>
            <div class="form-group">
                <label class="form-label">IP Address</label>
                <input type="text" class="form-input" name="ip" placeholder="e.g., 192.168.1.105">
            </div>
            <div class="form-group">
                <label class="form-label">Stream URL (HTTP/HLS/MP4 only - RTSP won't work in browser)</label>
                <input type="text" class="form-input" name="stream_url" placeholder="e.g., http://192.168.1.105/stream.m3u8">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Location</label>
                    <input type="text" class="form-input" name="location" placeholder="e.g., Pasture Zone C">
                </div>
                <div class="form-group">
                    <label class="form-label">Resolution</label>
                    <select class="form-select" name="resolution">
                        <option value="1080p">1080p</option>
                        <option value="720p">720p</option>
                        <option value="480p">480p</option>
                    </select>
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Camera</button>
            </div>
        </form>
    `;
}

async function addCamera(event) {
    event.preventDefault();
    const fd = new FormData(event.target);
    const body = {
        name: fd.get('name'),
        ip: fd.get('ip') || '',
        stream_url: fd.get('stream_url') || '',
        resolution: fd.get('resolution') || '1080p',
        status: 'online'
    };
    try {
        const res = await backendFetch('/api/cameras', { method: 'POST', body });
        const cam = await res.json();
        if (!res.ok) {
            showNotification(cam.error || 'Could not add camera', 'error');
            return;
        }
        if (cam && cam.id) FarmData.cameras.push(cam);
        saveData();
        closeModal();
        showNotification('Camera added. Set a stream URL to go live.', 'success');
    } catch (e) {
        console.error('Add camera failed:', e);
        showNotification('Backend unavailable. Camera not saved.', 'error');
    }
}

function getUserProfileView() {
    const user = getAuthUser() || { name: 'Farm Manager', email: 'manager@bornefarms.com', role: 'manager' };
    return `
        <div class="form-group">
            <label class="form-label">Name</label>
            <input type="text" class="form-input" value="${user.name || ''}" readonly>
        </div>
        <div class="form-group">
            <label class="form-label">Email</label>
            <input type="text" class="form-input" value="${user.email || ''}" readonly>
        </div>
        <div class="form-group">
            <label class="form-label">Role</label>
            <input type="text" class="form-input" value="${user.role || 'manager'}" readonly>
        </div>
        <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
        </div>
    `;
}

function getUserSettingsForm() {
    const saved = localStorage.getItem('borne_notifications') !== 'false';
    return `
        <form onsubmit="event.preventDefault(); saveUserSettings(this); closeModal(); showNotification('Settings saved','success');">
            <div class="form-group" style="display:flex;align-items:center;gap:var(--space-sm);">
                <input type="checkbox" id="notifToggle" name="notifications" ${saved ? 'checked' : ''}>
                <label for="notifToggle" style="margin:0;">Enable notifications</label>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Settings</button>
            </div>
        </form>
    `;
}

function saveUserSettings(form) {
    const fd = new FormData(form);
    localStorage.setItem('borne_notifications', fd.get('notifications') ? 'true' : 'false');
}

function getUpdateGoalsForm() {
    const goals = FarmData.goals || { primaryGoal: '', progress: 0, tasks: [] };
    
    let tasksHtml = goals.tasks.map((t, index) => `
        <div class="form-group" style="display: flex; gap: var(--space-sm); align-items: center; margin-bottom: var(--space-xs);">
            <select class="form-select" name="taskStatus_${index}" style="width: auto;">
                <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="in-progress" ${t.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
            <input type="text" class="form-input" name="taskName_${index}" value="${t.name}" style="flex: 1;">
        </div>
    `).join('');

    return `
        <form onsubmit="saveGoals(event)">
            <div class="form-group">
                <label class="form-label">Primary Goal</label>
                <textarea class="form-textarea" name="primaryGoal" required>${goals.primaryGoal}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Progress Percentage (%)</label>
                <input type="number" class="form-input" name="progress" value="${goals.progress}" min="0" max="100" required>
            </div>
            <div class="form-group">
                <label class="form-label">Tasks</label>
                ${tasksHtml}
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Goals</button>
            </div>
        </form>
    `;
}

function saveGoals(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    if (!FarmData.goals) FarmData.goals = { tasks: [] };
    
    FarmData.goals.primaryGoal = formData.get('primaryGoal');
    FarmData.goals.progress = parseInt(formData.get('progress'), 10);
    
    // Process tasks
    for (let i = 0; i < FarmData.goals.tasks.length; i++) {
        FarmData.goals.tasks[i].name = formData.get('taskName_' + i);
        FarmData.goals.tasks[i].status = formData.get('taskStatus_' + i);
    }
    
    saveData();
    closeModal();
    showNotification('Goals updated successfully', 'success');
    
    // Re-render goals on dashboard
    if (typeof DashboardModule !== 'undefined' && DashboardModule.renderGoals) {
        DashboardModule.renderGoals();
    }
}

function toggleHealthFields(type) {
    const d = document.getElementById('diseaseFields');
    const v = document.getElementById('vaccineFields');
    if (d) d.style.display = type === 'disease' ? 'block' : 'none';
    if (v) v.style.display = type === 'vaccination' ? 'block' : 'none';
}

// ========================================
// Report Generation
// ========================================

function generateReport(type) {
    const preview = document.getElementById('reportPreview');
    const title = document.getElementById('reportTitle');
    const content = document.getElementById('reportContent');

    preview.classList.remove('hidden');
    const now = new Date();
    const monthYear = now.toLocaleString('en', { month: 'long', year: 'numeric' });

    switch (type) {
        case 'monthly':
            title.textContent = `Monthly Summary — ${monthYear}`;
            const stats = calculateStats();
            content.innerHTML = `
                <div class="report-content">
                    <h4>Cattle Overview</h4>
                    <table class="data-table">
                        <tr><td>Total Cattle</td><td><strong>${stats.total}</strong></td></tr>
                        <tr><td>Bulls</td><td>${stats.male}</td></tr>
                        <tr><td>Cows</td><td>${stats.female}</td></tr>
                        <tr><td>Calves</td><td>${stats.young}</td></tr>
                        <tr><td>Pregnant</td><td>${stats.pregnant}</td></tr>
                    </table>
                    <h4>Monthly Stats</h4>
                    <table class="data-table">
                        <tr><td>Births</td><td style="color:var(--accent-green);">${stats.birthsThisMonth}</td></tr>
                        <tr><td>Deaths</td><td style="color:var(--accent-red);">${stats.deathsThisMonth}</td></tr>
                    </table>
                </div>
            `;
            break;
        case 'feed':
            title.textContent = `Feed Analysis — ${monthYear}`;
            const inv = FarmData.feedInventory;
            const totalVal = Object.values(inv).reduce((s, f) => s + f.quantity * f.costPerKg, 0);
            content.innerHTML = `
                <div class="report-content">
                    <h4>Feed Inventory</h4>
                    <table class="data-table">
                        <thead><tr><th>Feed</th><th>Qty</th><th>Cost/kg</th><th>Value</th></tr></thead>
                        <tbody>
                            ${Object.entries(inv).map(([k, f]) => `
                                <tr><td>${FeedLabels[k]}</td><td>${f.quantity} kg</td><td>₦${f.costPerKg}</td><td>₦${(f.quantity * f.costPerKg).toLocaleString()}</td></tr>
                            `).join('')}
                        </tbody>
                        <tfoot><tr><td colspan="3"><strong>Total</strong></td><td><strong>₦${totalVal.toLocaleString()}</strong></td></tr></tfoot>
                    </table>
                </div>
            `;
            break;
        case 'health':
            title.textContent = `Health Report — ${monthYear}`;
            content.innerHTML = `<div class="report-content"><h4>Disease Cases</h4>${FarmData.activeHealthIssues.length > 0 ? FarmData.activeHealthIssues.map(h => `<p>• ${h.disease} (${h.severity}) — ${h.date}</p>`).join('') : '<p>No active cases</p>'}</div>`;
            break;
        case 'inventory':
            title.textContent = `Inventory Report — ${now.toLocaleDateString()}`;
            const s = calculateStats();
            content.innerHTML = `
                <div class="report-content">
                    <h4>Cattle Count</h4>
                    <table class="data-table">
                        <tr><td>Bulls</td><td>${s.male}</td></tr>
                        <tr><td>Cows</td><td>${s.female}</td></tr>
                        <tr><td>Calves</td><td>${s.young}</td></tr>
                        <tr><td><strong>Total</strong></td><td><strong>${s.total}</strong></td></tr>
                    </table>
                    <h4>By Location</h4>
                    <table class="data-table">
                        <tr><td>Paddock</td><td>${s.byLocation.paddock}</td></tr>
                        <tr><td>Pasture</td><td>${s.byLocation.pasture}</td></tr>
                        <tr><td>Quarantine</td><td>${s.byLocation.quarantine}</td></tr>
                        <tr><td>Transport</td><td>${s.byLocation.transport}</td></tr>
                    </table>
                </div>
            `;
            break;
    }
    lucide.createIcons();
}

function printReport() { window.print(); }

// ========================================
// Notification System
// ========================================

function showNotification(message, type = 'info') {
    const el = document.createElement('div');
    const bg = type === 'success' ? 'rgba(126,154,60,0.95)' : type === 'error' ? 'rgba(217,79,79,0.95)' : 'rgba(7,80,63,0.95)';
    el.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info'}"></i><span>${message}</span>`;
    el.style.cssText = `
        position:fixed;top:20px;right:20px;padding:1rem 1.5rem;
        background:${bg};color:#fff;border-radius:12px;
        display:flex;align-items:center;gap:0.5rem;
        box-shadow:0 10px 30px rgba(0,0,0,0.4);z-index:9999;
        animation:slideIn 0.3s ease;font-size:0.9rem;font-family:Inter,sans-serif;
    `;
    document.body.appendChild(el);
    lucide.createIcons();

    setTimeout(() => {
        el.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// Animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(style);

// Event listeners
document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Init
document.addEventListener('DOMContentLoaded', () => App.init());

// Globals
window.openModal = openModal;
window.closeModal = closeModal;
window.generateReport = generateReport;
window.printReport = printReport;
window.showNotification = showNotification;
window.toggleHealthFields = toggleHealthFields;
window.saveGoals = saveGoals;
