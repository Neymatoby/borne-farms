// ========================================
// BORNE FARMS — Intelligence Module
// 6 unique features:
// 1. Paddock-to-plate QR traceability
// 2. Predictive mortality risk scoring
// 3. Co-ownership fractional splits
// 4. Breed marketplace price intelligence
// 5. Drone NDVI pasture health scan
// 6. Diaspora investment portal
// ========================================

const IntelligenceModule = {
    BACKEND_URL: (typeof AI_BACKEND_URL !== 'undefined') ? AI_BACKEND_URL : 'http://127.0.0.1:5000',

    async fetch(endpoint, options = {}) {
        const token = (typeof API_TOKEN !== 'undefined') ? API_TOKEN : null;
        const headers = { ...(options.headers || {}) };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        const res = await fetch(`${this.BACKEND_URL}${endpoint}`, { ...options, headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
    },

    init() {
        this.loadRiskScores();
        this.loadTraceability();
        this.loadPriceIntel();
        this.loadCoOwnership();
        this.loadDiasporaPortal();
        this.loadNdviHistory();
        this.loadVoiceNotes();
        this.loadWeightHistory();
        this.loadTheftAlerts();
    },

    // ====================
    // 1. QR TRACEABILITY
    // ====================
    async loadTraceability() {
        const el = document.getElementById('traceabilityPanel');
        if (!el) return;
        try {
            const records = await this.fetch('/api/traceability');
            if (!records.length) {
                el.innerHTML = '<p style="color:var(--text-muted);">No traceability records yet. Records are auto-created from your holdings.</p>';
                return;
            }
            el.innerHTML = records.map(r => {
                const traceUrl = `${window.location.origin}${window.location.pathname.replace('dashboard.html', '')}trace.html?token=${r.qr_token}`;
                const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(traceUrl)}`;
                return `
                    <div style="display:flex;gap:var(--space-sm);align-items:center;padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:var(--space-sm);flex-wrap:wrap;">
                        <img src="${qrApiUrl}" alt="QR" style="width:80px;height:80px;border-radius:var(--radius-sm);flex-shrink:0;" loading="lazy">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:0.9rem;">${r.tag}</div>
                            <div style="font-size:0.78rem;color:var(--text-secondary);">${r.breed} &middot; ${r.category} &middot; ${r.weight_kg}kg</div>
                            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">Feed: ${r.feed_tier} &middot; Status: ${r.status}</div>
                            <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;">
                                <a href="${traceUrl}" target="_blank" style="font-size:0.72rem;color:var(--accent-green);text-decoration:underline;">View traceability</a>
                                <a href="${qrApiUrl}" target="_blank" style="font-size:0.72rem;color:var(--text-secondary);text-decoration:underline;">Download QR</a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            el.innerHTML = `<p style="color:var(--accent-red);font-size:0.8rem;">Could not load: ${e.message}</p>`;
        }
    },

    // ====================
    // 2. RISK SCORING
    // ====================
    async loadRiskScores() {
        const el = document.getElementById('riskScorePanel');
        if (!el) return;
        try {
            const data = await this.fetch('/api/risk-scores');
            const colorMap = { critical: 'var(--accent-red)', elevated: 'var(--accent-amber)', low: 'var(--accent-green)' };
            const bgMap = { critical: 'rgba(220,38,38,.08)', elevated: 'rgba(217,119,6,.08)', low: 'rgba(7,80,63,.08)' };

            el.innerHTML = `
                <div style="display:flex;gap:var(--space-md);align-items:center;margin-bottom:var(--space-md);padding:var(--space-sm);background:${bgMap[data.overall >= 65 ? 'critical' : data.overall >= 35 ? 'elevated' : 'low']};border-radius:var(--radius-md);">
                    <div style="text-align:center;">
                        <div style="font-size:2rem;font-weight:700;color:${colorMap[data.overall >= 65 ? 'critical' : data.overall >= 35 ? 'elevated' : 'low']};">${data.overall}</div>
                        <div style="font-size:0.7rem;color:var(--text-muted);">Overall Risk</div>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:0.82rem;color:var(--text-secondary);">Feed remaining: <strong>${data.feedDaysRemaining} days</strong></div>
                        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${data.feedDaysRemaining < 7 ? 'Low feed supply - restock urgently' : 'Feed supply adequate'}</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-sm);">
                    ${data.categories.map(c => `
                        <div style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-md);background:${bgMap[c.riskLevel]};">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                                <span style="font-weight:600;font-size:0.85rem;text-transform:capitalize;">${c.category}s</span>
                                <span style="font-weight:700;color:${colorMap[c.riskLevel]};font-size:0.9rem;">${c.riskScore}</span>
                            </div>
                            <div style="font-size:0.72rem;color:var(--text-muted);">${c.count} cattle &middot; ${c.sick} sick &middot; ${c.pregnant} pregnant</div>
                            <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:4px;">${c.recommendation}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            el.innerHTML = `<p style="color:var(--accent-red);font-size:0.8rem;">Could not load: ${e.message}</p>`;
        }
    },

    // ====================
    // 3. CO-OWNERSHIP
    // ====================
    async loadCoOwnership() {
        const el = document.getElementById('coOwnershipPanel');
        if (!el) return;
        const holdings = (typeof FarmData !== 'undefined' && FarmData.investment) ? FarmData.investment.holdings : [];
        if (!holdings.length) {
            el.innerHTML = '<p style="color:var(--text-muted);">No holdings available for co-ownership.</p>';
            return;
        }
        el.innerHTML = holdings.map(h => `
            <div style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:var(--space-sm);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xs);flex-wrap:wrap;gap:4px;">
                    <div style="min-width:0;">
                        <span style="font-weight:600;font-size:0.88rem;">${h.tag || h.id}</span>
                        <span style="font-size:0.78rem;color:var(--text-secondary);margin-left:6px;">${h.breed} &middot; ${h.units} units</span>
                    </div>
                    <button class="btn btn-secondary" style="padding:3px 10px;font-size:0.72rem;flex-shrink:0;" onclick="IntelligenceModule.showCoOwnerForm('${h.id}')">Add Co-Owner</button>
                </div>
                <div id="coOwners_${h.id}" style="font-size:0.78rem;color:var(--text-muted);">Loading shares...</div>
            </div>
        `).join('');

        // Load shares for each holding
        for (const h of holdings) {
            this.loadShares(h.id);
        }
    },

    async loadShares(holdingId) {
        const el = document.getElementById(`coOwners_${holdingId}`);
        if (!el) return;
        try {
            const data = await this.fetch(`/api/co-ownership/${holdingId}`);
            if (!data.shares.length) {
                el.innerHTML = '<span style="color:var(--text-muted);">Sole ownership (100%)</span>';
                return;
            }
            el.innerHTML = data.shares.map(s => `
                <div style="display:flex;justify-content:space-between;padding:2px 0;">
                    <span>${s.owner_name}</span>
                    <span style="color:var(--accent-green);font-weight:600;">${(s.fraction * 100).toFixed(0)}%</span>
                </div>
            `).join('') + (data.totalFraction < 1 ? `<div style="color:var(--text-muted);margin-top:2px;">Available: ${((1 - data.totalFraction) * 100).toFixed(0)}%</div>` : '');
        } catch (e) {
            el.innerHTML = '<span style="color:var(--text-muted);">Sole ownership (100%)</span>';
        }
    },

    showCoOwnerForm(holdingId) {
        if (typeof openModal === 'undefined') return;
        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalTitle');
        modalTitle.textContent = 'Add Co-Owner';
        modalBody.innerHTML = `
            <form onsubmit="IntelligenceModule.addCoOwner(event, '${holdingId}')">
                <div class="form-group">
                    <label class="form-label">Owner Name</label>
                    <input class="form-input" name="ownerName" placeholder="e.g., Amina K." required>
                </div>
                <div class="form-group">
                    <label class="form-label">Owner Email (optional)</label>
                    <input class="form-input" name="ownerEmail" placeholder="investor@email.com">
                </div>
                <div class="form-group">
                    <label class="form-label">Ownership Fraction (0.01 - 0.99)</label>
                    <input class="form-input" type="number" name="fraction" min="0.01" max="0.99" step="0.01" value="0.25" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Invested Amount (NGN)</label>
                    <input class="form-input" type="number" name="investedAmount" min="0" value="50000" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Co-Owner</button>
                </div>
            </form>
        `;
        document.getElementById('modalOverlay').classList.add('active');
    },

    async addCoOwner(event, holdingId) {
        event.preventDefault();
        const fd = new FormData(event.target);
        try {
            await this.fetch('/api/co-ownership/split', {
                method: 'POST',
                body: {
                    holdingId,
                    ownerName: fd.get('ownerName'),
                    ownerEmail: fd.get('ownerEmail'),
                    fraction: parseFloat(fd.get('fraction')),
                    investedAmount: parseInt(fd.get('investedAmount'))
                }
            });
            if (typeof closeModal !== 'undefined') closeModal();
            if (typeof showNotification !== 'undefined') showNotification('Co-owner added successfully', 'success');
            this.loadShares(holdingId);
        } catch (e) {
            if (typeof showNotification !== 'undefined') showNotification(e.message, 'error');
        }
    },

    // ====================
    // 4. PRICE INTELLIGENCE
    // ====================
    async loadPriceIntel() {
        const el = document.getElementById('priceIntelPanel');
        if (!el) return;
        try {
            const data = await this.fetch('/api/marketplace/prices');
            if (!data.length) {
                el.innerHTML = '<p style="color:var(--text-muted);">No price data available yet.</p>';
                return;
            }
            const trendIcon = { up: 'trending-up', down: 'trending-down', stable: 'minus' };
            const trendColor = { up: 'var(--accent-green)', down: 'var(--accent-red)', stable: 'var(--text-muted)' };
            el.innerHTML = `
                <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
                <table class="data-table" style="width:100%;font-size:0.82rem;white-space:nowrap;">
                    <thead>
                        <tr><th style="text-align:left;">Breed</th><th>Avg</th><th>Fair</th><th>Range</th><th>Trend</th><th>Advice</th></tr>
                    </thead>
                    <tbody>
                        ${data.map(d => `
                            <tr>
                                <td style="font-weight:600;">${d.breed}</td>
                                <td>₦${d.avgPrice.toLocaleString()}</td>
                                <td style="color:var(--accent-green);">₦${d.fairValue.toLocaleString()}</td>
                                <td style="font-size:0.75rem;color:var(--text-muted);">₦${d.minPrice.toLocaleString()}-${d.maxPrice.toLocaleString()}</td>
                                <td style="color:${trendColor[d.trendDirection]};"><i data-lucide="${trendIcon[d.trendDirection]}" style="width:14px;height:14px;display:inline;vertical-align:middle;"></i> ${d.trendPct > 0 ? '+' : ''}${d.trendPct}%</td>
                                <td style="font-size:0.75rem;font-weight:600;color:${d.recommendation.startsWith('Buy') ? 'var(--accent-green)' : d.recommendation.startsWith('Sell') ? 'var(--accent-amber)' : 'var(--text-muted)'};">${d.recommendation}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
                <p style="font-size:0.72rem;color:var(--text-muted);margin-top:var(--space-sm);">Based on ${data[0].sampleCount} recent sales per breed. Fair value = 97% of recent average.</p>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (e) {
            el.innerHTML = `<p style="color:var(--accent-red);font-size:0.8rem;">Could not load: ${e.message}</p>`;
        }
    },

    // ====================
    // 5. NDVI PASTURE SCAN
    // ====================
    async uploadNdvi() {
        const fileInput = document.getElementById('ndviFileInput');
        const zoneInput = document.getElementById('ndviZoneInput');
        const resultEl = document.getElementById('ndviResult');
        if (!fileInput.files[0]) {
            if (typeof showNotification !== 'undefined') showNotification('Select an image first', 'info');
            return;
        }
        resultEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Analyzing...</p>';
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        formData.append('zone', zoneInput.value || 'Pasture Zone A');
        try {
            const token = (typeof API_TOKEN !== 'undefined') ? API_TOKEN : null;
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`${this.BACKEND_URL}/api/ndvi/analyze`, {
                method: 'POST',
                body: formData,
                headers
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Analysis failed');
            const healthColors = { excellent: 'var(--accent-green)', good: 'var(--accent-green)', moderate: 'var(--accent-amber)', poor: 'var(--accent-red)', bare: 'var(--accent-red)' };
            resultEl.innerHTML = `
                <div style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-md);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xs);flex-wrap:wrap;gap:4px;">
                        <span style="font-weight:600;font-size:0.85rem;">${data.zone}</span>
                        <span style="font-weight:700;color:${healthColors[data.healthScore]};text-transform:capitalize;">${data.healthScore}</span>
                    </div>
                    <div style="display:flex;gap:var(--space-sm);align-items:center;flex-wrap:wrap;">
                        <img src="${this.BACKEND_URL}${data.visualizationUrl}" alt="NDVI" style="width:120px;height:80px;object-fit:cover;border-radius:var(--radius-sm);flex-shrink:0;max-width:100%;">
                        <div style="flex:1;min-width:0;font-size:0.78rem;">
                            <div>NDVI: <strong>${data.avgNdvi}</strong></div>
                            <div>Coverage: <strong>${data.coveragePercent}%</strong></div>
                            <div style="color:var(--text-secondary);margin-top:4px;">${data.recommendation}</div>
                        </div>
                    </div>
                </div>
            `;
            this.loadNdviHistory();
            if (typeof showNotification !== 'undefined') showNotification('NDVI analysis complete', 'success');
        } catch (e) {
            resultEl.innerHTML = `<p style="color:var(--accent-red);font-size:0.8rem;">${e.message}</p>`;
        }
    },

    async loadNdviHistory() {
        const el = document.getElementById('ndviHistory');
        if (!el) return;
        try {
            const scans = await this.fetch('/api/ndvi/scans');
            if (!scans.length) {
                el.innerHTML = '';
                return;
            }
            const healthColors = { excellent: 'var(--accent-green)', good: 'var(--accent-green)', moderate: 'var(--accent-amber)', poor: 'var(--accent-red)', bare: 'var(--accent-red)' };
            el.innerHTML = `
                <h4 style="font-size:0.85rem;margin-bottom:var(--space-sm);">Scan History</h4>
                ${scans.slice(0, 5).map(s => `
                    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);font-size:0.78rem;">
                        <span>${s.zone}</span>
                        <span style="color:${healthColors[s.health_score]};font-weight:600;text-transform:capitalize;">${s.health_score} (${s.avg_ndvi})</span>
                        <span style="color:var(--text-muted);">${s.scan_date.split('T')[0]}</span>
                    </div>
                `).join('')}
            `;
        } catch (e) {
            el.innerHTML = '';
        }
    },

    // ====================
    // 6. DIASPORA PORTAL
    // ====================
    async loadDiasporaPortal() {
        const el = document.getElementById('diasporaPanel');
        if (!el) return;
        try {
            const data = await this.fetch('/api/diaspora/portal');
            const farm = data.farm;
            const perf = data.performance;
            el.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--space-sm);margin-bottom:var(--space-md);">
                    <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:1.5rem;font-weight:700;color:var(--accent-green);">${farm.totalCattle}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">Total Cattle</div>
                    </div>
                    <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:1.5rem;font-weight:700;color:var(--accent-green);">+${farm.avgGrowthPercent}%</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">Avg Growth</div>
                    </div>
                    <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:1.5rem;font-weight:700;color:var(--accent-green);">${farm.avgDailyMilkLiters}L</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">Daily Milk</div>
                    </div>
                    <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:1.5rem;font-weight:700;color:var(--accent-green);">${data.breedLots.length}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">Breed Lots</div>
                    </div>
                </div>
                <h4 style="font-size:0.85rem;margin-bottom:var(--space-sm);">Available Investment Lots</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-sm);margin-bottom:var(--space-md);">
                    ${data.breedLots.map(lot => `
                        <div style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-md);">
                            <div style="font-weight:600;font-size:0.85rem;">${lot.breed}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);">${lot.localName} &middot; ${lot.region}</div>
                            <div style="display:flex;justify-content:space-between;margin-top:var(--space-xs);font-size:0.8rem;flex-wrap:wrap;gap:4px;">
                                <span>₦${lot.unitPrice.toLocaleString()}/unit</span>
                                <span style="color:var(--accent-green);">${lot.availableUnits} avail</span>
                            </div>
                            <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">Growth: ${lot.expectedMonthlyGrowth}%/mo &middot; Feed: ${lot.feedTier}</div>
                        </div>
                    `).join('')}
                </div>
                ${data.liveCameras.length ? `
                    <h4 style="font-size:0.85rem;margin-bottom:var(--space-sm);">Live Farm Cameras</h4>
                    <p style="font-size:0.78rem;color:var(--text-secondary);">${data.liveCameras.length} camera(s) streaming live. Investors can watch their cattle in real time.</p>
                ` : '<p style="font-size:0.78rem;color:var(--text-muted);">No live cameras currently streaming.</p>'}
                <div style="margin-top:var(--space-md);padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);">
                    <div style="font-size:0.78rem;color:var(--text-secondary);"><strong>How it works:</strong> Diaspora investors browse live farm data, buy cattle units via wallet, watch via CCTV, and receive revenue splits automatically.</div>
                </div>
            `;
        } catch (e) {
            el.innerHTML = `<p style="color:var(--accent-red);font-size:0.8rem;">Could not load: ${e.message}</p>`;
        }
    },

    // ====================
    // 7. VOICE NOTES
    // ====================
    _mediaRecorder: null,
    _audioChunks: [],
    _recording: false,
    _recordStart: 0,

    async toggleRecording() {
        if (this._recording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    },

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this._audioChunks = [];
            this._mediaRecorder = new MediaRecorder(stream);
            this._mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this._audioChunks.push(e.data);
            };
            this._mediaRecorder.onstop = () => this.uploadVoiceNote();
            this._mediaRecorder.start();
            this._recording = true;
            this._recordStart = Date.now();
            const btn = document.getElementById('voiceRecordBtn');
            const label = document.getElementById('voiceRecordLabel');
            const status = document.getElementById('voiceRecordStatus');
            if (btn) btn.style.background = 'var(--accent-red)';
            if (label) label.textContent = 'Stop Recording';
            if (status) status.textContent = 'Recording...';
        } catch (e) {
            if (typeof showNotification !== 'undefined') showNotification('Microphone access denied', 'error');
        }
    },

    stopRecording() {
        if (this._mediaRecorder && this._recording) {
            this._mediaRecorder.stop();
            this._recording = false;
            const btn = document.getElementById('voiceRecordBtn');
            const label = document.getElementById('voiceRecordLabel');
            const status = document.getElementById('voiceRecordStatus');
            if (btn) btn.style.background = '';
            if (label) label.textContent = 'Start Recording';
            if (status) status.textContent = 'Uploading...';
            // Stop all audio tracks
            if (this._mediaRecorder.stream) {
                this._mediaRecorder.stream.getTracks().forEach(t => t.stop());
            }
        }
    },

    async uploadVoiceNote() {
        const worker = document.getElementById('voiceWorkerName')?.value || 'Unknown';
        const tag = document.getElementById('voiceAnimalTag')?.value || '';
        const duration = Math.round((Date.now() - this._recordStart) / 1000);
        const blob = new Blob(this._audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'voice-note.webm');
        formData.append('workerName', worker);
        formData.append('animalTag', tag);
        formData.append('duration', duration);
        try {
            const token = (typeof API_TOKEN !== 'undefined') ? API_TOKEN : null;
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`${this.BACKEND_URL}/api/voice-notes`, { method: 'POST', body: formData, headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            const status = document.getElementById('voiceRecordStatus');
            if (status) status.textContent = '';
            if (typeof showNotification !== 'undefined') showNotification('Voice note saved', 'success');
            this.loadVoiceNotes();
        } catch (e) {
            const status = document.getElementById('voiceRecordStatus');
            if (status) status.textContent = `Error: ${e.message}`;
        }
    },

    async loadVoiceNotes() {
        const el = document.getElementById('voiceNotesList');
        if (!el) return;
        try {
            const notes = await this.fetch('/api/voice-notes');
            if (!notes.length) {
                el.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">No voice notes yet. Record one above.</p>';
                return;
            }
            el.innerHTML = notes.map(n => `
                <div style="display:flex;gap:var(--space-sm);align-items:flex-start;padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:var(--space-xs);flex-wrap:wrap;">
                    <audio controls src="${this.BACKEND_URL}${n.audioUrl}" style="height:32px;flex-shrink:0;max-width:100%;"></audio>
                    <div style="flex:1;min-width:0;font-size:0.78rem;">
                        <div><strong>${n.worker_name}</strong> ${n.animal_tag ? `&middot; ${n.animal_tag}` : ''} <span style="color:var(--text-muted);">${n.duration_sec}s</span></div>
                        <div style="color:var(--text-muted);font-size:0.72rem;">${n.created_at}</div>
                        ${n.transcript ? `<div style="margin-top:2px;color:var(--text-secondary);">"${n.transcript}"</div>` : ''}
                    </div>
                    <button class="btn btn-secondary" style="padding:2px 8px;font-size:0.7rem;flex-shrink:0;" onclick="IntelligenceModule.deleteVoiceNote(${n.id})">Delete</button>
                </div>
            `).join('');
        } catch (e) {
            el.innerHTML = `<p style="color:var(--accent-red);font-size:0.8rem;">${e.message}</p>`;
        }
    },

    async deleteVoiceNote(id) {
        try {
            const token = (typeof API_TOKEN !== 'undefined') ? API_TOKEN : null;
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            await fetch(`${this.BACKEND_URL}/api/voice-notes/${id}`, { method: 'DELETE', headers });
            this.loadVoiceNotes();
        } catch (e) { /* ignore */ }
    },

    // ====================
    // 8. WEIGHT ESTIMATION
    // ====================
    async uploadWeightPhoto() {
        const fileInput = document.getElementById('weightFileInput');
        const tagInput = document.getElementById('weightAnimalTag');
        const resultEl = document.getElementById('weightResult');
        if (!fileInput.files[0]) {
            if (typeof showNotification !== 'undefined') showNotification('Select a photo first', 'info');
            return;
        }
        resultEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Analyzing photo...</p>';
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        formData.append('animalTag', tagInput.value || 'Unknown');
        try {
            const token = (typeof API_TOKEN !== 'undefined') ? API_TOKEN : null;
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`${this.BACKEND_URL}/api/weight-estimate`, { method: 'POST', body: formData, headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Estimation failed');
            const confColor = data.confidence > 0.6 ? 'var(--accent-green)' : data.confidence > 0.4 ? 'var(--accent-amber)' : 'var(--accent-red)';
            resultEl.innerHTML = `
                <div style="padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-md);">
                    <div style="display:flex;gap:var(--space-sm);align-items:center;flex-wrap:wrap;">
                        <img src="${this.BACKEND_URL}${data.visualizationUrl}" alt="Analysis" style="width:140px;height:100px;object-fit:cover;border-radius:var(--radius-sm);flex-shrink:0;max-width:100%;">
                        <div style="flex:1;min-width:0;font-size:0.82rem;">
                            <div style="font-size:1.4rem;font-weight:700;color:var(--accent-green);">${data.estimatedKg} kg</div>
                            <div style="color:var(--text-muted);">Estimated weight for ${data.animalTag}</div>
                            <div style="margin-top:4px;">Body Condition Score: <strong>${data.bodyConditionScore}/9</strong></div>
                            <div style="color:${confColor};font-size:0.75rem;">Confidence: ${Math.round(data.confidence * 100)}%</div>
                            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">${data.note}</div>
                        </div>
                    </div>
                </div>
            `;
            this.loadWeightHistory();
            if (typeof showNotification !== 'undefined') showNotification('Weight estimated', 'success');
        } catch (e) {
            resultEl.innerHTML = `<p style="color:var(--accent-red);font-size:0.8rem;">${e.message}</p>`;
        }
    },

    async loadWeightHistory() {
        const el = document.getElementById('weightHistory');
        if (!el) return;
        try {
            const estimates = await this.fetch('/api/weight-estimates');
            if (!estimates.length) { el.innerHTML = ''; return; }
            el.innerHTML = `
                <h4 style="font-size:0.85rem;margin-bottom:var(--space-sm);">Estimation History</h4>
                ${estimates.slice(0, 5).map(e => `
                    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);font-size:0.78rem;">
                        <span>${e.animal_tag}</span>
                        <span><strong>${e.estimated_kg} kg</strong> (BCS ${e.body_condition_score}/9)</span>
                        <span style="color:var(--text-muted);">${e.created_at.split('T')[0]}</span>
                    </div>
                `).join('')}
            `;
        } catch (e) { el.innerHTML = ''; }
    },

    // ====================
    // 9. THEFT ALERTS
    // ====================
    async loadTheftAlerts() {
        const el = document.getElementById('theftAlertPanel');
        if (!el) return;
        try {
            const alerts = await this.fetch('/api/theft-alerts');
            const active = alerts.filter(a => a.status === 'active');
            const resolved = alerts.filter(a => a.status === 'resolved');
            el.innerHTML = `
                <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-md);flex-wrap:wrap;">
                    <div style="padding:var(--space-sm);background:${active.length ? 'rgba(220,38,38,.08)' : 'var(--bg-tertiary)'};border-radius:var(--radius-md);text-align:center;flex:1;min-width:120px;">
                        <div style="font-size:1.5rem;font-weight:700;color:${active.length ? 'var(--accent-red)' : 'var(--accent-green)'};">${active.length}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">Active Alerts</div>
                    </div>
                    <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);text-align:center;flex:1;min-width:120px;">
                        <div style="font-size:1.5rem;font-weight:700;color:var(--text-muted);">${resolved.length}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">Resolved</div>
                    </div>
                </div>
                <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);flex-wrap:wrap;">
                    <input type="text" id="theftTagInput" placeholder="Cattle tag" style="font-size:0.8rem;padding:6px 10px;border:1px solid var(--border-color);border-radius:var(--radius-sm);flex:1;min-width:0;">
                    <select id="theftAlertType" style="font-size:0.8rem;padding:6px 10px;border:1px solid var(--border-color);border-radius:var(--radius-sm);min-width:0;">
                        <option value="geofence_breach">Geofence Breach</option>
                        <option value="after_hours_movement">After Hours Movement</option>
                        <option value="unauthorized_transport">Unauthorized Transport</option>
                        <option value="camera_detection">Camera Detection</option>
                    </select>
                    <button class="btn btn-primary" style="padding:6px 14px;font-size:0.78rem;flex-shrink:0;" onclick="IntelligenceModule.triggerTheftAlert()">Trigger Alert</button>
                </div>
                ${alerts.length === 0 ? '<p style="color:var(--text-muted);font-size:0.8rem;">No alerts. All cattle within boundaries.</p>' :
                alerts.map(a => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:var(--space-xs);${a.status === 'active' ? 'border-color:var(--accent-red);background:rgba(220,38,38,.04);' : ''}flex-wrap:wrap;gap:4px;">
                        <div style="font-size:0.8rem;flex:1;min-width:0;">
                            <strong>${a.animal_tag}</strong> <span style="color:var(--text-muted);">${a.alert_type.replace(/_/g, ' ')}</span>
                            <div style="font-size:0.72rem;color:var(--text-muted);">${a.details || ''} &middot; ${a.created_at}</div>
                        </div>
                        ${a.status === 'active' ? `<button class="btn btn-secondary" style="padding:3px 10px;font-size:0.72rem;flex-shrink:0;" onclick="IntelligenceModule.resolveTheftAlert(${a.id})">Resolve</button>` : '<span style="font-size:0.72rem;color:var(--text-muted);">Resolved</span>'}
                    </div>
                `).join('')}
            `;
        } catch (e) {
            el.innerHTML = `<p style="color:var(--accent-red);font-size:0.8rem;">${e.message}</p>`;
        }
    },

    async triggerTheftAlert() {
        const tag = document.getElementById('theftTagInput')?.value.trim();
        const type = document.getElementById('theftAlertType')?.value || 'geofence_breach';
        if (!tag) {
            if (typeof showNotification !== 'undefined') showNotification('Enter a cattle tag', 'info');
            return;
        }
        try {
            await this.fetch('/api/theft-alert', { method: 'POST', body: { animalTag: tag, alertType: type, details: `Manual alert: ${type.replace(/_/g, ' ')}` } });
            if (typeof showNotification !== 'undefined') showNotification(`Theft alert triggered for ${tag}`, 'error');
            this.loadTheftAlerts();
        } catch (e) {
            if (typeof showNotification !== 'undefined') showNotification(e.message, 'error');
        }
    },

    async resolveTheftAlert(id) {
        try {
            await this.fetch(`/api/theft-alerts/${id}/resolve`, { method: 'POST' });
            this.loadTheftAlerts();
        } catch (e) { /* ignore */ }
    },

    // ====================
    // 10. PROFITABILITY SIMULATOR
    // ====================
    async runSimulation() {
        const feedTier = document.getElementById('simFeedTier')?.value || 'Basic';
        const months = parseInt(document.getElementById('simMonths')?.value || '6');
        const addCattle = parseInt(document.getElementById('simAddCattle')?.value || '0');
        const resultEl = document.getElementById('simulatorResult');
        resultEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Running simulation...</p>';
        try {
            const data = await this.fetch('/api/simulator/profitability', {
                method: 'POST',
                body: { feedTier, sellInMonths: months, additionalCattle: addCattle }
            });
            const p = data.projections;
            const b = data.baseline;
            const c = data.comparison;
            const verdictColor = c.verdict === 'profitable' ? 'var(--accent-green)' : c.verdict === 'loss' ? 'var(--accent-red)' : 'var(--accent-amber)';
            const verdictText = c.verdict === 'profitable' ? 'More profitable than baseline' : c.verdict === 'loss' ? 'Projected loss' : 'Less profitable than baseline';
            const fmt = n => '₦' + Math.round(n).toLocaleString();
            resultEl.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--space-sm);margin-bottom:var(--space-md);">
                    <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:1.3rem;font-weight:700;color:${p.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmt(p.netProfit)}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">Net Profit (${months}mo)</div>
                    </div>
                    <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:1.3rem;font-weight:700;color:var(--accent-green);">${p.roiPercent}%</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">ROI</div>
                    </div>
                    <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:1.3rem;font-weight:700;">${data.scenario.simulatedHerdSize}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">Simulated Herd</div>
                    </div>
                    <div style="padding:var(--space-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:1.3rem;font-weight:700;color:var(--accent-green);">${fmt(p.appreciatedPricePerHead)}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">Price/Head</div>
                    </div>
                </div>
                <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
                <table class="data-table" style="width:100%;font-size:0.8rem;margin-bottom:var(--space-sm);white-space:nowrap;">
                    <thead><tr><th style="text-align:left;">Metric</th><th>Simulated</th><th>Baseline</th><th>Diff</th></tr></thead>
                    <tbody>
                        <tr><td>Milk Rev</td><td>${fmt(p.milkRevenue)}</td><td>${fmt(b.totalRevenue)}</td><td style="color:${p.milkRevenue >= b.totalRevenue ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmt(p.milkRevenue - b.totalRevenue)}</td></tr>
                        <tr><td>Sale Rev</td><td>${fmt(p.saleRevenue)}</td><td>—</td><td style="color:var(--accent-green);">+${fmt(p.saleRevenue)}</td></tr>
                        <tr><td>Feed Cost</td><td style="color:var(--accent-red);">-${fmt(p.feedCost)}</td><td style="color:var(--accent-red);">-${fmt(b.totalCost - b.netProfit + b.totalRevenue)}</td><td style="color:${p.feedCost < b.totalCost ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmt(p.feedCost - b.totalCost)}</td></tr>
                        <tr><td>Other Cost</td><td style="color:var(--accent-red);">-${fmt(p.otherCost)}</td><td>—</td><td>—</td></tr>
                        <tr style="font-weight:700;"><td>Net Profit</td><td style="color:${p.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmt(p.netProfit)}</td><td style="color:${b.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmt(b.netProfit)}</td><td style="color:${c.profitDifference >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${fmt(c.profitDifference)}</td></tr>
                    </tbody>
                </table>
                </div>
                <div style="padding:var(--space-sm);background:${c.verdict === 'profitable' ? 'rgba(7,80,63,.06)' : 'rgba(220,38,38,.06)'};border-radius:var(--radius-md);font-size:0.82rem;color:${verdictColor};font-weight:600;">
                    ${verdictText} | Profit diff: ${fmt(c.profitDifference)} | ROI diff: ${c.roiDifference}%
                </div>
                <p style="font-size:0.72rem;color:var(--text-muted);margin-top:var(--space-sm);">Assumptions: Milk at ₦250/L, avg sale price ₦250k/head, ${months}-mo simulation with ${feedTier} feed tier. Growth scales with feed tier.</p>
            `;
        } catch (e) {
            resultEl.innerHTML = `<p style="color:var(--accent-red);font-size:0.8rem;">${e.message}</p>`;
        }
    }
};

// Initialize when navigating to the intelligence page
if (typeof window !== 'undefined') {
    window.IntelligenceModule = IntelligenceModule;
}
