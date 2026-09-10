/**
 * Time Chart Component
 * Donut chart for time-allocation breakdowns, rendered on canvas.
 * Sibling of scripts/finance-charts.js (<imago-chart>), trimmed to just the
 * donut mode and formatted in hours instead of currency.
 */

class TimeChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = [];

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; height: 100%; position: relative; overflow: hidden; }
        .chart-container {
          width: 100%; height: 100%;
          display: flex; gap: 20px; align-items: stretch;
          box-sizing: border-box;
        }
        .canvas-wrap { flex: 1.2; position: relative; min-width: 0; height: 100%; }
        canvas { display: block; width: 100%; height: 100%; cursor: crosshair; }
        .legend {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
          justify-content: center;
          overflow-y: auto;
          max-height: 100%;
          padding-left: 16px;
          border-left: 1px solid #e2e0d8;
          min-width: 0;
        }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 11px; padding: 3px 0; }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .legend-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #1a1917; text-transform: capitalize; }
        .legend-val { color: #6b6860; font-size: 10px; white-space: nowrap; }
        .legend-pct { color: #9c9a94; font-size: 10px; font-variant-numeric: tabular-nums; width: 30px; text-align: right; flex-shrink: 0; }
        :host([no-legend]) .legend { display: none; }

        .tooltip {
          position: fixed; background: #1a1917; color: #fff; padding: 6px 10px; border-radius: 6px;
          font-size: 11px; pointer-events: none; z-index: 10000; display: none; max-width: 200px;
          line-height: 1.4; text-align: left; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          font-family: system-ui, -apple-system, sans-serif;
        }
      </style>
      <div class="chart-container">
        <div class="canvas-wrap"><canvas id="canvas"></canvas></div>
        <div id="legend" class="legend"></div>
        <div id="tooltip" class="tooltip"></div>
      </div>
    `;

    this.canvas = this.shadowRoot.getElementById('canvas');
    this.legend = this.shadowRoot.getElementById('legend');
    this.tooltip = this.shadowRoot.getElementById('tooltip');
    this.ctx = this.canvas.getContext('2d');
    this._resizeObserver = new ResizeObserver(() => this.render());
    this._onVisible = () => { if (!document.hidden) this.render(); };
  }

  connectedCallback() {
    this._resizeObserver.observe(this);
    document.addEventListener('visibilitychange', this._onVisible);
    window.addEventListener('pageshow', this._onVisible);
    this.render();
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this._onVisible);
    window.removeEventListener('pageshow', this._onVisible);
  }

  set data(val) { this._data = val || []; this.render(); }
  get data() { return this._data; }

  // Kept in sync with fmtHours() in time.html -- minutes under 1h, hours
  // (+minutes) under 1d, then days (+hours) beyond that.
  _fmtHours(v) {
    v = parseFloat(v) || 0;
    if (v <= 0) return '0h';
    const totalMinutes = Math.round(v * 60);
    if (totalMinutes < 60) return totalMinutes + 'm';
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    if (days > 0) {
      if (days === 1 && hours === 0) return '24h'; // a full single day reads clearer as "24h" than "1d"
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  _drawMessage(text) {
    const ctx = this.ctx;
    const W = this.canvas.width / (window.devicePixelRatio || 1);
    const H = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#9c9a94';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H / 2);
    this.legend.innerHTML = '';
  }

  render() {
    if (!this.isConnected) return;
    const canvasWrap = this.shadowRoot.querySelector('.canvas-wrap');
    const W = canvasWrap.clientWidth;
    const H = canvasWrap.clientHeight;
    if (!W || !H) return;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const slices = (this._data || []).filter(d => d.value > 0);
    if (!slices.length) { this._drawMessage('No data'); return; }
    const total = slices.reduce((s, d) => s + d.value, 0);
    if (total <= 0) { this._drawMessage('No data'); return; }

    const ctx = this.ctx;
    const cx = W / 2, cy = H / 2, R = Math.max(Math.min(cx, cy) - 10, 10), INNER = R * 0.6;
    const GAP = slices.length > 1 ? 0.02 : 0;

    let angle = -Math.PI / 2;
    const calculated = slices.map(d => {
      const sweep = (d.value / total) * (Math.PI * 2 - GAP * slices.length);
      const s = { ...d, start: angle + GAP / 2, sweep };
      angle += sweep + GAP;
      return s;
    });

    ctx.clearRect(0, 0, W, H);
    calculated.forEach(s => {
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
    ctx.fillText(this._fmtHours(total), cx, cy);

    this.legend.innerHTML = calculated.map(s => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${s.color}"></div>
        <div class="legend-label">${s.label}</div>
        <div class="legend-val">${this._fmtHours(s.value)}</div>
        <div class="legend-pct">${(s.value / total * 100).toFixed(0)}%</div>
      </div>
    `).join('');

    this.canvas.onmousemove = e => {
      const r = this.canvas.getBoundingClientRect();
      const mx = e.clientX - r.left - cx;
      const my = e.clientY - r.top - cy;
      const dist = Math.sqrt(mx * mx + my * my);
      if (dist > R || dist < INNER) { this.tooltip.style.display = 'none'; return; }
      let a = Math.atan2(my, mx);
      if (a < -Math.PI / 2) a += Math.PI * 2;
      const s = calculated.find(s => a >= s.start && a <= s.start + s.sweep);
      if (s) {
        this.tooltip.textContent = `${s.label} · ${this._fmtHours(s.value)} (${(s.value / total * 100).toFixed(0)}%)`;
        this.tooltip.style.display = 'block';
        const margin = 8;
        let left = e.clientX + 12;
        if (left + 180 > window.innerWidth - margin) left = e.clientX - 12 - 180;
        this.tooltip.style.left = left + 'px';
        this.tooltip.style.top = (e.clientY + 16) + 'px';
      } else {
        this.tooltip.style.display = 'none';
      }
    };
    this.canvas.onmouseleave = () => { this.tooltip.style.display = 'none'; };
  }
}

customElements.define('time-chart', TimeChart);
