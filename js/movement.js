// ========================================
// BORNE FARMS — Movement Module
// ========================================

const MovementModule = {
    init() {
        this.updateLocationCounts();
        this.renderHistory();
    },

    updateLocationCounts() {
        const locations = FarmData.locations;
        const setCount = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        setCount('penCount', locations.paddock);
        setCount('fieldCount', locations.pasture);
        setCount('transportCount', locations.transport);
        setCount('quarantineCount', locations.quarantine);
    },

    renderHistory() {
        const tbody = document.getElementById('movementHistory');
        if (!tbody) return;

        const movements = FarmData.recentMovements.slice(0, 20);
        if (movements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:var(--space-xl);">No movement records yet</td></tr>';
            return;
        }

        tbody.innerHTML = movements.map(m => `
            <tr>
                <td>${formatDateTime(m.date)}</td>
                <td>${m.animalId || '—'}</td>
                <td>${LocationLabels[m.from] || m.from}</td>
                <td>${LocationLabels[m.to] || m.to}</td>
                <td>${m.reason || '—'}</td>
                <td>${m.handler || '—'}</td>
            </tr>
        `).join('');
    },

    recordMovement(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        recordMovement({
            animalId: formData.get('animalId'),
            from: formData.get('from'),
            to: formData.get('to'),
            reason: formData.get('reason'),
            handler: formData.get('handler'),
            count: 1
        });

        closeModal();
        showNotification('Movement recorded successfully', 'success');
        this.updateLocationCounts();
        this.renderHistory();
        DashboardModule.populateMovements();
        lucide.createIcons();
    }
};
