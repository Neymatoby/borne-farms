// ========================================
// BORNE FARMS — Data Store
// Cattle-focused with feed tiers
// ========================================

// Bump this whenever the seeded demo dataset changes so existing
// browsers refresh their operational data instead of showing stale zeros.
const SEED_VERSION = 5;

// Backend API URL (same Flask server that powers the AI video analysis)
const BACKEND_API_URL = 'http://127.0.0.1:5000/api/farm';
let _backendSyncTimer = null;
let _backendAvailable = false;

function getAuthToken() {
    return localStorage.getItem('borne_auth_token') || '';
}
function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' }
                  : { 'Accept': 'application/json', 'Content-Type': 'application/json' };
}
function setAuth(token, user) {
    if (token) localStorage.setItem('borne_auth_token', token);
    else localStorage.removeItem('borne_auth_token');
    if (user) localStorage.setItem('borne_user', JSON.stringify(user));
    else localStorage.removeItem('borne_user');
}
function getAuthUser() {
    try { return JSON.parse(localStorage.getItem('borne_user') || 'null'); } catch { return null; }
}
function logout() {
    setAuth(null, null);
}
async function backendFetch(path, options = {}) {
    const url = 'http://127.0.0.1:5000' + path;
    const opts = {
        ...options,
        headers: { ...getAuthHeaders(), ...(options.headers || {}) }
    };
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        opts.body = JSON.stringify(options.body);
    }
    return fetch(url, opts);
}

function loadData() {
    const saved = localStorage.getItem('borne_farm_data');
    if (!saved) return getDefaultData();

    const data = JSON.parse(saved);
    if (data.__seedVersion !== SEED_VERSION) {
        // Refresh demo/operational fields; preserve goals, investment,
        // organization and camera customisations the user may have changed.
        const fresh = getDefaultData();
        ['livestock', 'locations', 'monthlyStats', 'feedInventory',
         'dailyFeedConsumption', 'activeHealthIssues', 'recentMovements',
         'feedingLogs', 'milkHistory', 'finance'].forEach(k => { data[k] = fresh[k]; });
        data.feedTiers = data.feedTiers || fresh.feedTiers;
        data.__seedVersion = SEED_VERSION;
        localStorage.setItem('borne_farm_data', JSON.stringify(data));
    }
    return data;
}

// Attempt to sync state from the backend on page load.
// If the backend is reachable, its data takes precedence (it's the source
// of truth). If not, we fall back to localStorage silently.
async function syncFromBackend() {
    try {
        const res = await backendFetch('/api/farm', { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return;
        const remote = await res.json();
        if (remote && typeof remote === 'object' && remote.__seedVersion) {
            // Always merge the latest frontend defaults into the remote data so that
            // newly added v5 fields (vaccinationRecords, weightHistory, etc.) are present.
            const defaults = getDefaultData();
            FarmData = deepMerge(defaults, remote);
            FarmData.__seedVersion = SEED_VERSION;
            localStorage.setItem('borne_farm_data', JSON.stringify(FarmData));
            _backendAvailable = true;
            // Push merged data back to the backend so it stays in sync
            saveData();
            // Re-run any module renders that depend on FarmData
            if (typeof DashboardModule !== 'undefined' && DashboardModule.render) DashboardModule.render();
            if (typeof FinanceModule !== 'undefined' && FinanceModule.init) FinanceModule.init();
        }
    } catch (_) {
        // Backend offline — continue with localStorage data
        _backendAvailable = false;
    }
}

function deepMerge(target, source) {
    if (source === null || typeof source !== 'object') return source;
    if (Array.isArray(source)) return source;
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

function getDefaultData() {
    return {
        __seedVersion: SEED_VERSION,
        organization: {
            id: 'borne',
            name: 'BORNE FARMS',
            location: 'Nigeria'
        },

        // Cattle-only livestock
        livestock: {
            cattle: {
                bull: { count: 14, pregnant: 0, sick: 1 },
                cow: { count: 132, pregnant: 38, sick: 2 },
                calf: { count: 47, pregnant: 0, sick: 1 }
            }
        },

        // Location counts (sum ≈ total herd of 193)
        locations: {
            paddock: 96,
            pasture: 78,
            transport: 8,
            quarantine: 11
        },

        // Daily/Weekly/Monthly Goals
        goals: {
            primaryGoal: "Complete pasture rotation for Zone B and verify all new cattle registrations.",
            progress: 72,
            tasks: [
                { id: "t1", name: "Morning Feed Routine", status: "completed" },
                { id: "t2", name: "Zone B Pasture Rotation", status: "in-progress" },
                { id: "t3", name: "New Cattle Registration", status: "pending" }
            ],
            lastUpdated: new Date().toISOString()
        },

        // Monthly stats
        monthlyStats: {
            births: 12,
            deaths: 2,
            sold: 9,
            purchased: 16,
            milkProduction: 845
        },

        // Milk production history as dated entries (L/day), last 7 days
        milkHistory: [810, 828, 842, 806, 861, 833, 845].map((v, i, a) => ({
            date: new Date(Date.now() - (a.length - 1 - i) * 86400000).toISOString().split('T')[0],
            liters: v
        })),

        // Monthly finance summary (NGN)
        finance: {
            currency: '₦',
            income: [
                { label: 'Milk sales', value: 1520000 },
                { label: 'Cattle sales', value: 740000 },
                { label: 'Other', value: 220000 }
            ],
            expense: [
                { label: 'Feed', value: 880000 },
                { label: 'Vet & health', value: 310000 },
                { label: 'Labour', value: 340000 }
            ]
        },

        // Feed inventory (kg)
        feedInventory: {
            hay: { quantity: 12400, costPerKg: 150, tier: 1 },
            silage: { quantity: 8600, costPerKg: 120, tier: 2 },
            grainMix: { quantity: 4200, costPerKg: 250, tier: 2 },
            proteinSupplement: { quantity: 1850, costPerKg: 450, tier: 3 },
            mineralLick: { quantity: 940, costPerKg: 380, tier: 3 },
            premiumBlend: { quantity: 1200, costPerKg: 600, tier: 4 }
        },

        dailyFeedConsumption: {
            hay: 620, silage: 410, grainMix: 180,
            proteinSupplement: 75, premiumBlend: 40
        },

        // Feed tier unlocks
        feedTiers: {
            1: { name: 'Basic Grazing', unlocked: true, minCattle: 0 },
            2: { name: 'Enhanced Nutrition', unlocked: true, minCattle: 0 },
            3: { name: 'Premium Growth', unlocked: false, minCattle: 5 },
            4: { name: 'Elite Yield Max', unlocked: false, minCattle: 15 }
        },

        investment: getDefaultInvestmentData(),

        // Health & movements (seeded demo records)
        activeHealthIssues: [
            { id: 'h1', disease: 'Mastitis', category: 'cow', severity: 'high', date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0], count: 1 },
            { id: 'h2', disease: 'Foot Rot', category: 'cow', severity: 'medium', date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0], count: 1 }
        ],
        vaccinationRecords: [
            { id: 'v1', vaccine: 'FMD (Foot & Mouth)', category: 'cow', date: new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0], count: 45, handler: 'Dr. Adeyemi' },
            { id: 'v2', vaccine: 'CBPP (Pleuropneumonia)', category: 'cow', date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], count: 38, handler: 'Dr. Adeyemi' },
            { id: 'v3', vaccine: 'Anthrax', category: 'bull', date: new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0], count: 12, handler: 'Ibrahim' }
        ],
        // Weight tracking — weekly average weight per category (kg)
        weightHistory: [
            { week: -3, bull: 410, cow: 348, calf: 92, avg: 312 },
            { week: -2, bull: 418, cow: 352, calf: 98, avg: 316 },
            { week: -1, bull: 425, cow: 358, calf: 105, avg: 321 },
            { week: 0,  bull: 432, cow: 365, calf: 112, avg: 327 }
        ],
        // Weekly feed consumption history (kg per week)
        feedConsumptionHistory: [
            { week: -3, hay: 4200, silage: 2800, grainMix: 1200, total: 8200 },
            { week: -2, hay: 4350, silage: 2900, grainMix: 1250, total: 8500 },
            { week: -1, hay: 4180, silage: 2870, grainMix: 1260, total: 8310 },
            { week: 0,  hay: 4340, silage: 2870, grainMix: 1300, total: 8510 }
        ],
        recentMovements: [
            { id: 'm1', date: new Date(Date.now() - 2 * 3600000).toISOString(), animalId: 'BRN-WF-204', from: 'paddock', to: 'pasture', reason: 'Rotation', handler: 'Ibrahim', count: 1 },
            { id: 'm2', date: new Date(Date.now() - 6 * 3600000).toISOString(), animalId: 'BRN-CW-051', from: 'pasture', to: 'quarantine', reason: 'Health check', handler: 'Grace', count: 1 },
            { id: 'm3', date: new Date(Date.now() - 26 * 3600000).toISOString(), animalId: 'BRN-BR-118', from: 'transport', to: 'paddock', reason: 'New arrival', handler: 'Musa', count: 1 },
            { id: 'm4', date: new Date(Date.now() - 50 * 3600000).toISOString(), animalId: 'BRN-CF-309', from: 'paddock', to: 'pasture', reason: 'Weaning group', handler: 'Ibrahim', count: 1 }
        ],
        feedingLogs: [
            { id: 'f1', date: new Date(Date.now() - 3 * 3600000).toISOString(), location: 'paddock', feedType: 'hay', quantity: 420, animalsCount: 96, handler: 'Musa' },
            { id: 'f2', date: new Date(Date.now() - 9 * 3600000).toISOString(), location: 'pasture', feedType: 'silage', quantity: 260, animalsCount: 78, handler: 'Grace' }
        ],

        // CCTV cameras
        cameras: [
            { id: 'uav01', name: 'Drone Feed', ip: '192.168.1.201', stream_url: '', status: 'online', resolution: '4K' },
            { id: 'cam02', name: 'Feeding Station', ip: '192.168.1.102', stream_url: '', status: 'online', resolution: '1080p' },
            { id: 'cam03', name: 'Milking Parlor', ip: '192.168.1.103', stream_url: '', status: 'online', resolution: '720p' },
            { id: 'cam04', name: 'Main Gate', ip: '192.168.1.104', stream_url: '', status: 'offline', resolution: '720p' }
        ],

        lastUpdated: new Date().toISOString()
    };
}

function getDefaultInvestmentData() {
    return {
        auth: {
            provider: 'Local Auth (Demo)',
            status: 'kyc-pending',
            riskLevel: 'standard',
            methods: ['Phone OTP', 'Email OTP', 'Passkey', 'BVN/NIN KYC']
        },
        paymentRails: [
            { key: 'paystack', name: 'Paystack', region: 'Nigeria', methods: ['Card', 'Bank Transfer', 'USSD'], status: 'Demo' },
            { key: 'flutterwave', name: 'Flutterwave', region: 'Africa + global cards', methods: ['Card', 'Mobile Money', 'Bank Transfer'], status: 'Demo' },
            { key: 'stripe', name: 'Stripe', region: 'Global', methods: ['Card', 'Apple Pay', 'Google Pay'], status: 'Planned' }
        ],
        wallet: {
            currency: 'NGN',
            balance: 380000,
            lockedValue: 520000,
            escrowValue: 0
        },
        breedLots: [
            {
                id: 'lot-bunaji',
                breed: 'White Fulani',
                localName: 'Bunaji',
                region: 'Nigeria / Sahel',
                unitPrice: 185000,
                availableUnits: 42,
                minUnits: 1,
                feedTier: 'Basic',
                expectedMonthlyGrowth: 4.8,
                image: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Fula_cattle_herders_by_John_Atherton.jpg'
            },
            {
                id: 'lot-sokoto',
                breed: 'Sokoto Gudali',
                localName: 'Gudali',
                region: 'Northern Nigeria',
                unitPrice: 225000,
                availableUnits: 28,
                minUnits: 1,
                feedTier: 'Advanced',
                expectedMonthlyGrowth: 5.6,
                image: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Sokoto_Gudali_breed.jpg'
            },
            {
                id: 'lot-brahman',
                breed: 'Brahman',
                localName: 'Heat Hardy',
                region: 'Tropical beef',
                unitPrice: 310000,
                availableUnits: 16,
                minUnits: 1,
                feedTier: 'Premium',
                expectedMonthlyGrowth: 6.4,
                image: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Brahman_(Bos_indicus).jpg'
            },
            {
                id: 'lot-holstein',
                breed: 'Holstein Friesian',
                localName: 'Dairy Yield',
                region: 'Dairy stock',
                unitPrice: 355000,
                availableUnits: 11,
                minUnits: 1,
                feedTier: 'Premium',
                expectedMonthlyGrowth: 5.9,
                image: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Holstein_cow_with_one-day_calf_01.jpg'
            }
        ],
        holdings: [
            {
                id: 'own-001',
                breed: 'White Fulani',
                units: 2,
                purchasePrice: 370000,
                currentValue: 421800,
                weightStartKg: 218,
                weightCurrentKg: 248,
                growthPercent: 13.8,
                feedTier: 'Advanced',
                lockUntil: '2026-10-30',
                status: 'Locked',
                tag: 'BRN-WF-204'
            },
            {
                id: 'own-002',
                breed: 'Brahman',
                units: 1,
                purchasePrice: 310000,
                currentValue: 334500,
                weightStartKg: 252,
                weightCurrentKg: 270,
                growthPercent: 7.1,
                feedTier: 'Premium',
                lockUntil: null,
                status: 'Tradable',
                tag: 'BRN-BR-118'
            }
        ],
        marketplaceOffers: [
            { id: 'off-001', holdingId: 'own-002', buyer: 'Amina K.', price: 348000, expires: '2026-05-06', status: 'Open' },
            { id: 'off-002', holdingId: 'own-001', buyer: 'Diaspora AgFund', price: 430000, expires: '2026-05-08', status: 'Locked asset' }
        ],
        transactions: [
            { id: 'txn-204', type: 'Buy', rail: 'Paystack Bank Transfer', amount: 370000, status: 'Settled', date: '2026-04-23' },
            { id: 'txn-205', type: 'Feed Upgrade', rail: 'Wallet', amount: 52000, status: 'Settled', date: '2026-04-30' }
        ]
    };
}

let FarmData = loadData();

function ensureInvestmentData() {
    const defaults = getDefaultInvestmentData();
    if (!FarmData.investment) FarmData.investment = defaults;
    FarmData.investment.auth = { ...defaults.auth, ...(FarmData.investment.auth || {}) };
    FarmData.investment.wallet = { ...defaults.wallet, ...(FarmData.investment.wallet || {}) };
    FarmData.investment.paymentRails = FarmData.investment.paymentRails || defaults.paymentRails;
    FarmData.investment.breedLots = FarmData.investment.breedLots || defaults.breedLots;
    FarmData.investment.holdings = FarmData.investment.holdings || defaults.holdings;
    FarmData.investment.marketplaceOffers = FarmData.investment.marketplaceOffers || defaults.marketplaceOffers;
    FarmData.investment.transactions = FarmData.investment.transactions || defaults.transactions;
}

ensureInvestmentData();

// Ensure canonical camera data structure exists (for older saved data)
function ensureCameraData() {
    const defaults = getDefaultData().cameras;
    if (!Array.isArray(FarmData.cameras) || FarmData.cameras.length === 0) {
        FarmData.cameras = defaults;
        saveData();
    }
}
ensureCameraData();

function saveData() {
    FarmData.lastUpdated = new Date().toISOString();
    localStorage.setItem('borne_farm_data', JSON.stringify(FarmData));
    // Debounced push to backend (fire-and-forget; localStorage is the fallback)
    if (_backendSyncTimer) clearTimeout(_backendSyncTimer);
    _backendSyncTimer = setTimeout(() => {
        backendFetch('/api/farm', {
            method: 'PUT',
            body: FarmData
        }).then(() => { _backendAvailable = true; })
          .catch(() => { _backendAvailable = false; });
    }, 800);
}

const SubCategoryLabels = {
    bull: { name: 'Bull', type: 'cattle', gender: 'male' },
    cow: { name: 'Cow', type: 'cattle', gender: 'female' },
    calf: { name: 'Calf', type: 'cattle', gender: 'young' }
};

const LocationLabels = {
    paddock: 'Paddock',
    pasture: 'Pasture',
    transport: 'Transport',
    quarantine: 'Quarantine'
};

const FeedLabels = {
    hay: 'Hay',
    silage: 'Silage',
    grainMix: 'Grain Mix',
    proteinSupplement: 'Protein Supplement',
    mineralLick: 'Mineral Lick',
    premiumBlend: 'Premium Blend'
};

function calculateStats() {
    const livestock = FarmData.livestock;
    let total = 0, male = 0, female = 0, young = 0, pregnant = 0, sick = 0;

    for (const [category, data] of Object.entries(livestock.cattle)) {
        total += data.count;
        pregnant += data.pregnant || 0;
        sick += data.sick || 0;

        const subCat = SubCategoryLabels[category];
        if (subCat) {
            if (subCat.gender === 'male') male += data.count;
            else if (subCat.gender === 'female') female += data.count;
            else if (subCat.gender === 'young') young += data.count;
        }
    }

    // Update feed tier unlocks
    FarmData.feedTiers[3].unlocked = total >= 5;
    FarmData.feedTiers[4].unlocked = total >= 15;

    return {
        total, male, female, young, pregnant, sick,
        healthy: total - sick,
        byLocation: FarmData.locations,
        birthsThisMonth: FarmData.monthlyStats.births,
        deathsThisMonth: FarmData.monthlyStats.deaths,
        milkProduction: FarmData.monthlyStats.milkProduction || 0,
        activeDiseases: FarmData.activeHealthIssues.length
    };
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function updateLivestockCount(category, field, value) {
    if (FarmData.livestock.cattle[category]) {
        FarmData.livestock.cattle[category][field] = parseInt(value) || 0;
        saveData();
    }
}

function recordMovement(movement) {
    movement.id = generateId();
    movement.date = new Date().toISOString();
    FarmData.recentMovements.unshift(movement);

    if (FarmData.locations[movement.from] !== undefined) {
        FarmData.locations[movement.from] = Math.max(0, FarmData.locations[movement.from] - (movement.count || 1));
    }
    if (FarmData.locations[movement.to] !== undefined) {
        FarmData.locations[movement.to] += (movement.count || 1);
    }
    saveData();
}

function recordHealth(health) {
    health.id = generateId();
    health.date = new Date().toISOString().split('T')[0];

    if (health.type === 'disease') {
        FarmData.activeHealthIssues.push(health);
        if (FarmData.livestock.cattle[health.category]) {
            FarmData.livestock.cattle[health.category].sick += (health.count || 1);
        }
    } else if (health.type === 'birth') {
        FarmData.monthlyStats.births += (health.count || 1);
        FarmData.livestock.cattle.calf.count += (health.count || 1);
    } else if (health.type === 'death') {
        FarmData.monthlyStats.deaths += (health.count || 1);
        if (FarmData.livestock.cattle[health.category]) {
            FarmData.livestock.cattle[health.category].count = Math.max(0,
                FarmData.livestock.cattle[health.category].count - (health.count || 1));
        }
    }
    saveData();
}

function recordFeeding(feeding) {
    feeding.id = generateId();
    feeding.date = new Date().toISOString();
    FarmData.feedingLogs.unshift(feeding);

    if (FarmData.feedInventory[feeding.feedType]) {
        FarmData.feedInventory[feeding.feedType].quantity = Math.max(0,
            FarmData.feedInventory[feeding.feedType].quantity - feeding.quantity);
    }
    if (FarmData.dailyFeedConsumption[feeding.feedType] !== undefined) {
        FarmData.dailyFeedConsumption[feeding.feedType] += feeding.quantity;
    }
    saveData();
}

// Normalize any legacy numeric milkHistory ([840, 845, ...]) into dated entries.
function normalizeMilkHistory() {
    let h = FarmData.milkHistory;
    if (!Array.isArray(h)) { FarmData.milkHistory = []; return; }
    if (h.length && typeof h[0] !== 'object') {
        FarmData.milkHistory = h.map((v, i, a) => ({
            date: new Date(Date.now() - (a.length - 1 - i) * 86400000).toISOString().split('T')[0],
            liters: v
        }));
    }
}

function recordMilk(liters, dateStr) {
    liters = parseInt(liters) || 0;
    dateStr = dateStr || new Date().toISOString().split('T')[0];
    normalizeMilkHistory();

    const existing = FarmData.milkHistory.find(e => e.date === dateStr);
    if (existing) existing.liters = liters;
    else FarmData.milkHistory.push({ date: dateStr, liters });

    // Keep chronological order and cap at 14 days of history
    FarmData.milkHistory.sort((a, b) => (a.date < b.date ? -1 : 1));
    if (FarmData.milkHistory.length > 14) {
        FarmData.milkHistory = FarmData.milkHistory.slice(-14);
    }

    // KPI reflects the most recent day on record
    const latest = FarmData.milkHistory[FarmData.milkHistory.length - 1];
    FarmData.monthlyStats.milkProduction = latest ? latest.liters : liters;
    saveData();
}

function resetData() {
    FarmData = getDefaultData();
    saveData();
    return FarmData;
}

// Kick off background sync from backend on load (non-blocking)
syncFromBackend();
