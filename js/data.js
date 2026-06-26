// ========================================
// BORNE FARMS — Data Store
// Cattle-focused with feed tiers
// ========================================

function loadData() {
    const saved = localStorage.getItem('borne_farm_data');
    if (saved) return JSON.parse(saved);
    return getDefaultData();
}

function getDefaultData() {
    return {
        organization: {
            id: 'borne',
            name: 'BORNE FARMS',
            location: 'Nigeria'
        },

        // Cattle-only livestock
        livestock: {
            cattle: {
                bull: { count: 0, pregnant: 0, sick: 0 },
                cow: { count: 0, pregnant: 0, sick: 0 },
                calf: { count: 0, pregnant: 0, sick: 0 }
            }
        },

        // Location counts
        locations: {
            paddock: 0,
            pasture: 0,
            transport: 0,
            quarantine: 0
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
            births: 0,
            deaths: 0,
            sold: 0,
            purchased: 0,
            milkProduction: 0
        },

        // Feed inventory (kg)
        feedInventory: {
            hay: { quantity: 0, costPerKg: 150, tier: 1 },
            silage: { quantity: 0, costPerKg: 120, tier: 2 },
            grainMix: { quantity: 0, costPerKg: 250, tier: 2 },
            proteinSupplement: { quantity: 0, costPerKg: 450, tier: 3 },
            mineralLick: { quantity: 0, costPerKg: 380, tier: 3 },
            premiumBlend: { quantity: 0, costPerKg: 600, tier: 4 }
        },

        dailyFeedConsumption: {
            hay: 0, silage: 0, grainMix: 0,
            proteinSupplement: 0, premiumBlend: 0
        },

        // Feed tier unlocks
        feedTiers: {
            1: { name: 'Basic Grazing', unlocked: true, minCattle: 0 },
            2: { name: 'Enhanced Nutrition', unlocked: true, minCattle: 0 },
            3: { name: 'Premium Growth', unlocked: false, minCattle: 5 },
            4: { name: 'Elite Yield Max', unlocked: false, minCattle: 15 }
        },

        investment: getDefaultInvestmentData(),

        // Health & movements
        activeHealthIssues: [],
        recentMovements: [],
        feedingLogs: [],

        // CCTV cameras
        cameras: [
            { id: 'uav01', name: 'Drone Feed', ip: '192.168.1.201', status: 'online', resolution: '4K' },
            { id: 'cam02', name: 'Feeding Station', ip: '192.168.1.102', status: 'online', resolution: '1080p' },
            { id: 'cam03', name: 'Milking Parlor', ip: '192.168.1.103', status: 'online', resolution: '720p' },
            { id: 'cam04', name: 'Main Gate', ip: '192.168.1.104', status: 'offline', resolution: '720p' }
        ],

        lastUpdated: new Date().toISOString()
    };
}

function getDefaultInvestmentData() {
    return {
        auth: {
            provider: 'Supabase Auth + Passkeys',
            status: 'kyc-ready',
            riskLevel: 'standard',
            methods: ['Phone OTP', 'Email OTP', 'Passkey', 'BVN/NIN KYC']
        },
        paymentRails: [
            { key: 'paystack', name: 'Paystack', region: 'Nigeria', methods: ['Card', 'Bank Transfer', 'USSD'], status: 'ready' },
            { key: 'flutterwave', name: 'Flutterwave', region: 'Africa + global cards', methods: ['Card', 'Mobile Money', 'Bank Transfer'], status: 'ready' },
            { key: 'stripe', name: 'Stripe', region: 'Global', methods: ['Card', 'Apple Pay', 'Google Pay'], status: 'planned' }
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
                image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Fula%20cattle%20herders%20by%20John%20Atherton.jpg'
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
                image: 'https://commons.wikimedia.org/wiki/Special:FilePath/A%20herd%20of%20brown%20and%20white%20horned%20cattle%20in%20a%20landscape%20-%20Province%20of%20Bauchi.jpg'
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
                image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Brahman%20%28Bos%20indicus%29.jpg'
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
                image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Holstein%20cow%20with%20one-day%20calf%2001.jpg'
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

function resetData() {
    FarmData = getDefaultData();
    saveData();
    return FarmData;
}
