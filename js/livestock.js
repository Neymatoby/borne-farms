// ========================================
// BORNE FARMS — Livestock Module
// ========================================

const LivestockModule = {
    init() {
        this.renderGrid();
    },

    renderGrid() {
        const grid = document.getElementById('livestockGrid');
        if (!grid) return;

        const stats = calculateStats();

        if (stats.total === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: var(--space-2xl); color: var(--text-muted);">
                    <i data-lucide="beef" style="width: 48px; height: 48px; margin-bottom: var(--space-md); opacity: 0.3;"></i>
                    <h3 style="margin-bottom: var(--space-sm); color: var(--text-secondary);">No cattle registered yet</h3>
                    <p>Add your first cattle to get started with Borne Farms.</p>
                    <button class="btn btn-primary" style="margin-top: var(--space-lg);" onclick="openModal('addLivestock')">
                        <i data-lucide="plus"></i> Add First Cattle
                    </button>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        // Show category summary cards
        const categories = [
            { key: 'bull', label: 'Bulls', icon: 'circle-user', accent: 'brown' },
            { key: 'cow', label: 'Cows', icon: 'circle-user-round', accent: 'green' },
            { key: 'calf', label: 'Calves', icon: 'baby', accent: 'amber' }
        ];

        grid.innerHTML = categories.map(cat => {
            const data = FarmData.livestock.cattle[cat.key];
            return `
                <div class="livestock-card">
                    <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-lg);">
                        <div style="width:44px;height:44px;border-radius:var(--radius-md);background:color-mix(in srgb, var(--accent-${cat.accent}) 12%, transparent);display:flex;align-items:center;justify-content:center;">
                            <i data-lucide="${cat.icon}" style="width:22px;height:22px;color:var(--accent-${cat.accent}-light);"></i>
                        </div>
                        <div>
                            <div style="font-size:1.6rem;font-weight:600;font-family:var(--serif);">${data.count}</div>
                            <div style="font-size:0.8rem;color:var(--text-secondary);">${cat.label}</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:var(--space-md);font-size:0.8rem;">
                        <span style="color:var(--accent-pink);">♥ ${data.pregnant} pregnant</span>
                        <span style="color:var(--accent-red);">● ${data.sick} sick</span>
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    },

    addAnimal(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const category = formData.get('category');
        const count = parseInt(formData.get('count')) || 1;

        if (FarmData.livestock.cattle[category]) {
            FarmData.livestock.cattle[category].count += count;
            saveData();
        }

        closeModal();
        showNotification(`Added ${count} ${SubCategoryLabels[category]?.name || category}`, 'success');

        this.renderGrid();
        DashboardModule.refresh();
        lucide.createIcons();
    }
};
