// ========================================
// BORNE FARMS — Dashboard Customizer
// Drag-to-reorder, resize height, hide/show
// widgets. Layout persisted to localStorage.
// ========================================

const CustomizeModule = {
    active: false,
    STORAGE_KEY: 'borne-dashboard-layout',

    init() {
        this.toggleBtn = document.getElementById('customizeToggle');
        this.resetBtn = document.getElementById('customizeReset');
        this.doneBtn = document.getElementById('customizeDone');
        if (!this.toggleBtn) return;

        this.toggleBtn.addEventListener('click', () => this.toggle());
        this.resetBtn.addEventListener('click', () => this.resetLayout());
        this.doneBtn.addEventListener('click', () => this.toggle());

        this.restoreLayout();
    },

    toggle() {
        this.active = !this.active;
        document.body.classList.toggle('customize-mode', this.active);
        this.toggleBtn.style.display = this.active ? 'none' : '';
        this.resetBtn.style.display = this.active ? '' : 'none';
        this.doneBtn.style.display = this.active ? '' : 'none';

        if (this.active) this.enableCustomize();
        else this.disableCustomize();
    },

    getWidgets() {
        return Array.from(document.querySelectorAll('#dashboardPage > .widget'));
    },

    enableCustomize() {
        this.getWidgets().forEach(w => {
            // Drag handle
            if (!w.querySelector('.widget-drag-handle')) {
                const handle = document.createElement('div');
                handle.className = 'widget-drag-handle';
                handle.innerHTML = '<i data-lucide="grip-vertical"></i> Drag to reorder';
                handle.title = 'Drag to reorder';
                w.prepend(handle);
                handle.draggable = true;
                this.bindDrag(handle, w);
            }

            // Hide button
            if (!w.querySelector('.widget-hide-btn')) {
                const hide = document.createElement('button');
                hide.className = 'widget-hide-btn';
                hide.innerHTML = '<i data-lucide="eye-off"></i>';
                hide.title = 'Hide this section';
                hide.addEventListener('click', () => {
                    w.classList.add('widget-hidden');
                    this.saveLayout();
                });
                w.appendChild(hide);
            }

            // Resize handle
            if (!w.querySelector('.widget-resize-handle')) {
                const resize = document.createElement('div');
                resize.className = 'widget-resize-handle';
                resize.innerHTML = '<i data-lucide="chevrons-up-down"></i>';
                resize.title = 'Drag to resize height';
                this.bindResize(resize, w);
                w.appendChild(resize);
            }

            w.classList.add('widget-editing');
        });

        // Add "show hidden" restore bar
        this.renderHiddenBar();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    disableCustomize() {
        this.getWidgets().forEach(w => {
            w.classList.remove('widget-editing');
            const h = w.querySelector('.widget-drag-handle');
            const r = w.querySelector('.widget-resize-handle');
            const x = w.querySelector('.widget-hide-btn');
            if (h) h.remove();
            if (r) r.remove();
            if (x) x.remove();
        });
        const bar = document.getElementById('widgetHiddenBar');
        if (bar) bar.remove();
        this.saveLayout();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // --- Drag reorder ---
    draggedWidget: null,

    bindDrag(handle, widget) {
        handle.addEventListener('dragstart', (e) => {
            this.draggedWidget = widget;
            widget.classList.add('widget-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        });
        handle.addEventListener('dragend', () => {
            widget.classList.remove('widget-dragging');
            this.draggedWidget = null;
            this.saveLayout();
        });
    },

    bindDropZones() {
        const page = document.getElementById('dashboardPage');
        if (!page) return;
        page.addEventListener('dragover', (e) => {
            if (!this.active || !this.draggedWidget) return;
            e.preventDefault();
            const after = this.getDragAfterElement(page, e.clientY);
            const widgets = this.getWidgets().filter(w => w !== this.draggedWidget);
            if (after == null) {
                page.appendChild(this.draggedWidget);
            } else {
                page.insertBefore(this.draggedWidget, after);
            }
        });
    },

    getDragAfterElement(container, y) {
        const els = this.getWidgets()
            .filter(w => !w.classList.contains('widget-dragging'));
        let closest = { offset: -Infinity, element: null };
        els.forEach(el => {
            const box = el.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                closest = { offset, element: el };
            }
        });
        return closest.element;
    },

    // --- Resize height ---
    bindResize(handle, widget) {
        let startY, startH;
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startY = e.clientY;
            startH = widget.offsetHeight;
            document.body.classList.add('widget-resizing');
            const onMove = (ev) => {
                const newH = Math.max(120, startH + (ev.clientY - startY));
                widget.style.minHeight = newH + 'px';
                widget.style.height = newH + 'px';
                // Invalidate any Leaflet maps inside
                if (typeof GeospatialModule !== 'undefined' && GeospatialModule.miniMap) {
                    setTimeout(() => GeospatialModule.miniMap.invalidateSize(), 50);
                }
            };
            const onUp = () => {
                document.body.classList.remove('widget-resizing');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                this.saveLayout();
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        // Touch support
        handle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            startY = touch.clientY;
            startH = widget.offsetHeight;
            const onMove = (ev) => {
                const t = ev.touches[0];
                const newH = Math.max(120, startH + (t.clientY - startY));
                widget.style.minHeight = newH + 'px';
                widget.style.height = newH + 'px';
            };
            const onEnd = () => {
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onEnd);
                this.saveLayout();
            };
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        }, { passive: false });
    },

    // --- Hidden bar (restore hidden widgets) ---
    renderHiddenBar() {
        let bar = document.getElementById('widgetHiddenBar');
        const hidden = this.getWidgets().filter(w => w.classList.contains('widget-hidden'));
        if (hidden.length === 0) {
            if (bar) bar.remove();
            return;
        }
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'widgetHiddenBar';
            bar.className = 'widget-hidden-bar';
            const page = document.getElementById('dashboardPage');
            page.appendChild(bar);
        }
        bar.innerHTML = '<span class="hidden-bar-label">Hidden sections:</span>';
        hidden.forEach(w => {
            const id = w.dataset.widget;
            const chip = document.createElement('button');
            chip.className = 'hidden-restore-chip';
            chip.innerHTML = `<i data-lucide="eye"></i> ${id}`;
            chip.addEventListener('click', () => {
                w.classList.remove('widget-hidden');
                this.saveLayout();
                this.renderHiddenBar();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
            bar.appendChild(chip);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // --- Persistence ---
    saveLayout() {
        const layout = {};
        this.getWidgets().forEach((w, i) => {
            const id = w.dataset.widget;
            if (!id) return;
            layout[id] = {
                order: i,
                hidden: w.classList.contains('widget-hidden'),
                height: w.style.height || null
            };
        });
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(layout)); }
        catch (e) { console.warn('Could not save layout:', e); }
    },

    restoreLayout() {
        let layout;
        try { layout = JSON.parse(localStorage.getItem(this.STORAGE_KEY)); }
        catch (e) { return; }
        if (!layout) return;

        const page = document.getElementById('dashboardPage');
        if (!page) return;

        // Reorder widgets
        const widgets = this.getWidgets();
        const sorted = widgets.slice().sort((a, b) => {
            const oa = (layout[a.dataset.widget] || {}).order ?? 999;
            const ob = (layout[b.dataset.widget] || {}).order ?? 999;
            return oa - ob;
        });
        sorted.forEach(w => page.appendChild(w));

        // Apply hidden + height
        widgets.forEach(w => {
            const cfg = layout[w.dataset.widget];
            if (!cfg) return;
            if (cfg.hidden) w.classList.add('widget-hidden');
            if (cfg.height) {
                w.style.height = cfg.height;
                w.style.minHeight = cfg.height;
            }
        });

        // Refresh maps after layout restore
        setTimeout(() => {
            if (typeof GeospatialModule !== 'undefined') {
                if (GeospatialModule.miniMap) GeospatialModule.miniMap.invalidateSize();
                if (GeospatialModule.mainMap) GeospatialModule.mainMap.invalidateSize();
            }
        }, 300);
    },

    resetLayout() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.getWidgets().forEach(w => {
            w.classList.remove('widget-hidden');
            w.style.height = '';
            w.style.minHeight = '';
        });
        // Re-enable to refresh UI
        if (this.active) {
            this.disableCustomize();
            this.enableCustomize();
        }
    }
};

// Bind drop zones early
document.addEventListener('DOMContentLoaded', () => {
    CustomizeModule.bindDropZones();
});
