/**
 * Finance Chart Component
 * Encapsulates different financial visualizations using Vanilla Canvas.
 */

class FinanceChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = [];
    this._type = 'line'; 
    
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; height: 100%; position: relative; overflow: hidden; }
        .chart-container { 
          width: 100%; height: 100%; 
          display: flex; gap: 20px; align-items: stretch; 
          box-sizing: border-box;
        }
        .canvas-wrap { flex: 1.5; position: relative; min-width: 0; height: 100%; }
        canvas { display: block; width: 100%; height: 100%; cursor: crosshair; }
        .legend {
          flex: 1;
          display: none;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          max-height: 100%;
          padding-right: 8px;
          border-left: 1px solid #e2e0d8;
          padding-left: 16px;
          min-width: 0;
        }
        :host([has-legend]) .legend { display: flex; }
        
        .legend-group { margin-bottom: 8px; }
        .legend-group-h {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .05em;
          color: #9c9a94;
          border-bottom: 1px solid #e2e0d8;
          padding-bottom: 2px;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          padding: 3px 0;
        }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .legend-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #1a1917; }
        .legend-val { color: #9c9a94; font-family: monospace; font-size: 10px; }
        
        .tooltip {
          position: fixed;
          background: #1a1917;
          color: #fff;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          pointer-events: none;
          z-index: 10000;
          transform: translateX(-50%);
          display: none;
          max-width: 200px;
          line-height: 1.4;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          font-family: system-ui, -apple-system, sans-serif;
        }
      </style>
      <div class="chart-container">
        <div class="canvas-wrap">
          <canvas id="canvas"></canvas>
        </div>
        <div id="legend" class="legend"></div>
        <div id="tooltip" class="tooltip"></div>
      </div>
    `;
    
    this.canvas = this.shadowRoot.getElementById('canvas');
    this.legend = this.shadowRoot.getElementById('legend');
    this.tooltip = this.shadowRoot.getElementById('tooltip');
    this.ctx = this.canvas.getContext('2d');
    
    this._resizeObserver = new ResizeObserver(() => this.render());
  }

  connectedCallback() {
    this._upgradeProperty('data');
    this._resizeObserver.observe(this);
    this.render();
  }

  _upgradeProperty(prop) {
    if (this.hasOwnProperty(prop)) {
      let value = this[prop];
      delete this[prop];
      this[prop] = value;
    }
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect();
  }

  static get observedAttributes() {
    return ['type'];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'type') {
      this._type = newVal;
      this.render();
    }
  }

  set data(val) {
    this._data = val;
    this.render();
  }

  get data() {
    return this._data;
  }

  render() {
    if (!this.isConnected) return;

    // Determine layout: show legend if ANY item in the data array has an 'items' property
    const data = Array.isArray(this._data) ? this._data : (this._data?.groups || []);
    const hasLegend = data.some(d => d.items && d.items.length > 0);
    
    if (hasLegend) {
      this.setAttribute('has-legend', '');
    } else {
      this.removeAttribute('has-legend');
    }

    requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      
      if (W === 0 || H === 0) return;

      this.canvas.width = W * dpr;
      this.canvas.height = H * dpr;
      this.canvas.style.width = W + 'px';
      this.canvas.style.height = H + 'px';
      
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.clearRect(0, 0, W, H);

      if (!data || data.length === 0) {
        this._drawMessage('No data available');
        return;
      }

      try {
        if (this._type === 'line') {
          this._renderLineChart(data, W, H);
        } else if (this._type === 'donut') {
          this._renderDonutChart(data, W, H);
        }
      } catch (e) {
        console.error('Chart render error:', e);
        this._drawMessage('Render Error');
      }
    });
  }

  _drawMessage(msg) {
    const W = this.canvas.width / (window.devicePixelRatio || 1);
    const H = this.canvas.height / (window.devicePixelRatio || 1);
    this.ctx.fillStyle = '#9c9a94';
    this.ctx.font = '13px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(msg, W / 2, H / 2);
    this.legend.innerHTML = '';
  }

  _fmtk(v) {
    if (isNaN(v)) return '0';
    const av = Math.abs(v);
    if (av >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (av >= 1000) return (v / 1000).toFixed(1) + 'k';
    return v.toFixed(0);
  }

  _renderLineChart(history, W, H) {
    if (!Array.isArray(history) || history.length < 2) return;

    const ctx = this.ctx;
    const PAD = { top: 14, right: 16, bottom: 28, left: 50 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    const totals = history.map(h => h.total);
    const dates = history.map(h => h.date);
    const minV = Math.min(...totals);
    const maxV = Math.max(...totals);
    const rng = Math.max(maxV - minV, 1);

    const xOf = i => PAD.left + (i / Math.max(history.length - 1, 1)) * cW;
    const yOf = v => PAD.top + cH - ((v - minV) / rng) * cH;

    ctx.strokeStyle = '#e2e0d8';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#9c9a94';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (cH / 4) * i;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.fillText('₱' + this._fmtk(maxV - (rng / 4) * i), PAD.left - 5, y + 3);
    }

    ctx.beginPath();
    totals.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(0), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
    ctx.lineTo(xOf(totals.length - 1), PAD.top + cH);
    ctx.lineTo(xOf(0), PAD.top + cH);
    ctx.fillStyle = 'rgba(26,107,60,0.07)';
    ctx.fill();

    ctx.beginPath();
    totals.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(0), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
    ctx.strokeStyle = '#1a6b3c';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    totals.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(xOf(i), yOf(v), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#1a6b3c'; ctx.fill();
      ctx.beginPath(); ctx.arc(xOf(i), yOf(v), 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    });

    ctx.fillStyle = '#9c9a94';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    const step = Math.ceil(history.length / 5);
    for (let i = 0; i < history.length; i += step) ctx.fillText(dates[i].slice(5), xOf(i), H - 4);

    this.canvas.onmousemove = e => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let ci = 0, md = Infinity;
      totals.forEach((_, i) => { const d = Math.abs(xOf(i) - mx); if (d < md) { md = d; ci = i; } });
      if (md > 44) { this.tooltip.style.display = 'none'; return; }
      this.tooltip.textContent = dates[ci] + ' · ₱' + this._fmtk(totals[ci]);
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = (rect.left + xOf(ci)) + 'px';
      const py = rect.top + yOf(totals[ci]);
      this.tooltip.style.top = (py - this.tooltip.offsetHeight - 8 < 10) ? (py + 18) + 'px' : (py - this.tooltip.offsetHeight - 8) + 'px';
    };
    this.canvas.onmouseleave = () => { this.tooltip.style.display = 'none'; };
  }

  _renderDonutChart(slices, W, H) {
    if (!Array.isArray(slices) || slices.length === 0) {
      this._drawMessage('No data');
      return;
    }

    const total = slices.reduce((s, d) => s + (d.value || 0), 0);
    if (total <= 0) { this._drawMessage('Zero Balance'); return; }

    const ctx = this.ctx;
    const cx = W / 2, cy = H / 2, R = Math.max(Math.min(cx, cy) - 10, 10), INNER = R * 0.55;
    const GAP = slices.length > 1 ? 0.02 : 0;

    let angle = -Math.PI / 2;
    const calculatedSlices = [];
    slices.forEach(d => {
      const sweep = (d.value / total) * (Math.PI * 2 - GAP * slices.length);
      calculatedSlices.push({ ...d, start: angle + GAP / 2, sweep });
      angle += sweep + GAP;
    });

    calculatedSlices.forEach(s => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, s.start, s.start + s.sweep);
      ctx.closePath();
      ctx.fillStyle = s.color || '#999';
      ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, INNER, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1a1917'; ctx.font = '600 13px system-ui';
    ctx.fillText('₱' + this._fmtk(total), cx, cy - 6);
    ctx.fillStyle = '#9c9a94'; ctx.font = '10px system-ui';
    ctx.fillText('total', cx, cy + 10);

    const hasItems = slices.some(s => s.items && s.items.length > 0);
    if (hasItems) {
      this.legend.innerHTML = slices.map(g => `
        <div class="legend-group">
          <div class="legend-group-h"><span>${g.label}</span><span>₱${this._fmtk(g.value)}</span></div>
          ${(g.items || []).map(item => `
            <div class="legend-item">
              <div class="legend-dot" style="background:${g.color}"></div>
              <div class="legend-label">${item.label}</div>
              <div class="legend-val">₱${this._fmtk(item.value)}</div>
            </div>
          `).join('')}
        </div>
      `).join('');
    } else {
      this.legend.innerHTML = '';
    }

    this.canvas.onmousemove = e => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - cx;
      const my = e.clientY - rect.top - cy;
      const dist = Math.sqrt(mx * mx + my * my);
      if (dist > R || dist < INNER) { this.tooltip.style.display = 'none'; return; }
      let angle = Math.atan2(my, mx);
      if (angle < -Math.PI / 2) angle += Math.PI * 2;
      const s = calculatedSlices.find(s => angle >= s.start && angle <= s.start + s.sweep);
      if (s) {
        this.tooltip.textContent = s.label + ' · ₱' + this._fmtk(s.value) + ' (' + (s.value / total * 100).toFixed(1) + '%)';
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = e.clientX + 'px';
        this.tooltip.style.top = (e.clientY - 30) + 'px';
      } else { this.tooltip.style.display = 'none'; }
    };
    this.canvas.onmouseleave = () => { this.tooltip.style.display = 'none'; };
  }
}

customElements.define('imago-chart', FinanceChart);
