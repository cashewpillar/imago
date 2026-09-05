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
    this.tooltipAnchor = 'top'; // 'top' (centered above cursor) | 'bottom-right' (offset below-right)
    
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

        :host([legend-bottom]) .chart-container { flex-direction: column; gap: 10px; }
        :host([legend-bottom]) .canvas-wrap { flex: 1 1 0; width: 100%; height: auto; min-height: 0; }
        :host([legend-bottom]) .legend {
          flex: 0 0 auto;
          width: 100%;
          flex-direction: row;
          flex-wrap: wrap;
          justify-content: center;
          gap: 6px 20px;
          max-height: none;
          overflow: visible;
          border-left: none;
          border-top: 1px solid #e2e0d8;
          padding-left: 0;
          padding-top: 10px;
        }
        :host([legend-bottom]) .legend-group { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 20px; margin-bottom: 0; }

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
        .legend-item[data-key] { cursor: pointer; user-select: none; }
        .legend-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          box-sizing: border-box;
        }
        .legend-item.hidden .legend-dot { background: transparent !important; border: 1.5px solid var(--dot-color, #9c9a94); }
        .legend-item.hidden .legend-label,
        .legend-item.hidden .legend-val { color: #9c9a94; }
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

    this._hiddenSeries = new Set();
    this._defaultHiddenApplied = new Set();
    this._hasPersistedHiddenSeries = false;
    this.legend.addEventListener('click', e => {
      const item = e.target.closest('.legend-item[data-key]');
      if (!item) return;
      const key = item.dataset.key;
      if (this._hiddenSeries.has(key)) this._hiddenSeries.delete(key);
      else this._hiddenSeries.add(key);
      this._saveHiddenSeries();
      this.render();
    });
  }

  // Persists which legend series are hidden, keyed by this element's id plus
  // the page path (so two charts on different pages reusing the same id
  // never collide). Elements without an id aren't persisted -- give a chart
  // a stable id if its hidden-series choice should survive a reload.
  _hiddenSeriesKey() {
    return this.id ? `imago-chart-hidden::${location.pathname}::${this.id}` : null;
  }
  _loadHiddenSeries() {
    const key = this._hiddenSeriesKey();
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this._hiddenSeries = new Set(parsed);
        this._hasPersistedHiddenSeries = true;
      }
    } catch {}
  }
  _saveHiddenSeries() {
    const key = this._hiddenSeriesKey();
    if (!key) return;
    this._hasPersistedHiddenSeries = true;
    try { localStorage.setItem(key, JSON.stringify([...this._hiddenSeries])); } catch {}
  }

  connectedCallback() {
    this._upgradeProperty('data');
    this._loadHiddenSeries();
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
    // Seed default-hidden series exactly once per label -- keeps the user's
    // own toggle sticky across re-renders instead of re-hiding it every time.
    // Skipped entirely once a persisted hidden-series choice has been loaded
    // or saved, so a user's explicit "show this" isn't clobbered by the
    // default on the next page load.
    if (!this._hasPersistedHiddenSeries) {
      const seriesArr = val && !Array.isArray(val) ? val.series : val;
      (seriesArr || []).forEach((s, si) => {
        if (!s.defaultHidden) return;
        const key = s.label || ('series-' + si);
        if (this._defaultHiddenApplied.has(key)) return;
        this._defaultHiddenApplied.add(key);
        this._hiddenSeries.add(key);
      });
    }
    this.render();
  }

  get data() {
    return this._data;
  }

  render() {
    if (!this.isConnected) return;

    // Multi-series line data: { series: [{label,color,points:[{date,value}]}], unit? }
    const raw = this._data;
    const isMultiSeries = !!(raw && !Array.isArray(raw) && Array.isArray(raw.series));

    // Determine layout: show legend if ANY item in the data array has an 'items' property
    const data = isMultiSeries ? raw.series : (Array.isArray(raw) ? raw : (raw?.groups || []));
    const hasLegend = isMultiSeries ? data.length > 0 : data.some(d => d.items && d.items.length > 0);

    if (hasLegend) {
      this.setAttribute('has-legend', '');
    } else {
      this.removeAttribute('has-legend');
    }

    if (isMultiSeries) {
      this.setAttribute('legend-bottom', '');
    } else {
      this.removeAttribute('legend-bottom');
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
          if (isMultiSeries) {
            this._renderMultiLineChart(data, W, H, raw.unit);
          } else {
            this._renderLineChart(data, W, H);
          }
        } else if (this._type === 'donut') {
          this._renderDonutChart(data, W, H);
        } else if (this._type === 'bar') {
          this._renderBarChart(data, W, H);
        } else if (this._type === 'stacked-bar') {
          this._renderStackedBarChart(data, W, H);
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
    v = parseFloat(v);
    if (isNaN(v)) return '0';
    const av = Math.abs(v);
    if (av >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (av >= 1000) return (v / 1000).toFixed(1) + 'k';
    return v.toFixed(0);
  }

  _renderLineChart(data, W, H) {
    if (!Array.isArray(data) || data.length === 0) return;

    const ctx = this.ctx;
    const PAD = { top: 14, right: 16, bottom: 28, left: 50 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    const values = data.map(d => d.value);
    const dates = data.map(d => d.date);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const rng = Math.max(maxV - minV, 1);

    const xOf = i => {
      if (data.length === 1) return PAD.left + cW / 2;
      return PAD.left + (i / (data.length - 1)) * cW;
    };
    const yOf = v => {
      if (data.length === 1) return PAD.top + cH / 2;
      return PAD.top + cH - ((v - minV) / rng) * cH;
    };

    ctx.strokeStyle = '#e2e0d8';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#9c9a94';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (cH / 4) * i;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      if (data.length > 1) {
        ctx.fillText('₱' + this._fmtk(maxV - (rng / 4) * i), PAD.left - 5, y + 3);
      }
    }

    if (data.length > 1) {
      ctx.beginPath();
      values.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(0), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
      ctx.lineTo(xOf(values.length - 1), PAD.top + cH);
      ctx.lineTo(xOf(0), PAD.top + cH);
      ctx.fillStyle = 'rgba(26,107,60,0.07)';
      ctx.fill();

      ctx.beginPath();
      values.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(0), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
      ctx.strokeStyle = '#1a6b3c';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Use a smaller threshold for mobile screens (narrow canvas width) to avoid clutter
    const threshold = W < 480 ? 15 : 25;

    // Active hovered index to dynamically draw active point
    if (this._hoverIdx === undefined) this._hoverIdx = null;

    values.forEach((v, i) => {
      const isStaticNode = values.length <= threshold || i === 0 || i === values.length - 1;
      const isHovered = this._hoverIdx === i;
      
      if (!isStaticNode && !isHovered) return;
      
      ctx.beginPath(); ctx.arc(xOf(i), yOf(v), isHovered ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = '#1a6b3c'; ctx.fill();
      ctx.beginPath(); ctx.arc(xOf(i), yOf(v), isHovered ? 2 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    });

    ctx.fillStyle = '#9c9a94';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    const step = Math.ceil(data.length / 5);
    for (let i = 0; i < data.length; i += step) {
      const dStr = dates[i] || '';
      ctx.fillText(dStr.length > 5 ? dStr.slice(5) : dStr, xOf(i), H - 4);
    }

    const handlePointer = e => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const mx = clientX - rect.left;
      let ci = null, md = Infinity;
      values.forEach((_, i) => { const d = Math.abs(xOf(i) - mx); if (d < md) { md = d; ci = i; } });
      
      if (md > (data.length === 1 ? 100 : 44)) {
        if (this._hoverIdx !== null) {
          this._hoverIdx = null;
          this.render();
        }
        this.tooltip.style.display = 'none';
        return;
      }
      
      if (this._hoverIdx !== ci) {
        this._hoverIdx = ci;
        this.render();
      }
      
      this.tooltip.textContent = dates[ci] + ' · ₱' + this._fmtk(values[ci]);
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = (rect.left + xOf(ci)) + 'px';
      const py = rect.top + yOf(values[ci]);
      this.tooltip.style.top = (py - this.tooltip.offsetHeight - 8 < 10) ? (py + 18) + 'px' : (py - this.tooltip.offsetHeight - 8) + 'px';
    };

    this.canvas.onmousemove = handlePointer;
    this.canvas.ontouchmove = handlePointer;
    this.canvas.ontouchstart = handlePointer;
    
    const hideTooltip = () => {
      if (this._hoverIdx !== null) {
        this._hoverIdx = null;
        this.render();
      }
      this.tooltip.style.display = 'none';
    };
    
    this.canvas.onmouseleave = hideTooltip;
    this.canvas.ontouchend = hideTooltip;
  }

  _formatVal(v, unit) {
    if (v == null || isNaN(v)) return '—';
    if (unit === '%') return v.toFixed(2) + '%';
    if (unit === 'index') return v.toFixed(1);
    if (unit === 'usd') return '$' + this._fmtk(v);
    return '₱' + this._fmtk(v);
  }

  _fmtMonthLabel(dateStr) {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = String(dateStr || '').split('-');
    if (parts.length < 2) return dateStr || '';
    const idx = parseInt(parts[1], 10) - 1;
    return (MONTHS[idx] || '') + ' ' + parts[0];
  }

  _renderMultiLineChart(seriesArr, W, H, unit) {
    if (!Array.isArray(seriesArr) || seriesArr.length === 0) { this._drawMessage('No data available'); return; }

    const ctx = this.ctx;
    const PAD = { top: 24, right: 16, bottom: 28, left: 50 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;
    const PALETTE = ['#1a6b3c', '#185fa5', '#854f0b', '#a32d2d', '#5f5e5a'];

    const keyOf = (s, si) => s.label || ('series-' + si);
    const isHidden = (s, si) => this._hiddenSeries.has(keyOf(s, si));

    // Legend always lists every series (so a hidden one can be clicked back on),
    // using each series' own last known value regardless of current visibility.
    const allMaps = seriesArr.map(s => {
      const m = new Map();
      (s.points || []).forEach(p => m.set(p.date, p.value));
      return m;
    });
    const allDatesSorted = Array.from(new Set(seriesArr.flatMap(s => (s.points || []).map(p => p.date)))).sort();

    this.legend.innerHTML = `<div class="legend-group">${seriesArr.map((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      const m = allMaps[si];
      let lastVal = null;
      for (let i = allDatesSorted.length - 1; i >= 0; i--) { if (m.has(allDatesSorted[i])) { lastVal = m.get(allDatesSorted[i]); break; } }
      const hidden = isHidden(s, si);
      const key = keyOf(s, si).replace(/"/g, '&quot;');
      return `
        <div class="legend-item${hidden ? ' hidden' : ''}" data-key="${key}" style="--dot-color:${color}">
          <div class="legend-dot" style="${hidden ? '' : `background:${color}`}"></div>
          <div class="legend-label">${s.label || ''}</div>
          <div class="legend-val">${this._formatVal(lastVal, unit)}</div>
        </div>
      `;
    }).join('')}</div>`;

    const plotted = seriesArr
      .map((s, si) => ({ s, color: s.color || PALETTE[si % PALETTE.length], hidden: isHidden(s, si) }))
      .filter(p => !p.hidden);

    if (plotted.length === 0) {
      ctx.fillStyle = '#9c9a94';
      ctx.font = '13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('All series hidden — click the legend to show them', W / 2, H / 2);
      return;
    }

    const dateSet = new Set();
    plotted.forEach(p => (p.s.points || []).forEach(pt => dateSet.add(pt.date)));
    const dates = Array.from(dateSet).sort();

    if (dates.length === 0) {
      ctx.fillStyle = '#9c9a94';
      ctx.font = '13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', W / 2, H / 2);
      return;
    }

    const maps = plotted.map(p => {
      const m = new Map();
      (p.s.points || []).forEach(pt => m.set(pt.date, pt.value));
      return m;
    });

    const allValues = plotted.flatMap(p => (p.s.points || []).map(pt => pt.value));
    const minV = Math.min(...allValues, 0);
    const maxV = Math.max(...allValues, 0.01);
    const rng = Math.max(maxV - minV, 0.01);

    const xOf = i => dates.length === 1 ? PAD.left + cW / 2 : PAD.left + (i / (dates.length - 1)) * cW;
    const yOf = v => PAD.top + cH - ((v - minV) / rng) * cH;

    ctx.strokeStyle = '#e2e0d8';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#9c9a94';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (cH / 4) * i;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      if (dates.length > 1) {
        ctx.fillText(this._formatVal(maxV - (rng / 4) * i, unit), PAD.left - 5, y + 3);
      }
    }

    const threshold = W < 480 ? 15 : 25;
    if (this._hoverIdx === undefined) this._hoverIdx = null;

    plotted.forEach((p, si) => {
      const color = p.color;
      const m = maps[si];

      ctx.beginPath();
      let started = false;
      dates.forEach((d, i) => {
        if (!m.has(d)) { started = false; return; }
        const v = m.get(d);
        if (!started) { ctx.moveTo(xOf(i), yOf(v)); started = true; }
        else ctx.lineTo(xOf(i), yOf(v));
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();

      dates.forEach((d, i) => {
        if (!m.has(d)) return;
        const v = m.get(d);
        const isEdge = i === 0 || i === dates.length - 1;
        const isHovered = this._hoverIdx === i;
        if (dates.length > threshold && !isEdge && !isHovered) return;
        ctx.beginPath(); ctx.arc(xOf(i), yOf(v), isHovered ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.beginPath(); ctx.arc(xOf(i), yOf(v), isHovered ? 2 : 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
      });
    });

    ctx.fillStyle = '#9c9a94';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    const step = Math.ceil(dates.length / 5);
    for (let i = 0; i < dates.length; i += step) {
      ctx.fillText(this._fmtMonthLabel(dates[i]), xOf(i), H - 4);
    }

    // Hover guide: a dashed vertical line at the hovered date, a floating
    // MMM YYYY label above the chart that tracks it (the x-axis labels are
    // too sparse over long periods to tell what month a point falls in), and
    // one pointer-callout tooltip per series (color-matched to its line).
    this.tooltip.style.display = 'none';
    if (this._hoverIdx != null && this._hoverIdx >= 0 && this._hoverIdx < dates.length) {
      const hi = this._hoverIdx;
      const hx = xOf(hi);

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#c8c5bb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, PAD.top);
      ctx.lineTo(hx, PAD.top + cH);
      ctx.stroke();
      ctx.restore();

      this._drawTopDateLabel(ctx, hx, this._fmtMonthLabel(dates[hi]), W);

      const items = [];
      plotted.forEach((p, si) => {
        const v = maps[si].get(dates[hi]);
        if (v == null) return;
        items.push({ py: yOf(v), text: `${p.s.label || ''}: ${this._formatVal(v, unit)}`, color: p.color });
      });
      // 22 must match the boxH used inside _drawCalloutTooltip.
      const tops = this._stackTooltipTops(items.map(it => it.py), 22, PAD.top, PAD.top + cH);
      items.forEach((it, i) => {
        this._drawCalloutTooltip(ctx, hx, it.py, it.text, PAD, cH, W, it.color, tops[i]);
      });
    }

    const handlePointer = e => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const mx = clientX - rect.left;
      let ci = null, md = Infinity;
      dates.forEach((_, i) => { const d = Math.abs(xOf(i) - mx); if (d < md) { md = d; ci = i; } });

      if (md > (dates.length === 1 ? 100 : 44)) {
        if (this._hoverIdx !== null) { this._hoverIdx = null; this.render(); }
        return;
      }

      if (this._hoverIdx !== ci) { this._hoverIdx = ci; this.render(); }
    };

    this.canvas.onmousemove = handlePointer;
    this.canvas.ontouchmove = handlePointer;
    this.canvas.ontouchstart = handlePointer;

    const hideTooltip = () => {
      if (this._hoverIdx !== null) { this._hoverIdx = null; this.render(); }
    };

    this.canvas.onmouseleave = hideTooltip;
    this.canvas.ontouchend = hideTooltip;

    this.canvas.onclick = e => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let ci = null, md = Infinity;
      dates.forEach((_, i) => { const d = Math.abs(xOf(i) - mx); if (d < md) { md = d; ci = i; } });
      if (md > (dates.length === 1 ? 100 : 44)) return;
      this.dispatchEvent(new CustomEvent('point-click', { detail: { date: dates[ci] }, bubbles: true, composed: true }));
    };
  }

  // Resolves overlaps among several tooltip boxes stacked at the same x: sorts
  // by their ideal (unclamped) y, pushes each down to keep a minimum gap from
  // the one above, then shifts the whole stack to fit within [top, bottom] --
  // shifting up first to fix bottom overflow, then down to fix top overflow.
  // Returns box-top positions in the SAME order as the input `centers` array.
  _stackTooltipTops(centers, boxH, top, bottom, minGap = 4) {
    const n = centers.length;
    const order = centers.map((_, i) => i).sort((a, b) => centers[a] - centers[b]);
    const tops = order.map(i => centers[i] - boxH / 2);
    for (let k = 1; k < n; k++) {
      const prevBottom = tops[k - 1] + boxH;
      if (tops[k] < prevBottom + minGap) tops[k] = prevBottom + minGap;
    }
    if (n) {
      const overflowBottom = (tops[n - 1] + boxH) - bottom;
      if (overflowBottom > 0) for (let k = 0; k < n; k++) tops[k] -= overflowBottom;
      const overflowTop = top - tops[0];
      if (overflowTop > 0) for (let k = 0; k < n; k++) tops[k] += overflowTop;
    }
    const result = new Array(n);
    order.forEach((origIdx, k) => { result[origIdx] = tops[k]; });
    return result;
  }

  // Draws a rounded tooltip box (filled with the series' own color) to the
  // LEFT of (px, py), with its pointer base centered on the box's edge. The
  // pointer's tip always stretches to the actual point (px, py) -- so when
  // the box gets placed away from the point's height (near a chart edge, or
  // dodging another tooltip), the pointer becomes a slanted dart reaching
  // down/up to it, instead of a plain gap. Pass `forcedBoxTop` when the
  // caller has already resolved overlaps against sibling tooltips.
  _drawCalloutTooltip(ctx, px, py, text, PAD, cH, W, color, forcedBoxTop) {
    const padX = 8, padY = 5, boxH = 22, gap = 7, pointer = 5, r = 4;
    ctx.font = '11px system-ui';
    const textW = ctx.measureText(text).width;
    const boxW = textW + padX * 2;

    let flip = false;
    let boxRight = px - gap;
    let boxLeft = boxRight - boxW;
    if (boxLeft < PAD.left) {
      flip = true;
      boxLeft = px + gap;
      boxRight = boxLeft + boxW;
      if (boxRight > W - PAD.right) boxRight = W - PAD.right;
      boxLeft = boxRight - boxW;
    }

    let boxTop = forcedBoxTop;
    if (boxTop == null) {
      boxTop = py - boxH / 2;
      boxTop = Math.max(PAD.top, Math.min(boxTop, PAD.top + cH - boxH));
    }
    const boxCenterY = boxTop + boxH / 2;

    ctx.fillStyle = color || '#1a1917';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(boxLeft, boxTop, boxW, boxH, r);
    else ctx.rect(boxLeft, boxTop, boxW, boxH);
    ctx.fill();

    ctx.beginPath();
    if (!flip) {
      ctx.moveTo(boxRight, boxCenterY - pointer);
      ctx.lineTo(px, py);
      ctx.lineTo(boxRight, boxCenterY + pointer);
    } else {
      ctx.moveTo(boxLeft, boxCenterY - pointer);
      ctx.lineTo(px, py);
      ctx.lineTo(boxLeft, boxCenterY + pointer);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, boxLeft + padX, boxCenterY);
    ctx.textBaseline = 'alphabetic';
  }

  // A small floating pill above the plot area, centered on hx, showing the
  // hovered date -- the x-axis's own labels are too sparse over long periods
  // to tell which month a hovered point actually falls in.
  _drawTopDateLabel(ctx, hx, text, W) {
    const padX = 7, h = 16, r = 4;
    ctx.font = '10px system-ui';
    const textW = ctx.measureText(text).width;
    const boxW = textW + padX * 2;
    let boxLeft = hx - boxW / 2;
    boxLeft = Math.max(0, Math.min(boxLeft, W - boxW));
    const boxTop = 2;

    ctx.fillStyle = '#1a1917';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(boxLeft, boxTop, boxW, h, r);
    else ctx.rect(boxLeft, boxTop, boxW, h);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, boxLeft + boxW / 2, boxTop + h / 2);
    ctx.textBaseline = 'alphabetic';
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
        if (this.tooltipAnchor === 'bottom-right') {
          this.tooltip.style.transform = 'none';
          this.tooltip.style.textAlign = 'left';
          this.tooltip.style.left = (e.clientX + 12) + 'px';
          this.tooltip.style.top = (e.clientY + 12) + 'px';
        } else {
          this.tooltip.style.transform = 'translateX(-50%)';
          this.tooltip.style.textAlign = 'center';
          this.tooltip.style.left = e.clientX + 'px';
          this.tooltip.style.top = (e.clientY - 30) + 'px';
        }
      } else { this.tooltip.style.display = 'none'; }
    };
    this.canvas.onmouseleave = () => { this.tooltip.style.display = 'none'; };
  }

  _renderBarChart(items, W, H) {
    if (!Array.isArray(items) || items.length === 0) {
      this._drawMessage('No data');
      return;
    }

    const ctx = this.ctx;
    const PAD = { top: 20, right: 16, bottom: 28, left: 50 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    const maxVal = Math.max(...items.flatMap(d => [d.income || 0, d.expense || 0, d.value || 0]), 100);
    const rng = maxVal * 1.15; // small headroom

    // Y-axis Grid lines & labels
    ctx.strokeStyle = '#e2e0d8';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#9c9a94';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (cH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
      ctx.fillText('₱' + this._fmtk(rng - (rng / 4) * i), PAD.left - 5, y + 3);
    }

    const count = items.length;
    const groupW = cW / count;
    const barWidth = Math.min(Math.max(groupW * 0.28, 12), 40);
    const radius = 3;

    const drawnBars = [];

    items.forEach((item, idx) => {
      const groupX = PAD.left + idx * groupW;
      const midX = groupX + groupW / 2;

      // Group X-axis label
      ctx.fillStyle = '#6b6860';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(item.label || '', midX, H - 8);

      const incomeVal = item.income || (item.type === 'income' ? item.value : 0) || 0;
      const expenseVal = item.expense || (item.type === 'expense' ? item.value : 0) || 0;

      // Draw Income Bar (Green #1a6b3c)
      if (incomeVal > 0) {
        const barH = (incomeVal / rng) * cH;
        const x = midX - barWidth - 2;
        const y = PAD.top + cH - barH;

        ctx.fillStyle = '#1a6b3c';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barH, [radius, radius, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barH);
        }
        ctx.fill();

        drawnBars.push({
          x, y, w: barWidth, h: barH,
          label: `${item.label || ''} Income`,
          value: incomeVal,
          color: '#1a6b3c',
          item
        });
      }

      // Draw Expense Bar (Red #a32d2d)
      if (expenseVal > 0) {
        const barH = (expenseVal / rng) * cH;
        const x = midX + 2;
        const y = PAD.top + cH - barH;

        ctx.fillStyle = '#a32d2d';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barH, [radius, radius, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barH);
        }
        ctx.fill();

        drawnBars.push({
          x, y, w: barWidth, h: barH,
          label: `${item.label || ''} Expenses`,
          value: expenseVal,
          color: '#a32d2d',
          item
        });
      }
    });

    const handlePointer = e => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      const hovered = drawnBars.find(b => mx >= b.x && mx <= b.x + b.w && my >= b.y - 10 && my <= b.y + b.h);

      if (hovered) {
        this.canvas.style.cursor = 'pointer';
        this.tooltip.textContent = `${hovered.label} · ₱${this._fmtk(hovered.value)}`;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (rect.left + hovered.x + hovered.w / 2) + 'px';
        const py = rect.top + hovered.y;
        this.tooltip.style.top = (py - this.tooltip.offsetHeight - 8 < 10) ? (py + hovered.h + 10) + 'px' : (py - this.tooltip.offsetHeight - 8) + 'px';
      } else {
        this.canvas.style.cursor = 'default';
        this.tooltip.style.display = 'none';
      }
    };

    this.canvas.onmousemove = handlePointer;
    this.canvas.ontouchmove = handlePointer;
    this.canvas.ontouchstart = handlePointer;

    this.canvas.onclick = e => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const clickedBar = drawnBars.find(b => mx >= b.x && mx <= b.x + b.w && my >= b.y - 10 && my <= b.y + b.h);
      if (clickedBar) {
        this.tooltip.style.display = 'none';
        this.canvas.style.cursor = 'default';
        this.dispatchEvent(new CustomEvent('bar-click', {
          detail: {
            label: clickedBar.label,
            value: clickedBar.value,
            item: clickedBar.item
          },
          bubbles: true,
          composed: true
        }));
      }
    };

    const hideTooltip = () => {
      this.tooltip.style.display = 'none';
      this.canvas.style.cursor = 'default';
    };
    this.canvas.onmouseleave = hideTooltip;
    this.canvas.ontouchend = hideTooltip;
  }

  // items: [{ label, key, segments: [{ id, name, color, value }] }]
  // One bar per item, segments stacked bottom-to-top. Hover-tooltip only —
  // no click handling, since this chart has no drill-down.
  _renderStackedBarChart(items, W, H) {
    if (!Array.isArray(items) || items.length === 0) {
      this._drawMessage('No data');
      return;
    }

    const ctx = this.ctx;
    const PAD = { top: 20, right: 16, bottom: 28, left: 50 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    const totals = items.map(d => (d.segments || []).reduce((s, seg) => s + (seg.value || 0), 0));
    const maxVal = Math.max(...totals, 100);
    const rng = maxVal * 1.15; // small headroom

    // Y-axis Grid lines & labels
    ctx.strokeStyle = '#e2e0d8';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#9c9a94';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (cH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
      ctx.fillText('₱' + this._fmtk(rng - (rng / 4) * i), PAD.left - 5, y + 3);
    }

    const count = items.length;
    const groupW = cW / count;
    const barWidth = Math.min(Math.max(groupW * 0.5, 14), 56);
    const radius = 3;

    const drawnBars = [];

    items.forEach((item, idx) => {
      const groupX = PAD.left + idx * groupW;
      const midX = groupX + groupW / 2;
      const x = midX - barWidth / 2;

      // Group X-axis label
      ctx.fillStyle = '#6b6860';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(item.label || '', midX, H - 8);

      const segments = (item.segments || []).filter(seg => (seg.value || 0) > 0);
      let cumH = 0;
      segments.forEach((seg, si) => {
        const barH = (seg.value / rng) * cH;
        const y = PAD.top + cH - cumH - barH;
        const isTop = si === segments.length - 1;

        ctx.fillStyle = seg.color || '#9c9a94';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barH, isTop ? [radius, radius, 0, 0] : 0);
        } else {
          ctx.rect(x, y, barWidth, barH);
        }
        ctx.fill();

        drawnBars.push({
          x, y, w: barWidth, h: barH,
          label: `${item.label || ''} · ${seg.name || ''}`,
          value: seg.value,
          color: seg.color,
          item
        });

        cumH += barH;
      });
    });

    const handlePointer = e => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      const hovered = drawnBars.find(b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);

      if (hovered) {
        this.canvas.style.cursor = 'default';
        this.tooltip.textContent = `${hovered.label} · ₱${this._fmtk(hovered.value)}`;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (rect.left + hovered.x + hovered.w / 2) + 'px';
        const py = rect.top + hovered.y;
        this.tooltip.style.top = (py - this.tooltip.offsetHeight - 8 < 10) ? (py + hovered.h + 10) + 'px' : (py - this.tooltip.offsetHeight - 8) + 'px';
      } else {
        this.tooltip.style.display = 'none';
      }
    };

    this.canvas.onmousemove = handlePointer;
    this.canvas.ontouchmove = handlePointer;
    this.canvas.ontouchstart = handlePointer;

    const hideTooltip = () => { this.tooltip.style.display = 'none'; };
    this.canvas.onmouseleave = hideTooltip;
    this.canvas.ontouchend = hideTooltip;
    this.canvas.onclick = null;
  }
}

customElements.define('imago-chart', FinanceChart);
