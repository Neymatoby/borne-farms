// ========================================
// BORNE FARMS - Cattle Investment Module
// ========================================

const FinanceModule = {
    currentTab: 'market',
    allocationChart: null,
    valueChart: null,

    async init() {
        if (!FarmData.investment && typeof ensureInvestmentData === 'function') ensureInvestmentData();
        await this.loadWallet();
        this.render();
    },

    async loadWallet() {
        this.backendWallet = { balance: 0, currency: 'NGN' };
        try {
            const res = await backendFetch('/api/wallet');
            if (res.ok) this.backendWallet = await res.json();
        } catch (e) {
            console.error('Wallet load failed:', e);
        }
    },

    formatMoney(amount) {
        return `&#8358;${Number(amount || 0).toLocaleString('en-NG')}`;
    },

    portfolioValue() {
        return FarmData.investment.holdings.reduce((sum, item) => sum + item.currentValue, 0);
    },

    totalInvested() {
        return FarmData.investment.holdings.reduce((sum, item) => sum + item.purchasePrice, 0);
    },

    netPnL() {
        return this.portfolioValue() - this.totalInvested();
    },

    roiPercent() {
        const inv = this.totalInvested();
        return inv > 0 ? (this.netPnL() / inv) * 100 : 0;
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
        this.renderTransactions();
        this.renderCharts();
        lucide.createIcons();
    },

    renderSummary() {
        const grid = document.getElementById('financeSummaryGrid');
        if (!grid) return;
        const investment = FarmData.investment;
        const tradable = investment.holdings.filter(item => item.status === 'Tradable').length;
        const pnl = this.netPnL();
        const roi = this.roiPercent();
        const pnlClass = pnl >= 0 ? 'positive' : 'negative';
        grid.innerHTML = `
            <div class="finance-mini-stat">
                <span>Portfolio</span>
                <strong>${this.formatMoney(this.portfolioValue())}</strong>
            </div>
            <div class="finance-mini-stat">
                <span>Wallet</span>
                <strong>${this.formatMoney(this.backendWallet.balance)}</strong>
            </div>
            <div class="finance-mini-stat">
                <span>Tradable</span>
                <strong>${tradable} units</strong>
            </div>
            <div class="finance-mini-stat">
                <span>Invested</span>
                <strong>${this.formatMoney(this.totalInvested())}</strong>
            </div>
            <div class="finance-mini-stat">
                <span>Net P&L</span>
                <strong class="${pnlClass}" style="color:${pnl >= 0 ? '#07503f' : 'var(--accent-red)'}">${pnl >= 0 ? '+' : '−'}${this.formatMoney(Math.abs(pnl))}</strong>
            </div>
            <div class="finance-mini-stat">
                <span>ROI</span>
                <strong style="color:${roi >= 0 ? '#07503f' : 'var(--accent-red)'}">${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%</strong>
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

    renderCharts() {
        this.renderAllocationChart();
        this.renderValueChart();
    },

    renderAllocationChart() {
        const ctx = document.getElementById('portfolioAllocationChart');
        if (!ctx || typeof Chart === 'undefined') return;
        const holdings = FarmData.investment.holdings;
        const byBreed = {};
        holdings.forEach(h => { byBreed[h.breed] = (byBreed[h.breed] || 0) + h.currentValue; });
        const labels = Object.keys(byBreed);
        const data = Object.values(byBreed);
        const palette = ['#07503f', '#7e9a3c', '#c7913c', '#b2cee7', '#c3cda7', '#fceace'];
        if (this.allocationChart) this.allocationChart.destroy();
        this.allocationChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: palette.slice(0, labels.length),
                    borderColor: '#ffffff', borderWidth: 2, hoverOffset: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#6d6d6d', font: { family: 'Inter', size: 10 }, padding: 10, boxWidth: 10 } }
                }
            }
        });
    },

    renderValueChart() {
        const ctx = document.getElementById('portfolioValueChart');
        if (!ctx || typeof Chart === 'undefined') return;

        // Build chart from real transaction history + current portfolio value
        const txns = (FarmData.investment.transactions || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        const invested = this.totalInvested();
        const current = this.portfolioValue();

        let labels, data;
        if (txns.length >= 2) {
            // Build cumulative value timeline from transactions
            let running = 0;
            data = [];
            labels = [];
            txns.forEach(t => {
                if (t.type === 'Buy' || t.type === 'Feed Upgrade') {
                    running += t.amount;
                } else if (t.type === 'Sale' || t.type === 'Dividend') {
                    running -= t.amount;
                }
                // Apply growth proportionally for Buy transactions
                const grownValue = t.type === 'Buy' ? Math.round(t.amount * (current / invested)) : running;
                data.push(grownValue);
                labels.push(t.date);
            });
            // Add current portfolio value as the final point
            data.push(current);
            labels.push('Now');
        } else if (txns.length === 1) {
            data = [txns[0].amount, current];
            labels = [txns[0].date, 'Now'];
        } else {
            // Fallback: invested → current
            data = [invested, current];
            labels = ['Invested', 'Now'];
        }

        if (this.valueChart) this.valueChart.destroy();
        this.valueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Portfolio value',
                    data,
                    borderColor: '#07503f',
                    backgroundColor: 'rgba(7,80,63,0.10)',
                    fill: true, tension: 0.35, borderWidth: 2,
                    pointBackgroundColor: '#07503f', pointRadius: 3
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(33,37,41,0.06)' }, ticks: { color: '#6d6d6d', font: { family: 'Inter', size: 10 } } },
                    y: { grid: { color: 'rgba(33,37,41,0.06)' }, ticks: { color: '#6d6d6d', font: { family: 'Inter', size: 10 }, callback: v => '₦' + (v / 1000) + 'k' } }
                }
            }
        });
    },

    renderTransactions() {
        const list = document.getElementById('transactionList');
        if (!list) return;
        const txns = FarmData.investment.transactions || [];
        if (txns.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:var(--space-lg);">No transactions yet</p>';
            return;
        }
        const iconFor = type => {
            if (type === 'Buy') return 'shopping-cart';
            if (type === 'Sale') return 'hand-coins';
            if (type === 'Deposit') return 'arrow-down-circle';
            if (type === 'Feed Upgrade') return 'wheat';
            return 'receipt';
        };
        const isPositive = type => type === 'Sale' || type === 'Deposit';
        list.innerHTML = txns.slice(0, 20).map(t => {
            const positive = isPositive(t.type);
            return `
                <div class="transaction-item">
                    <div class="tx-left">
                        <div class="tx-icon"><i data-lucide="${iconFor(t.type)}"></i></div>
                        <div class="tx-info">
                            <div class="tx-type">${t.type}</div>
                            <div class="tx-rail">${t.rail}</div>
                        </div>
                    </div>
                    <div class="tx-right">
                        <div class="tx-amount ${positive ? 'positive' : 'negative'}">${positive ? '+' : '−'}${this.formatMoney(t.amount)}</div>
                        <div class="tx-date">${formatDate(t.date)} <span class="tx-status">${t.status}</span></div>
                    </div>
                </div>
            `;
        }).join('');
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
                        <label class="form-label">Payment Source</label>
                        <input class="form-input" type="text" value="Wallet Balance (Demo)" readonly>
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
                    <button type="submit" class="btn btn-primary">Purchase with Wallet</button>
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

    async buyBreed(event) {
        event.preventDefault();
        const form = new FormData(event.target);
        const lotId = form.get('lotId');
        const units = parseInt(form.get('units'), 10) || 1;
        try {
            const res = await backendFetch('/api/marketplace/buy', {
                method: 'POST',
                body: { lotId, units }
            });
            const data = await res.json();
            if (!res.ok) {
                showNotification(data.error || 'Buy failed', 'error');
                return;
            }
            // Update local farm data to reflect purchase
            const lot = FarmData.investment.breedLots.find(item => item.id === lotId);
            if (lot && data.holding) {
                lot.availableUnits = Math.max(0, lot.availableUnits - units);
                FarmData.investment.holdings.unshift(data.holding);
            }
            await this.loadWallet();
            saveData();
            closeModal();
            this.render();
            showNotification('Purchase settled. New holding added.', 'success');
        } catch (e) {
            console.error('Buy failed:', e);
            showNotification('Could not complete purchase. Backend unavailable?', 'error');
        }
    },

    async makeOffer(event) {
        event.preventDefault();
        const form = new FormData(event.target);
        const holdingId = form.get('holdingId');
        const totalPrice = parseInt(form.get('price'), 10) || 0;
        const holding = FarmData.investment.holdings.find(item => item.id === holdingId);
        if (!holding || totalPrice <= 0) {
            showNotification('Invalid holding or price', 'error');
            return;
        }
        const pricePerUnit = Math.round(totalPrice / holding.units);
        try {
            const res = await backendFetch('/api/marketplace/sell', {
                method: 'POST',
                body: { holdingId, pricePerUnit }
            });
            const data = await res.json();
            if (!res.ok) {
                showNotification(data.error || 'Offer failed', 'error');
                return;
            }
            if (data.offer) {
                data.offer.buyer = form.get('buyer');
                FarmData.investment.marketplaceOffers.unshift(data.offer);
            }
            holding.status = 'Listed';
            saveData();
            closeModal();
            this.renderOffers();
            showNotification('Buyer offer posted', 'success');
        } catch (e) {
            console.error('Offer failed:', e);
            showNotification('Could not post offer. Backend unavailable?', 'error');
        }
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

    async requestSale(id) {
        const holding = FarmData.investment.holdings.find(item => item.id === id);
        if (!holding || holding.status !== 'Tradable') return;
        const pricePerUnit = Math.round(holding.currentValue / holding.units * 1.04);
        try {
            const res = await backendFetch('/api/marketplace/sell', {
                method: 'POST',
                body: { holdingId: id, pricePerUnit }
            });
            const data = await res.json();
            if (!res.ok) {
                showNotification(data.error || 'Listing failed', 'error');
                return;
            }
            if (data.offer) FarmData.investment.marketplaceOffers.unshift(data.offer);
            holding.status = 'Listed';
            saveData();
            this.renderOffers();
            this.switchTab('offers');
            showNotification('Sale request listed for buyer offers', 'success');
        } catch (e) {
            console.error('Sale listing failed:', e);
            showNotification('Could not list holding. Backend unavailable?', 'error');
        }
    },

    async acceptOffer(id) {
        try {
            const res = await backendFetch('/api/offers/respond', {
                method: 'POST',
                body: { offerId: id, action: 'accept' }
            });
            const data = await res.json();
            if (!res.ok) {
                showNotification(data.error || 'Accept failed', 'error');
                return;
            }
            const offer = FarmData.investment.marketplaceOffers.find(item => item.id === id);
            if (offer && data.offer) Object.assign(offer, data.offer);
            if (data.holding) {
                const idx = FarmData.investment.holdings.findIndex(h => h.id === data.holding.id);
                if (idx >= 0) FarmData.investment.holdings[idx] = data.holding;
                else FarmData.investment.holdings.unshift(data.holding);
            }
            await this.loadWallet();
            saveData();
            this.render();
            showNotification('Offer accepted and settled', 'success');
        } catch (e) {
            console.error('Accept offer failed:', e);
            showNotification('Could not accept offer. Backend unavailable?', 'error');
        }
    },

    async rejectOffer(id) {
        try {
            const res = await backendFetch('/api/offers/respond', {
                method: 'POST',
                body: { offerId: id, action: 'reject' }
            });
            const data = await res.json();
            if (!res.ok) {
                showNotification(data.error || 'Reject failed', 'error');
                return;
            }
            const offer = FarmData.investment.marketplaceOffers.find(item => item.id === id);
            if (offer) offer.status = 'Rejected';
            saveData();
            this.renderOffers();
            showNotification('Offer rejected', 'info');
        } catch (e) {
            console.error('Reject offer failed:', e);
            showNotification('Could not reject offer. Backend unavailable?', 'error');
        }
    },

    async recordPayment(event) {
        event.preventDefault();
        const form = new FormData(event.target);
        const amount = parseInt(form.get('amount'), 10) || 0;
        const rail = form.get('rail') || 'Paystack Bank Transfer';
        const provider = rail.toLowerCase().includes('paystack') ? 'paystack' : rail.toLowerCase().includes('flutterwave') ? 'flutterwave' : 'stripe';
        try {
            const res = await backendFetch('/api/payment/checkout', {
                method: 'POST',
                body: { amount, provider }
            });
            const data = await res.json();
            if (!res.ok) {
                showNotification(data.error || 'Checkout failed', 'error');
                return;
            }
            // Simulate the payment callback immediately in demo mode
            const callback = await backendFetch(data.checkout_url);
            const callbackData = await callback.json();
            if (!callback.ok) {
                showNotification(callbackData.error || 'Payment simulation failed', 'error');
                return;
            }
            await this.loadWallet();
            FarmData.investment.transactions.unshift({
                id: generateId(),
                type: 'Deposit',
                rail: rail,
                amount,
                status: 'Settled',
                date: new Date().toISOString().split('T')[0],
                reference: data.reference
            });
            saveData();
            closeModal();
            this.render();
            showNotification('Wallet deposit settled', 'success');
        } catch (e) {
            console.error('Payment failed:', e);
            showNotification('Could not process payment. Backend unavailable?', 'error');
        }
    },

    futureDate(months = 0, days = 0) {
        const date = new Date();
        date.setMonth(date.getMonth() + months);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }
};

window.FinanceModule = FinanceModule;
