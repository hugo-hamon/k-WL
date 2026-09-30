// Matrices are explored by ordinary scrolling. Only visible cells are fetched.
export class FWLPanel {
    constructor(visualizer) {
        this.owner = visualizer;
        this.root = document.getElementById('fwl-panel');
        this.request = 0;
        this.summary = null;
        this.views = [];
    }

    reset() {
        this.request++;
        this.views.forEach(view => view.destroy());
        this.views = [];
        this.summary = null;
        this.root.replaceChildren();
        this.owner.highlightPair(null);
    }

    async update(summary) {
        this.reset();
        this.summary = summary;
        this.root.hidden = false;
        const pending = [];
        summary.graphs.forEach((graph, index) => {
            const section = document.createElement('section');
            section.className = 'fwl-graph';
            section.dataset.graph = index;
            const heading = document.createElement('h3');
            heading.textContent = `Graphe ${index + 1}`;
            section.append(heading);
            this.root.append(section);
            if (!graph.size) {
                const empty = document.createElement('p');
                empty.textContent = 'Graphe vide';
                section.append(empty);
                return;
            }
            for (const previous of summary.iteration > 0 ? [true, false] : [false]) {
                const title = document.createElement('h4');
                title.textContent = previous ? `Avant · itération ${summary.iteration - 1}` : `État actuel · itération ${summary.iteration}`;
                section.append(title);
                const view = new MatrixView(this, index, graph.size, previous, title.textContent);
                section.append(view.scroll);
                this.views.push(view);
                pending.push(view.load());
            }
        });
        await Promise.all(pending);
    }
}

class MatrixView {
    constructor(panel, graph, size, previous, title) {
        Object.assign(this, { panel, graph, size, previous, title });
        this.generation = panel.request;
        this.cell = 29;
        this.token = 0;
        this.data = null;
        this.selected = null;
        this.frame = null;
        this.scroll = document.createElement('div');
        this.scroll.className = 'matrix-scroll';
        const extent = (size + 1) * this.cell;
        this.scroll.style.width = `${extent + 2}px`;
        this.scroll.style.height = `${Math.min(extent + 2, 480)}px`;
        const spacer = document.createElement('div');
        spacer.className = 'matrix-spacer';
        spacer.style.width = `${extent}px`;
        spacer.style.height = `${extent}px`;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'color-matrix';
        this.canvas.tabIndex = 0;
        this.canvas.setAttribute('role', 'img');
        this.canvas.setAttribute('aria-label', `Graphe ${graph + 1}, ${title}. Matrice de ${size} par ${size}. Utilisez les flèches pour parcourir les cases.`);
        spacer.append(this.canvas);
        this.scroll.append(spacer);
        this.scroll.addEventListener('scroll', () => {
            this.panel.owner.highlightPair(null);
            this.selected = null;
            this.canvas.title = '';
            this.draw();
            if (this.frame !== null) cancelAnimationFrame(this.frame);
            this.frame = requestAnimationFrame(() => { this.frame = null; this.load(); });
        });
        this.canvas.addEventListener('pointermove', event => {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left, y = event.clientY - rect.top;
            if (x < this.cell || y < this.cell) return this.clearSelection();
            this.select(Math.floor((y - this.cell + this.scroll.scrollTop) / this.cell),
                        Math.floor((x - this.cell + this.scroll.scrollLeft) / this.cell));
        });
        this.canvas.addEventListener('pointerleave', () => this.clearSelection());
        this.canvas.addEventListener('blur', () => this.clearSelection());
        this.canvas.addEventListener('focus', () => this.select(this.row || 0, this.column || 0));
        this.canvas.addEventListener('keydown', async event => {
            const offsets = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
            if (!offsets[event.key]) return;
            event.preventDefault();
            const [di, dj] = offsets[event.key];
            const [i, j] = this.selected || [this.row || 0, this.column || 0];
            const row = Math.max(0, Math.min(this.size - 1, i + di));
            const column = Math.max(0, Math.min(this.size - 1, j + dj));
            const ensureVisible = (index, offset, length) => {
                const position = index * this.cell;
                if (position < offset) return position;
                if (position + 2 * this.cell > offset + length) return position + 2 * this.cell - length;
                return offset;
            };
            this.scroll.scrollTop = ensureVisible(row, this.scroll.scrollTop, this.scroll.clientHeight);
            this.scroll.scrollLeft = ensureVisible(column, this.scroll.scrollLeft, this.scroll.clientWidth);
            await this.load();
            this.select(row, column);
        });
        this.observer = new ResizeObserver(() => this.draw());
        this.observer.observe(this.scroll);
    }

    destroy() {
        this.token++;
        this.observer.disconnect();
        if (this.frame !== null) cancelAnimationFrame(this.frame);
    }

    async load() {
        const row = Math.floor(this.scroll.scrollTop / this.cell);
        const column = Math.floor(this.scroll.scrollLeft / this.cell);
        const token = ++this.token;
        if (this.data && row === this.row && column === this.column) { this.draw(); return; }
        try {
            const data = await eel.eel_fwl2_window(this.graph, row, column, 40)();
            if (token !== this.token || this.generation !== this.panel.request) return;
            if (data.error) throw new Error(data.error);
            this.row = row; this.column = column; this.data = data;
            this.draw();
        } catch (error) {
            if (token !== this.token || this.generation !== this.panel.request) return;
            this.scroll.textContent = error.message || String(error);
        }
    }

    clearSelection() {
        this.selected = null;
        this.canvas.title = '';
        this.panel.owner.highlightPair(null);
        this.draw();
    }

    select(row, column) {
        if (!this.data || row < 0 || column < 0 || row >= this.size || column >= this.size) return this.clearSelection();
        const i = row - this.row, j = column - this.column;
        const colors = this.previous ? this.data.previous : this.data.current;
        if (!colors?.[i] || j < 0 || j >= colors[i].length) return this.clearSelection();
        this.selected = [row, column];
        const u = this.data.rows[i], v = this.data.columns[j], color = colors[i][j];
        const kind = color === null ? 'composantes différentes' : u.id === v.id ? 'diagonale' : this.data.edges[i][j] ? 'arête' : 'non-arête';
        const label = `G${this.graph + 1} · (${u.label}, ${v.label}) · ${kind} · couleur ${color ?? '—'} · ${this.title}`;
        this.canvas.title = label;
        this.canvas.setAttribute('aria-label', label);
        this.panel.owner.highlightPair(color === null ? null : [u.id, v.id]);
        this.draw();
    }

    draw() {
        const width = this.scroll.clientWidth, height = this.scroll.clientHeight;
        if (!width || !height) return;
        const ratio = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(width * ratio);
        this.canvas.height = Math.round(height * ratio);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        const ctx = this.canvas.getContext('2d');
        ctx.scale(ratio, ratio);
        ctx.fillStyle = '#f9f9f9'; ctx.fillRect(0, 0, width, height);
        if (!this.data) return;
        const colors = this.previous ? this.data.previous : this.data.current;
        if (!colors) return;
        const cell = this.cell, xOffset = this.scroll.scrollLeft, yOffset = this.scroll.scrollTop;
        const paint = (x, y, text, fill, bold = false) => {
            ctx.fillStyle = fill; ctx.fillRect(x, y, cell - 1, cell - 1);
            ctx.fillStyle = '#222'; ctx.font = `${bold ? 'bold ' : ''}11px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(text), x + cell / 2, y + cell / 2, cell - 4);
        };
        ctx.save(); ctx.beginPath(); ctx.rect(cell, cell, width - cell, height - cell); ctx.clip();
        colors.forEach((row, i) => row.forEach((color, j) => {
            const x = (this.column + j + 1) * cell - xOffset;
            const y = (this.row + i + 1) * cell - yOffset;
            if (x + cell < cell || y + cell < cell || x > width || y > height) return;
            paint(x, y, color ?? '—', color === null ? '#eee' : this.panel.owner.getIntColor(color));
            if (this.selected?.[0] === this.row + i && this.selected?.[1] === this.column + j) {
                ctx.strokeStyle = '#174bb3'; ctx.lineWidth = 3; ctx.strokeRect(x + 1, y + 1, cell - 3, cell - 3);
            }
        }));
        ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(cell, 0, width - cell, cell); ctx.clip();
        this.data.columns.forEach((node, j) => paint((this.column + j + 1) * cell - xOffset, 0, node.label, '#eee', true));
        ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(0, cell, cell, height - cell); ctx.clip();
        this.data.rows.forEach((node, i) => paint(0, (this.row + i + 1) * cell - yOffset, node.label, '#eee', true));
        ctx.restore();
        paint(0, 0, 'u / v', '#eee', true);
    }
}
