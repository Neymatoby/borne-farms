// ========================================
// BORNE FARMS — Dashboard Module
// ========================================

const DashboardModule = {
    feedGrowthChart: null,

    init() {
        this.updateStats();
        this.initCharts();
        this.populateMovements();
        this.renderGoals();
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

        // Animate count up
        this.animateValue('totalLivestock', stats.total);
        this.animateValue('maleCount', stats.male);
        this.animateValue('femaleCount', stats.female);
        this.animateValue('youngCount', stats.young);
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

        const chartStyle = {
            brown: 'rgba(160, 114, 74, 0.8)',
            brownLight: 'rgba(160, 114, 74, 0.1)',
            green: 'rgba(95, 160, 82, 0.8)',
            greenLight: 'rgba(95, 160, 82, 0.1)',
            amber: 'rgba(212, 160, 23, 0.8)',
            amberLight: 'rgba(212, 160, 23, 0.1)',
            textMuted: '#6b6356',
            gridColor: '#33302a'
        };

        this.feedGrowthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [
                    {
                        label: 'Feed Consumption (kg)',
                        data: [0, 0, 0, 0],
                        borderColor: chartStyle.brown,
                        backgroundColor: chartStyle.brownLight,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointBackgroundColor: chartStyle.brown,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Weight Gain (kg)',
                        data: [0, 0, 0, 0],
                        borderColor: chartStyle.green,
                        backgroundColor: chartStyle.greenLight,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointBackgroundColor: chartStyle.green,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Milk Yield (L)',
                        data: [0, 0, 0, 0],
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
                <div class="activity-icon" style="background: rgba(160,114,74,0.1); color: var(--accent-brown-light);">
                    <i data-lucide="move"></i>
                </div>
                <span class="activity-text">${m.from} → ${m.to}</span>
                <span class="activity-time">${formatDateTime(m.date)}</span>
            </li>
        `).join('');
    }
};
