// ========================================
// BORNE FARMS — Dashboard Module
// ========================================

const DashboardModule = {
    feedGrowthChart: null,
    herdChart: null,
    milkChart: null,

    init() {
        this.updateStats();
        this.initCharts();
        this.populateMovements();
        this.renderGoals();
        this.renderInsights();
        this.renderAlerts();
        this.renderDashboardCCTVPreview();
    },

    // Re-render all dynamic dashboard pieces after a data mutation.
    refresh() {
        this.updateStats();
        this.populateMovements();
        this.renderGoals();
        this.renderInsights();
        this.renderAlerts();
        this.renderDashboardCCTVPreview();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    renderDashboardCCTVPreview() {
        const el = document.getElementById('dashboardCCTVPreview');
        if (!el) return;
        const cameras = FarmData.cameras || [];
        const cam = cameras.find(c => c.stream_url && c.status === 'online') || cameras[0] || null;
        if (!cam) {
            el.innerHTML = '<div class="cctv-placeholder"><i data-lucide="video-off"></i><span>No cameras configured</span></div>';
            return;
        }
        const hasStream = cam.stream_url && cam.stream_url.trim().length > 0;
        el.innerHTML = `
            ${hasStream ? `<video src="${cam.stream_url}" autoplay muted playsinline style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"></video>` : `<img src="" style="width:100%; height:100%; object-fit:cover; display:none;" />`}
            <div class="cctv-placeholder" style="${hasStream ? 'display:none;' : ''}">
                <i data-lucide="video"></i>
                <span>${cam.name} ${cam.status === 'offline' ? '— OFFLINE' : ''}</span>
                ${!hasStream ? '<span style="font-size:0.65rem;color:var(--text-muted);">Set stream URL in CCTV settings</span>' : ''}
            </div>
            <div class="cctv-overlay">
                <div class="cctv-label">
                    <span>${cam.id.toUpperCase()} — ${cam.name}</span>
                    <span class="cctv-status ${cam.status === 'online' ? '' : 'offline'}"><span class="live-dot"></span> ${cam.status === 'online' ? 'LIVE' : 'OFFLINE'}</span>
                </div>
            </div>
        `;
    },

    renderGoals() {
        const container = document.getElementById('goalProgressContainer');
        if (!container) return;
        const goals = FarmData.goals || { primaryGoal: 'No goals set', progress: 0, tasks: [] };
        
        let tasksHtml = goals.tasks.map(t => {
            const isComp = t.status === 'completed';
            const isInProg = t.status === 'in-progress';
            const icon = isComp ? 'check-circle' : 'circle';
            const color = isComp ? 'var(--accent-green)' : (isInProg ? 'var(--accent-amber)' : 'var(--text-muted)');
            const bgClass = isInProg ? 'border-left: 3px solid var(--accent-amber);' : '';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-tertiary); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); ${bgClass}">
                    <span><i data-lucide="${icon}" style="width:16px; height:16px; color:${color}; vertical-align:middle; margin-right:4px;"></i>${t.name}</span>
                    <span style="font-size: 0.8rem; color: ${color}; text-transform: capitalize;">${t.status}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="flex: 1;">
                <h4 style="margin-bottom: var(--space-sm);">Today's Primary Goal</h4>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-md);">${goals.primaryGoal}</p>
                <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-md);">
                    <div style="flex: 1; height: 8px; background: var(--bg-tertiary); border-radius: var(--radius-full); overflow: hidden;">
                        <div style="width: ${goals.progress}%; height: 100%; background: var(--gradient-green); transition: width 1s ease;"></div>
                    </div>
                    <span style="font-weight: 600;">${goals.progress}%</span>
                </div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: var(--space-sm);">
                ${tasksHtml}
            </div>
        `;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    updateStats() {
        const stats = calculateStats();

        // Reveal real stat values (remove skeleton shimmer)
        document.querySelectorAll('.stat-value.skeleton, .stat-label.skeleton').forEach(el => {
            el.classList.remove('skeleton');
        });

        // Animate count up
        this.animateValue('totalLivestock', stats.total);
        this.animateValue('pregnantCount', stats.pregnant);
        this.animateValue('milkProduction', stats.milkProduction);
        this.animateValue('deathsMonth', stats.deathsThisMonth);
        this.animateValue('diseaseCount', stats.activeDiseases);
    },

    animateValue(elementId, target) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const duration = 1200;
        const start = parseInt(el.textContent) || 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(start + (target - start) * eased);
            if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
    },

    initCharts() {
        const ctx = document.getElementById('feedGrowthChart');
        if (!ctx) return;

        // Arva palette
        const chartStyle = {
            forest: '#07503f',
            forestLight: 'rgba(7, 80, 63, 0.10)',
            olive: '#7e9a3c',
            oliveLight: 'rgba(126, 154, 60, 0.10)',
            amber: '#c7913c',
            amberLight: 'rgba(199, 145, 60, 0.10)',
            textMuted: '#6d6d6d',
            gridColor: 'rgba(33, 37, 41, 0.08)'
        };

        // Build chart data from real FarmData history
        const feedHist = FarmData.feedConsumptionHistory || [];
        const weightHist = FarmData.weightHistory || [];
        const milkHist = FarmData.milkHistory || [];

        const labels = feedHist.length > 0
            ? feedHist.map(h => h.week === 0 ? 'This Week' : `Week ${h.week}`)
            : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

        const feedData = feedHist.length > 0
            ? feedHist.map(h => Math.round(h.total / 100))
            : [78, 84, 81, 89];

        const weightData = weightHist.length >= 2
            ? (() => {
                const data = [];
                const first = weightHist[0];
                for (let i = 0; i < weightHist.length; i++) {
                    data.push(Number((weightHist[i].avg - first.avg).toFixed(1)));
                }
                return data;
            })()
            : [0, 3, 6, 11];

        const milkData = milkHist.length > 0
            ? milkHist.map(m => Math.round(m.liters / 10))
            : [72, 79, 81, 85];

        this.feedGrowthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Feed Consumption (×100 kg)',
                        data: feedData,
                        borderColor: chartStyle.forest,
                        backgroundColor: chartStyle.forestLight,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointBackgroundColor: chartStyle.forest,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Avg Weight Gain (kg)',
                        data: weightData,
                        borderColor: chartStyle.olive,
                        backgroundColor: chartStyle.oliveLight,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointBackgroundColor: chartStyle.olive,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Milk Yield (×10 L)',
                        data: milkData,
                        borderColor: chartStyle.amber,
                        backgroundColor: chartStyle.amberLight,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointBackgroundColor: chartStyle.amber,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { color: chartStyle.textMuted, font: { family: 'Inter', size: 12 }, padding: 20 }
                    }
                },
                scales: {
                    x: {
                        grid: { color: chartStyle.gridColor },
                        ticks: { color: chartStyle.textMuted, font: { family: 'Inter' } }
                    },
                    y: {
                        grid: { color: chartStyle.gridColor },
                        ticks: { color: chartStyle.textMuted, font: { family: 'Inter' } }
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
    },

    populateMovements() {
        const list = document.getElementById('recentMovements');
        if (!list) return;

        const movements = FarmData.recentMovements.slice(0, 5);
        if (movements.length === 0) {
            list.innerHTML = '<li class="activity-item"><span class="activity-text" style="color: var(--text-muted);">No recent movements</span></li>';
            return;
        }

        list.innerHTML = movements.map(m => `
            <li class="activity-item">
                <div class="activity-icon" style="background: color-mix(in srgb, var(--accent-brown) 12%, transparent); color: var(--accent-brown-light);">
                    <i data-lucide="move"></i>
                </div>
                <span class="activity-text">${m.from} → ${m.to}</span>
                <span class="activity-time">${formatDateTime(m.date)}</span>
            </li>
        `).join('');
    },

    // ---- New insight widgets ----
    renderInsights() {
        this.renderHerdChart();
        this.renderMilkChart();
        this.renderFinanceSummary();
    },

    renderHerdChart() {
        const ctx = document.getElementById('herdCompositionChart');
        if (!ctx || typeof Chart === 'undefined') return;
        const stats = calculateStats();
        if (this.herdChart) this.herdChart.destroy();
        this.herdChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Bulls', 'Cows', 'Calves'],
                datasets: [{
                    data: [stats.male, stats.female, stats.young],
                    backgroundColor: ['#07503f', '#7e9a3c', '#c7913c'],
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: true, cutout: '62%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#6d6d6d', font: { family: 'Inter', size: 11 }, padding: 14 } }
                },
                animation: { animateRotate: true, duration: 1100 }
            }
        });
    },

    // Build the last 7 calendar days (today back) from dated milk entries.
    milkSeries() {
        const hist = FarmData.milkHistory || [];
        const map = {};
        hist.forEach(e => {
            if (e && typeof e === 'object') map[e.date] = e.liters;
        });
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const dt = new Date(Date.now() - i * 86400000);
            const key = dt.toISOString().split('T')[0];
            days.push({
                label: dt.toLocaleDateString('en-NG', { weekday: 'short' }),
                liters: key in map ? map[key] : null
            });
        }
        return days;
    },

    // Animate the milk trend in place after a new reading (no destroy/recreate)
    updateMilkChart() {
        if (!this.milkChart) { this.renderMilkChart(); return; }
        const series = this.milkSeries();
        this.milkChart.data.labels = series.map(d => d.label);
        this.milkChart.data.datasets[0].data = series.map(d => d.liters);
        this.milkChart.update();
    },

    logMilk(event) {
        event.preventDefault();
        const fd = new FormData(event.target);
        const liters = parseInt(fd.get('liters')) || 0;
        const date = fd.get('date') || undefined;
        recordMilk(liters, date);
        closeModal();
        const today = new Date().toISOString().split('T')[0];
        const when = (!date || date === today) ? 'today' : `on ${date}`;
        showNotification(`Logged ${liters.toLocaleString()} L of milk ${when}`, 'success');
        this.updateStats();      // animates the "Milk (L/day)" KPI
        this.updateMilkChart();  // animates the 7-day trend line
        this.renderAlerts();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    renderMilkChart() {
        const ctx = document.getElementById('milkTrendChart');
        if (!ctx || typeof Chart === 'undefined') return;
        const series = this.milkSeries();
        const labels = series.map(d => d.label);
        if (this.milkChart) this.milkChart.destroy();
        this.milkChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Milk (L/day)',
                    data: series.map(d => d.liters),
                    borderColor: '#07503f',
                    backgroundColor: 'rgba(7,80,63,0.10)',
                    fill: true, tension: 0.4, borderWidth: 2, spanGaps: true,
                    pointBackgroundColor: '#07503f', pointRadius: 3, pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(33,37,41,0.08)' }, ticks: { color: '#6d6d6d', font: { family: 'Inter' } } },
                    y: { grid: { color: 'rgba(33,37,41,0.08)' }, ticks: { color: '#6d6d6d', font: { family: 'Inter' } } }
                },
                animation: { duration: 1200, easing: 'easeOutQuart' }
            }
        });
    },

    renderFinanceSummary() {
        const el = document.getElementById('financeSummary');
        if (!el) return;
        const fin = FarmData.finance;
        if (!fin) { el.innerHTML = '<p style="color:var(--text-muted);">No finance data</p>'; return; }
        const sum = arr => arr.reduce((t, x) => t + x.value, 0);
        const income = sum(fin.income), expense = sum(fin.expense), net = income - expense;
        const cur = fin.currency || '₦';
        const fmt = n => cur + (n / 1000).toLocaleString('en-NG', { maximumFractionDigits: 0 }) + 'k';
        const max = Math.max(income, expense) || 1;
        const bar = (val, color) => `<div style="height:10px;background:var(--bg-tertiary);overflow:hidden;"><div style="width:${(val / max * 100).toFixed(1)}%;height:100%;background:${color};"></div></div>`;
        el.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:var(--space-md);">
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;">
                        <span style="color:var(--text-secondary);">Income</span><strong>${fmt(income)}</strong>
                    </div>
                    ${bar(income, '#07503f')}
                </div>
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;">
                        <span style="color:var(--text-secondary);">Expenses</span><strong>${fmt(expense)}</strong>
                    </div>
                    ${bar(expense, '#c7913c')}
                </div>
                <div style="border-top:1px solid var(--border-color);padding-top:var(--space-md);display:flex;justify-content:space-between;align-items:baseline;">
                    <span style="color:var(--text-secondary);">Net this month</span>
                    <span class="stat-value" style="font-size:1.5rem;color:${net >= 0 ? '#07503f' : 'var(--accent-red)'};">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</span>
                </div>
            </div>`;
    },

    renderAlerts() {
        const list = document.getElementById('farmAlerts');
        if (!list) return;
        const items = [];

        // Health alerts
        (FarmData.activeHealthIssues || []).forEach(h => {
            const color = h.severity === 'high' ? 'var(--accent-red)' : (h.severity === 'low' ? 'var(--accent-green)' : 'var(--accent-amber)');
            items.push({ icon: 'heart-pulse', color, text: `<strong>${h.disease}</strong> — ${h.category} (${h.severity})`, time: formatDate(h.date) });
        });

        // Low feed stock alerts (less than ~5 days remaining)
        let daily = 0;
        Object.values(FarmData.dailyFeedConsumption || {}).forEach(v => daily += v);
        Object.entries(FarmData.feedInventory || {}).forEach(([key, f]) => {
            if (f.quantity < 1000) {
                items.push({ icon: 'wheat', color: 'var(--accent-amber)', text: `Low stock: <strong>${FeedLabels[key] || key}</strong> (${f.quantity.toLocaleString()} kg)`, time: 'Restock soon' });
            }
        });

        // Pending / in-progress tasks
        ((FarmData.goals && FarmData.goals.tasks) || []).forEach(t => {
            if (t.status !== 'completed') {
                items.push({ icon: 'circle-dot', color: t.status === 'in-progress' ? 'var(--accent-amber)' : 'var(--text-muted)', text: `Task: <strong>${t.name}</strong>`, time: t.status });
            }
        });

        if (items.length === 0) {
            list.innerHTML = '<li class="activity-item"><span class="activity-text" style="color:var(--text-muted);">All clear — no alerts or pending tasks</span></li>';
            return;
        }

        list.innerHTML = items.map(it => `
            <li class="activity-item">
                <div class="activity-icon" style="background:color-mix(in srgb, ${it.color} 14%, transparent);color:${it.color};">
                    <i data-lucide="${it.icon}"></i>
                </div>
                <span class="activity-text">${it.text}</span>
                <span class="activity-time">${it.time}</span>
            </li>
        `).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};
