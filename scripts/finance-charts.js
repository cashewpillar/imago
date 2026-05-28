/**
 * Finance Chart Component
 * Encapsulates different financial visualizations using Vanilla Canvas.
 */

class FinanceChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = [];
    this._type = 'line'; // 'line', 'donut'
    this._title = '';
    
    // Create container and canvas
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; height: 100%; position: relative; }
        .chart-container { width: 100%; height: 100%; position: relative; }
        canvas { display: block; width: 100%; height: 100%; cursor: crosshair; }
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
        <canvas id="canvas"></canvas>
        <div id="tooltip" class="tooltip"></div>
      </div>
    `;
    
    this.canvas = this.shadowRoot.getElementById('canvas');
    this.tooltip = this.shadowRoot.getElementById('tooltip');
    this.ctx = this.canvas.getContext('2d');
    
    this._resizeObserver = new ResizeObserver(() => this.render());
  }

  connectedCallback() {
    this._resizeObserver.observe(this);
    this.render();
  }

  disconnectedCallback() {
    this._resizeObserver.unobserve(this);
  }

  static get observedAttributes() {
    return ['type', 'title'];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'type') this._type = newVal;
    if (name === 'title') this._title = newVal;
    this.render();
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
    if (!this._data || this._data.length === 0) {
      this._renderEmpty();
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = this.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    
    if (W === 0 || H === 0) return;

    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    this.ctx.clearRect(0, 0, W, H);

    if (this._type === 'line') {
      this._renderLineChart(W, H);
    } else if (this._type === 'donut') {
      this._renderDonutChart(W, H);
    }
  }

  _renderEmpty() {
    const W = this.canvas.width / (window.devicePixelRatio || 1);
    const H = this.canvas.height / (window.devicePixelRatio || 1);
    this.ctx.clearRect(0, 0, W, H);
    this.ctx.fillStyle = '#9c9a94';
    this.ctx.font = '13px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('No data available', W / 2, H / 2);
  }

  _fmtk(v) {
    const av = Math.abs(v);
    if (av >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (av >= 1000) return (v / 1000).toFixed(1) + 'k';
    return v.toFixed(0);
  }

  _renderLineChart(W, H) {
    const history = this._data;
    const ctx = this.ctx;
    
    const PAD = { top: 14, right: 16, bottom: 28, left: 50 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    const totals = history.map(h => h.total);
    const dates = history.map(h => h.date);
    const minV = Math.min(...totals);
    const maxV = Math.max(...totals);
    const rng = maxV - minV || 1;

    const xOf = i => PAD.left + (i / Math.max(history.length - 1, 1)) * cW;
    const yOf = v => PAD.top + cH - ((v - minV) / rng) * cH;

    // Gridlines + y-axis labels
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

    // Fill
    ctx.beginPath();
    totals.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(0), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
    ctx.lineTo(xOf(totals.length - 1), PAD.top + cH);
    ctx.lineTo(xOf(0), PAD.top + cH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(26,107,60,0.07)';
    ctx.fill();

    // Line
    ctx.beginPath();
    totals.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(0), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
    ctx.strokeStyle = '#1a6b3c';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    totals.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(xOf(i), yOf(v), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#1a6b3c'; ctx.fill();
      ctx.beginPath(); ctx.arc(xOf(i), yOf(v), 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    });

    // X-axis date labels
    ctx.fillStyle = '#9c9a94';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    const labelIdxs = new Set([0, history.length - 1]);
    const step = Math.ceil(history.length / 5);
    for (let i = step; i < history.length - 1; i += step) labelIdxs.add(i);
    labelIdxs.forEach(i => ctx.fillText(dates[i].slice(5), xOf(i), H - 4));

    // Hover Interaction
    this.canvas.onmousemove = e => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let ci = 0, md = Infinity;
      totals.forEach((_, i) => { const d = Math.abs(xOf(i) - mx); if (d < md) { md = d; ci = i; } });
      
      if (md > 44) { this.tooltip.style.display = 'none'; return; }
      
      this.tooltip.textContent = dates[ci] + ' · ₱' + this._fmtk(totals[ci]);
      this.tooltip.style.display = 'block';
      
      const margin = 8;
      const th = this.tooltip.offsetHeight;
      const px = rect.left + xOf(ci);
      const py = rect.top + yOf(totals[ci]);
      
      this.tooltip.style.left = px + 'px';
      if (py - th - margin < 10) {
        this.tooltip.style.top = (py + margin + 10) + 'px';
      } else {
        this.tooltip.style.top = (py - th - margin) + 'px';
      }
    };
    this.canvas.onmouseleave = () => { this.tooltip.style.display = 'none'; };
  }

  _renderDonutChart(W, H) {
    const data = this._data; // [{ label, value, color }]
    const ctx = this.ctx;
    
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total <= 0) { this._renderEmpty(); return; }

    const cx = W / 2, cy = H / 2, R = Math.min(cx, cy) - 10, INNER = R * 0.55;
    const GAP = data.length > 1 ? 0.02 : 0;

    let angle = -Math.PI / 2;
    const slices = [];
    
    data.forEach(d => {
      const sweep = (d.value / total) * (Math.PI * 2 - GAP * data.length);
      slices.push({ ...d, start: angle + GAP / 2, sweep });
      angle += sweep + GAP;
    });

    slices.forEach(s => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, s.start, s.start + s.sweep);
      ctx.closePath();
      ctx.fillStyle = s.color || '#999';
      ctx.fill();
    });

    // Inner hole
    ctx.beginPath();
    ctx.arc(cx, cy, INNER, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; // Ideally this should be dynamic based on surface color
    ctx.fill();

    // Center text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1a1917';
    ctx.font = '600 13px system-ui';
    ctx.fillText('₱' + this._fmtk(total), cx, cy - 6);
    ctx.fillStyle = '#9c9a94';
    ctx.font = '10px system-ui';
    ctx.fillText('total', cx, cy + 10);

    // Hover Interaction
    this.canvas.onmousemove = e => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - cx;
      const my = e.clientY - rect.top - cy;
      const dist = Math.sqrt(mx * mx + my * my);
      
      if (dist > R || dist < INNER) { this.tooltip.style.display = 'none'; return; }
      
      let angle = Math.atan2(my, mx);
      if (angle < -Math.PI / 2) angle += Math.PI * 2;
      
      const s = slices.find(s => angle >= s.start && angle <= s.start + s.sweep);
      if (s) {
        this.tooltip.textContent = s.label + ' · ₱' + this._fmtk(s.value) + ' (' + (s.value / total * 100).toFixed(1) + '%)';
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = e.clientX + 'px';
        this.tooltip.style.top = (e.clientY - 30) + 'px';
      } else {
        this.tooltip.style.display = 'none';
      }
    };
    this.canvas.onmouseleave = () => { this.tooltip.style.display = 'none'; };
  }
}

customElements.define('imago-chart', FinanceChart);
