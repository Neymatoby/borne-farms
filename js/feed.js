// ========================================
// BORNE FARMS — Feed Module
// ========================================

const FeedModule = {
    feedByTypeChart: null,

    init() {
        this.updateStats();
        this.initCharts();
        this.renderInventory();
    },

    updateStats() {
        const inv = FarmData.feedInventory;
        let totalStock = 0;
        for (const feed of Object.values(inv)) {
            totalStock += feed.quantity;
        }

        let dailyTotal = 0;
        for (const val of Object.values(FarmData.dailyFeedConsumption)) {
            dailyTotal += val;
        }

        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setVal('totalFeedStock', totalStock.toLocaleString());
        setVal('dailyConsumption', dailyTotal.toLocaleString());
        setVal('daysRemaining', dailyTotal > 0 ? Math.floor(totalStock / dailyTotal) : '∞');
        // Calculate avg weight gain from weight history
        const wh = FarmData.weightHistory;
        if (wh && wh.length >= 2) {
            const gain = wh[wh.length - 1].avg - wh[0].avg;
            const weeks = wh[wh.length - 1].week - wh[0].week;
            const perWeek = weeks > 0 ? (gain / weeks).toFixed(1) : '0';
            setVal('avgWeightGain', perWeek);
        } else {
            setVal('avgWeightGain', '0');
        }
    },

    initCharts() {
        const ctx = document.getElementById('feedByTypeChart');
        if (!ctx) return;

        const labels = Object.values(FeedLabels);
        const data = Object.values(FarmData.feedInventory).map(f => f.quantity);
        // Arva palette
        const colors = [
            '#07503f',  // forest
            '#7e9a3c',  // olive
            '#c7913c',  // amber
            '#b2cee7',  // sky
            '#c3cda7',  // moss
            '#fceace'   // peach
        ];

        this.feedByTypeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#6d6d6d',
                            font: { family: 'Inter', size: 11 },
                            padding: 15
                        }
                    }
                },
                animation: { animateRotate: true, duration: 1200 }
            }
        });
    },

    renderInventory() {
        const list = document.getElementById('feedInventory');
        if (!list) return;

        list.innerHTML = Object.entries(FarmData.feedInventory).map(([key, feed]) => {
            const label = FeedLabels[key] || key;
            return `
                <li style="padding:var(--space-sm) 0;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>${label}</strong>
                        <div style="font-size:0.75rem;color:var(--text-muted);">Tier ${feed.tier} • ₦${feed.costPerKg}/kg</div>
                    </div>
                    <span style="font-weight:600;">${feed.quantity.toLocaleString()} kg</span>
                </li>
            `;
        }).join('');
    },

    logFeeding(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        recordFeeding({
            location: formData.get('location'),
            feedType: formData.get('feedType'),
            quantity: parseInt(formData.get('quantity')) || 0,
            animalsCount: parseInt(formData.get('animalsCount')) || 0,
            handler: formData.get('handler')
        });

        closeModal();
        showNotification('Feeding logged successfully', 'success');
        this.updateStats();
        this.renderInventory();
        if (this.feedByTypeChart) {
            this.feedByTypeChart.data.datasets[0].data = Object.values(FarmData.feedInventory).map(f => f.quantity);
            this.feedByTypeChart.update();
        }
        if (typeof DashboardModule !== 'undefined') DashboardModule.refresh();
        lucide.createIcons();
    }
};
