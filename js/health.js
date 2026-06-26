// ========================================
// BORNE FARMS — Health Module
// ========================================

const HealthModule = {
    init() {
        this.updateStats();
        this.renderDiseases();
        this.renderPregnancy();
    },

    updateStats() {
        const stats = calculateStats();
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setVal('healthyCount', stats.healthy);
        setVal('sickCount', stats.sick);
        setVal('pregnantHealthCount', stats.pregnant);
        setVal('vaccinatedCount', 0);
    },

    renderDiseases() {
        const list = document.getElementById('diseaseList');
        if (!list) return;

        const issues = FarmData.activeHealthIssues;
        if (issues.length === 0) {
            list.innerHTML = '<li style="padding:var(--space-lg);text-align:center;color:var(--text-muted);">No active disease cases</li>';
            return;
        }

        list.innerHTML = issues.map(h => `
            <li style="padding:var(--space-sm) 0;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <strong>${h.disease || 'Unknown'}</strong>
                    <div style="font-size:0.8rem;color:var(--text-secondary);">${h.category || ''} — ${formatDate(h.date)}</div>
                </div>
                <span class="disease-badge ${h.severity || 'medium'}">${h.severity || 'medium'}</span>
            </li>
        `).join('');
    },

    renderPregnancy() {
        const list = document.getElementById('pregnancyList');
        if (!list) return;

        const pregnant = FarmData.livestock.cattle.cow.pregnant || 0;
        if (pregnant === 0) {
            list.innerHTML = '<li style="padding:var(--space-lg);text-align:center;color:var(--text-muted);">No pregnancies tracked</li>';
            return;
        }

        list.innerHTML = `<li style="padding:var(--space-md); color:var(--accent-pink);">${pregnant} cow(s) currently pregnant</li>`;
    },

    reportHealth(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        recordHealth({
            category: formData.get('category') || 'cow',
            type: formData.get('type'),
            disease: formData.get('disease'),
            symptoms: formData.get('symptoms'),
            treatment: formData.get('treatment'),
            severity: formData.get('severity'),
            vaccine: formData.get('vaccine'),
            notes: formData.get('notes'),
            count: 1
        });

        closeModal();
        showNotification('Health record saved', 'success');
        this.updateStats();
        this.renderDiseases();
        DashboardModule.updateStats();
        lucide.createIcons();
    }
};
