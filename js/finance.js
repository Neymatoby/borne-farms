// ========================================
// BORNE FARMS - Cattle Investment Module
// ========================================

const FinanceModule = {
    currentTab: 'market',

    init() {
        if (!FarmData.investment && typeof ensureInvestmentData === 'function') ensureInvestmentData();
        this.render();
    },

    formatMoney(amount) {
        return `&#8358;${Number(amount || 0).toLocaleString('en-NG')}`;
    },

    portfolioValue() {
        return FarmData.investment.holdings.reduce((sum, item) => sum + item.currentValue, 0);
    },

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.finance-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.financeTab === tab);
        });
        document.querySelectorAll('.finance-tab-panel').forEach(panel => panel.classList.remove('active'));
        const panel = document.getElementById(`finance${tab.charAt(0).toUpperCase() + tab.slice(1)}Panel`);
        if (panel) panel.classList.add('active');
        lucide.createIcons();
    },

    render() {
        this.renderSummary();
        this.renderBreedMarket();
        this.renderPortfolio();
        this.renderOffers();
        this.renderRails();
        lucide.createIcons();
    },

    renderSummary() {
        const grid = document.getElementById('financeSummaryGrid');
        if (!grid) return;
        const investment = FarmData.investment;
        const tradable = investment.holdings.filter(item => item.status === 'Tradable').length;
        grid.innerHTML = `
            <div class="finance-mini-stat">
                <span>Portfolio</span>
                <strong>${this.formatMoney(this.portfolioValue())}</strong>
            </div>
            <div class="finance-mini-stat">
                <span>Wallet</span>
                <strong>${this.formatMoney(investment.wallet.balance)}</strong>
            </div>
            <div class="finance-mini-stat">
                <span>Tradable</span>
                <strong>${tradable} units</strong>
            </div>
        `;
    },

    renderBreedMarket() {
        const market = document.getElementById('breedMarket');
        if (!market) return;
        market.innerHTML = FarmData.investment.breedLots.map(lot => `
            <article class="breed-card">
                <img src="${lot.image}" alt="${lot.breed} cattle">
                <div class="breed-card-body">
                    <div class="breed-card-title">
                        <div>
                            <h4>${lot.breed}</h4>
                            <span style="color:var(--text-secondary);font-size:0.78rem;">${lot.localName} - ${lot.region}</span>
                        </div>
                        <span class="finance-tag">${lot.feedTier}</span>
                    </div>
                    <div class="breed-meta">
                        <div><span>Unit price</span><strong>${this.formatMoney(lot.unitPrice)}</strong></div>
                        <div><span>Growth target</span><strong>${lot.expectedMonthlyGrowth}% / month</strong></div>
                        <div><span>Available</span><strong>${lot.availableUnits} units</strong></div>
                        <div><span>Minimum</span><strong>${lot.minUnits} unit</strong></div>
                    </div>
                    <button class="btn btn-primary" style="width:100%;" onclick="openModal('buyBreed'); FinanceModule.selectLot('${lot.id}')">
                        <i data-lucide="shopping-cart"></i> Buy Units
                    </button>
                </div>
            </article>
        `).join('');
    },

    renderPortfolio() {
        const list = document.getElementById('portfolioList');
        if (!list) return;
        list.innerHTML = FarmData.investment.holdings.map(item => {
            const locked = item.status !== 'Tradable';
            return `
                <article class="holding-card">
                    <div class="holding-card-title">
                        <div>
                            <h4>${item.breed}</h4>
                            <span style="color:var(--text-secondary);font-size:0.78rem;">${item.tag} - ${item.units} unit${item.units > 1 ? 's' : ''}</span>
                        </div>
                        <span class="finance-tag">${item.status}</span>
                    </div>
                    <div class="holding-meta">
                        <div><span>Current value</span><strong>${this.formatMoney(item.currentValue)}</strong></div>
                        <div><span>Weight</span><strong>${item.weightCurrentKg}kg</strong></div>
                        <div><span>Growth</span><strong>${item.growthPercent}%</strong></div>
                        <div><span>Feed tier</span><strong>${item.feedTier}</strong></div>
                    </div>
                    <div class="growth-track"><span style="width:${Math.min(item.growthPercent * 5, 100)}%;"></span></div>
                    <div class="finance-action-row" style="margin-top:var(--space-md);">
                        <button class="btn btn-secondary" onclick="FinanceModule.requestSale('${item.id}')" ${locked ? 'disabled' : ''}>
                            <i data-lucide="hand-coins"></i> Sell
                        </button>
                        <button class="btn btn-secondary" onclick="FinanceModule.lockHolding('${item.id}')">
                            <i data-lucide="lock"></i> Lock
                        </button>
                    </div>
                    ${item.lockUntil ? `<p style="color:var(--text-secondary);font-size:0.76rem;margin-top:var(--space-sm);">Locked until ${formatDate(item.lockUntil)}</p>` : ''}
                </article>
            `;
        }).join('');
    },

    renderOffers() {
        const list = document.getElementById('offerList');
        if (!list) return;
        list.innerHTML = FarmData.investment.marketplaceOffers.map(offer => `
            <article class="offer-card">
                <div class="offer-card-title">
                    <div>
                        <h4>${offer.buyer}</h4>
                        <span style="color:var(--text-secondary);font-size:0.78rem;">Offer ${offer.id}</span>
                    </div>
                    <span class="finance-tag">${offer.status}</span>
                </div>
                <div class="offer-meta">
                    <div><span>Offer price</span><strong>${this.formatMoney(offer.price)}</strong></div>
                    <div><span>Expires</span><strong>${formatDate(offer.expires)}</strong></div>
                </div>
                <div class="finance-action-row">
                    <button class="btn btn-primary" onclick="FinanceModule.acceptOffer('${offer.id}')" ${offer.status !== 'Open' ? 'disabled' : ''}>
                        <i data-lucide="check"></i> Accept
                    </button>
                    <button class="btn btn-secondary" onclick="FinanceModule.rejectOffer('${offer.id}')" ${offer.status !== 'Open' ? 'disabled' : ''}>
                        <i data-lucide="x"></i> Reject
                    </button>
                </div>
            </article>
        `).join('');
    },

    renderRails() {
        const rails = document.getElementById('paymentRailList');
        if (rails) {
            rails.innerHTML = FarmData.investment.paymentRails.map(rail => `
                <div class="payment-rail">
                    <div class="payment-rail-title">
                        <h4>${rail.name}</h4>
                        <span class="finance-tag">${rail.status}</span>
                    </div>
                    <div class="payment-meta">
                        <div><span>Coverage</span><strong>${rail.region}</strong></div>
                        <div><span>Methods</span><strong>${rail.methods.join(', ')}</strong></div>
                    </div>
                </div>
            `).join('');
        }

        const auth = document.getElementById('authPipeline');
        if (auth) {
            const methods = FarmData.investment.auth.methods.map(method => `
                <div class="auth-step"><i data-lucide="check-circle-2"></i><span>${method}</span></div>
            `).join('');
            auth.innerHTML = `
                <div class="payment-rail-title">
                    <h4>${FarmData.investment.auth.provider}</h4>
                    <span class="finance-tag">${FarmData.investment.auth.status}</span>
                </div>
                <div style="margin-top:var(--space-sm);">${methods}</div>
            `;
        }
    },

    selectLot(lotId) {
        this.selectedLotId = lotId;
        setTimeout(() => {
            const input = document.querySelector('[name="lotId"]');
            if (input) input.value = lotId;
        }, 0);
    },

    getBuyBreedForm() {
        const options = FarmData.investment.breedLots.map(lot => `
            <option value="${lot.id}" ${lot.id === this.selectedLotId ? 'selected' : ''}>${lot.breed} - ${this.formatMoney(lot.unitPrice)} / unit</option>
        `).join('');
        return `
            <form onsubmit="FinanceModule.buyBreed(event)">
                <div class="form-group">
                    <label class="form-label">Breed Lot</label>
                    <select class="form-select" name="lotId" required>${options}</select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Units</label>
                        <input class="form-input" type="number" name="units" min="1" value="1" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Payment Rail</label>
                        <select class="form-select" name="rail">
                            <option>Paystack Bank Transfer</option>
                            <option>Paystack Card</option>
                            <option>Flutterwave Mobile Money</option>
                            <option>Flutterwave Card</option>
                            <option>Wallet Balance</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Discipline Lock</label>
                    <select class="form-select" name="lockMonths">
                        <option value="0">No lock - tradable after settlement</option>
                        <option value="3">3 months</option>
                        <option value="6">6 months</option>
                        <option value="12">12 months</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Initiate Purchase</button>
                </div>
            </form>
        `;
    },

    getMakeOfferForm() {
        const holdings = FarmData.investment.holdings.map(item => `<option value="${item.id}">${item.breed} - ${item.tag}</option>`).join('');
        return `
            <form onsubmit="FinanceModule.makeOffer(event)">
                <div class="form-group">
                    <label class="form-label">Target Holding</label>
                    <select class="form-select" name="holdingId">${holdings}</select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Buyer Name</label>
                        <input class="form-input" name="buyer" placeholder="Buyer or fund name" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Offer Price (NGN)</label>
                        <input class="form-input" name="price" type="number" min="1" required>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Post Offer</button>
                </div>
            </form>
        `;
    },

    getLockInvestmentForm() {
        const holdings = FarmData.investment.holdings.map(item => `<option value="${item.id}">${item.breed} - ${item.tag}</option>`).join('');
        return `
            <form onsubmit="FinanceModule.applyLock(event)">
                <div class="form-group">
                    <label class="form-label">Holding</label>
                    <select class="form-select" name="holdingId">${holdings}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">Lock Period</label>
                    <select class="form-select" name="months">
                        <option value="3">3 months</option>
                        <option value="6">6 months</option>
                        <option value="12">12 months</option>
                        <option value="18">18 months</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Lock Holding</button>
                </div>
            </form>
        `;
    },

    getAuthSetupView() {
        return `
            <div class="auth-pipeline">
                <div class="auth-step"><i data-lucide="smartphone"></i><span>Phone OTP for Nigerian users and diaspora accounts.</span></div>
                <div class="auth-step"><i data-lucide="fingerprint"></i><span>Passkey login for secure repeat access.</span></div>
                <div class="auth-step"><i data-lucide="badge-check"></i><span>BVN/NIN KYC before wallet funding, sale, or payout.</span></div>
                <div class="auth-step"><i data-lucide="shield-check"></i><span>Escrow, transaction ledger, and risk checks before settlement.</span></div>
            </div>
        `;
    },

    getPaymentCheckoutForm() {
        return `
            <form onsubmit="FinanceModule.recordPayment(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Amount (NGN)</label>
                        <input class="form-input" type="number" name="amount" min="1" value="100000" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Rail</label>
                        <select class="form-select" name="rail">
                            <option>Paystack Bank Transfer</option>
                            <option>Paystack Card</option>
                            <option>Flutterwave Mobile Money</option>
                            <option>Flutterwave Card</option>
                            <option>Stripe Global Card</option>
                        </select>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Simulate Deposit</button>
                </div>
            </form>
        `;
    },

    buyBreed(event) {
        event.preventDefault();
        const form = new FormData(event.target);
        const lot = FarmData.investment.breedLots.find(item => item.id === form.get('lotId'));
        const units = parseInt(form.get('units'), 10) || 1;
        const lockMonths = parseInt(form.get('lockMonths'), 10) || 0;
        if (!lot || lot.availableUnits < units) {
            showNotification('Selected lot does not have enough available units', 'error');
            return;
        }

        const amount = lot.unitPrice * units;
        lot.availableUnits -= units;
        const lockUntil = lockMonths ? this.futureDate(lockMonths) : null;
        FarmData.investment.holdings.unshift({
            id: generateId(),
            breed: lot.breed,
            units,
            purchasePrice: amount,
            currentValue: amount,
            weightStartKg: 220,
            weightCurrentKg: 220,
            growthPercent: 0,
            feedTier: lot.feedTier,
            lockUntil,
            status: lockUntil ? 'Locked' : 'Tradable',
            tag: `BRN-${lot.breed.slice(0, 2).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`
        });
        FarmData.investment.transactions.unshift({
            id: generateId(),
            type: 'Buy',
            rail: form.get('rail'),
            amount,
            status: 'Escrow initiated',
            date: new Date().toISOString().split('T')[0]
        });
        saveData();
        closeModal();
        this.render();
        showNotification('Purchase initiated through Borne Farms escrow', 'success');
    },

    makeOffer(event) {
        event.preventDefault();
        const form = new FormData(event.target);
        FarmData.investment.marketplaceOffers.unshift({
            id: generateId(),
            holdingId: form.get('holdingId'),
            buyer: form.get('buyer'),
            price: parseInt(form.get('price'), 10) || 0,
            expires: this.futureDate(0, 7),
            status: 'Open'
        });
        saveData();
        closeModal();
        this.renderOffers();
        showNotification('Buyer offer posted', 'success');
    },

    applyLock(event) {
        event.preventDefault();
        const form = new FormData(event.target);
        this.lockHolding(form.get('holdingId'), parseInt(form.get('months'), 10) || 6);
        closeModal();
    },

    lockHolding(id, months = 6) {
        const holding = FarmData.investment.holdings.find(item => item.id === id);
        if (!holding) return;
        holding.status = 'Locked';
        holding.lockUntil = this.futureDate(months);
        saveData();
        this.renderPortfolio();
        this.renderSummary();
        showNotification('Investment locked successfully', 'success');
    },

    requestSale(id) {
        const holding = FarmData.investment.holdings.find(item => item.id === id);
        if (!holding || holding.status !== 'Tradable') return;
        FarmData.investment.marketplaceOffers.unshift({
            id: generateId(),
            holdingId: id,
            buyer: 'Open Marketplace',
            price: Math.round(holding.currentValue * 1.04),
            expires: this.futureDate(0, 5),
            status: 'Open'
        });
        saveData();
        this.renderOffers();
        this.switchTab('offers');
        showNotification('Sale request listed for buyer offers', 'success');
    },

    acceptOffer(id) {
        const offer = FarmData.investment.marketplaceOffers.find(item => item.id === id);
        if (!offer || offer.status !== 'Open') return;
        offer.status = 'Accepted';
        FarmData.investment.wallet.escrowValue = (FarmData.investment.wallet.escrowValue || 0) + offer.price;
        FarmData.investment.transactions.unshift({
            id: generateId(),
            type: 'Sale',
            rail: 'Borne Farms Escrow',
            amount: offer.price,
            status: 'Pending settlement',
            date: new Date().toISOString().split('T')[0]
        });
        saveData();
        this.render();
        showNotification('Offer accepted and moved to escrow', 'success');
    },

    rejectOffer(id) {
        const offer = FarmData.investment.marketplaceOffers.find(item => item.id === id);
        if (!offer) return;
        offer.status = 'Rejected';
        saveData();
        this.renderOffers();
        showNotification('Offer rejected', 'info');
    },

    recordPayment(event) {
        event.preventDefault();
        const form = new FormData(event.target);
        const amount = parseInt(form.get('amount'), 10) || 0;
        FarmData.investment.wallet.balance += amount;
        FarmData.investment.transactions.unshift({
            id: generateId(),
            type: 'Deposit',
            rail: form.get('rail'),
            amount,
            status: 'Settled',
            date: new Date().toISOString().split('T')[0]
        });
        saveData();
        closeModal();
        this.render();
        showNotification('Wallet deposit simulated', 'success');
    },

    futureDate(months = 0, days = 0) {
        const date = new Date();
        date.setMonth(date.getMonth() + months);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }
};

window.FinanceModule = FinanceModule;
