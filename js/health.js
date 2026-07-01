// ========================================
// BORNE FARMS — Health Module
// ========================================

const HealthModule = {
    init() {
        this.updateStats();
        this.renderDiseases();
        this.renderPregnancy();
        this.renderVaccinations();
    },

    updateStats() {
        const stats = calculateStats();
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setVal('healthyCount', stats.healthy);
        setVal('sickCount', stats.sick);
        setVal('pregnantHealthCount', stats.pregnant);
        // Calculate vaccinated count from vaccination records
        const vaxRecords = FarmData.vaccinationRecords || [];
        const totalVaccinated = vaxRecords.reduce((sum, r) => sum + (r.count || 0), 0);
        setVal('vaccinatedCount', totalVaccinated);
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

    renderVaccinations() {
        const list = document.getElementById('vaccinationList');
        if (!list) return;
        const records = FarmData.vaccinationRecords || [];
        if (records.length === 0) {
            list.innerHTML = '<li style="padding:var(--space-lg);text-align:center;color:var(--text-muted);">No vaccination records</li>';
            return;
        }
        list.innerHTML = records.map(v => `
            <li style="padding:var(--space-sm) 0;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <strong>${v.vaccine}</strong>
                    <div style="font-size:0.8rem;color:var(--text-secondary);">${v.category || ''} — ${formatDate(v.date)} • ${v.handler || ''}</div>
                </div>
                <span style="font-weight:600;color:var(--accent-green);">${v.count} animals</span>
            </li>
        `).join('');
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
        this.renderVaccinations();
        DashboardModule.refresh();
        lucide.createIcons();
    }
};
