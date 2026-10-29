/* =========================================================
   Experiment 3 – Sales Analytics Dashboard
   Line + Bar charts with Chart.js, live statistics,
   a linear-regression forecast and an editable dataset.
   ========================================================= */
'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ---------- Step 3: sample dataset ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SAMPLE = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  sales:  [120, 150, 180, 170, 210, 240],
  orders: [50, 60, 75, 68, 85, 95],
};
const MAX_ROWS = 24;
const LIVE_WINDOW = 12;

const clone = (obj) => JSON.parse(JSON.stringify(obj));

let data = clone(SAMPLE);
let range = { from: 0, to: data.labels.length - 1 };
let barMode = 'grouped';
let showForecast = true;
let liveTimer = null;
let colors = {};
let lineChart = null;
let barChart = null;

// ---------- Statistics helpers ----------
const sum = (a) => a.reduce((s, v) => s + v, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const stdDev = (a) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
};
const growth = (a) => (a.length > 1 && a[0] ? ((a[a.length - 1] - a[0]) / a[0]) * 100 : 0);

// Least-squares line y = intercept + slope * x, with x = 0..n-1
function linearRegression(y) {
  const n = y.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(y);
  let num = 0;
  let den = 0;
  y.forEach((v, x) => {
    num += (x - xMean) * (v - yMean);
    den += (x - xMean) ** 2;
  });
  const slope = den ? num / den : 0;
  return { slope, intercept: yMean - slope * xMean };
}

function forecastNext(y) {
  if (y.length < 2) return null;
  const { slope, intercept } = linearRegression(y);
  return Math.max(0, Math.round(intercept + slope * y.length));
}

function pearson(a, b) {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0, da = 0, db = 0;
  a.forEach((v, i) => {
    num += (v - ma) * (b[i] - mb);
    da += (v - ma) ** 2;
    db += (b[i] - mb) ** 2;
  });
  return da && db ? num / Math.sqrt(da * db) : 0;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n, d = 0) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (n, d = 1) => (n > 0 ? '+' : '') + fmt(n, d);

function nextLabel(label) {
  const i = MONTHS.indexOf(label);
  return i === -1 ? `M${data.labels.length + 1}` : MONTHS[(i + 1) % 12];
}

// Current view = rows inside the selected From/To range
function view() {
  const s = range.from;
  const e = range.to + 1;
  return {
    labels: data.labels.slice(s, e),
    sales: data.sales.slice(s, e),
    orders: data.orders.slice(s, e),
  };
}

// ---------- Theme colours (read from CSS variables) ----------
function readColors() {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => css.getPropertyValue(name).trim();
  colors = {
    sales: get('--sales'),
    orders: get('--orders'),
    text: get('--text'),
    muted: get('--muted'),
    grid: get('--grid'),
    surface: get('--surface'),
  };
}

function alpha(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Fills the canvas background so downloaded PNGs are not transparent
const backgroundPlugin = {
  id: 'background',
  beforeDraw(chart) {
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = colors.surface;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};

// ---------- Step 6: shared chart options (titles, legends, tooltips) ----------
function baseOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 600 },
    plugins: {
      title: { display: true, text: title, color: colors.text, font: { size: 14, weight: '700' }, padding: { bottom: 12 } },
      legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
      tooltip: {
        backgroundColor: colors.text,
        titleColor: colors.surface,
        bodyColor: colors.surface,
        padding: 12,
        cornerRadius: 10,
        usePointStyle: true,
        boxPadding: 4,
      },
    },
  };
}

// ---------- Step 4: Line chart – trends over time ----------
function createLineChart() {
  const isForecast = (ds) => ds.label.includes('forecast');
  const salesGradient = (ctx) => {
    const { chart } = ctx;
    const area = chart.chartArea;
    if (!area) return alpha(colors.sales, 0.15);
    const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, alpha(colors.sales, 0.35));
    g.addColorStop(1, alpha(colors.sales, 0));
    return g;
  };

  const opts = baseOptions('Monthly Sales & Orders Trend');
  opts.plugins.legend.labels.filter = (item) => showForecast || !item.text.includes('forecast');
  opts.plugins.tooltip.filter = (item) => {
    if (item.raw == null) return false;
    // show forecast values only on the forecast point itself
    return !isForecast(item.dataset) || item.dataIndex === item.chart.data.labels.length - 1;
  };
  opts.plugins.tooltip.callbacks = {
    label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}`,
  };
  opts.scales = {
    x: { grid: { display: false } },
    y: {
      position: 'left',
      title: { display: true, text: 'Sales', color: colors.sales, font: { weight: '700' } },
      ticks: { color: colors.sales },
    },
    y1: {
      position: 'right',
      grid: { drawOnChartArea: false },
      title: { display: true, text: 'Orders', color: colors.orders, font: { weight: '700' } },
      ticks: { color: colors.orders },
    },
  };

  const point = { pointRadius: 4, pointHoverRadius: 7, pointBorderWidth: 2, pointBackgroundColor: colors.surface };

  return new Chart($('#lineChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Sales', data: [], yAxisID: 'y', borderColor: colors.sales, backgroundColor: salesGradient, fill: true, tension: 0.35, borderWidth: 3, ...point },
        { label: 'Orders', data: [], yAxisID: 'y1', borderColor: colors.orders, backgroundColor: colors.orders, tension: 0.35, borderWidth: 3, ...point },
        { label: 'Sales forecast', data: [], yAxisID: 'y', borderColor: colors.sales, borderDash: [6, 6], borderWidth: 2, pointStyle: 'rectRot', pointRadius: 6, backgroundColor: colors.sales, spanGaps: false },
        { label: 'Orders forecast', data: [], yAxisID: 'y1', borderColor: colors.orders, borderDash: [6, 6], borderWidth: 2, pointStyle: 'rectRot', pointRadius: 6, backgroundColor: colors.orders, spanGaps: false },
      ],
    },
    options: opts,
    plugins: [backgroundPlugin],
  });
}

// ---------- Step 5: Bar chart – compare categories ----------
let bestIndex = -1;

function createBarChart() {
  const horizontal = barMode === 'horizontal';
  const stacked = barMode === 'stacked';
  const valueAxis = horizontal ? 'x' : 'y';
  const catAxis = horizontal ? 'y' : 'x';

  const opts = baseOptions('Sales vs Orders by Month');
  opts.indexAxis = horizontal ? 'y' : 'x';
  opts.plugins.tooltip.callbacks = {
    label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}`,
    footer: (items) => {
      const s = items.find((i) => i.dataset.label === 'Sales');
      const o = items.find((i) => i.dataset.label === 'Orders');
      return s && o && o.raw ? `Sales per order: ${fmt(s.raw / o.raw, 2)}` : '';
    },
  };
  opts.scales = {
    [catAxis]: { stacked, grid: { display: false } },
    [valueAxis]: { stacked, beginAtZero: true },
  };

  return new Chart($('#barChart'), {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Sales',
          data: [],
          backgroundColor: (ctx) => (ctx.dataIndex === bestIndex ? colors.sales : alpha(colors.sales, 0.55)),
          hoverBackgroundColor: colors.sales,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Orders',
          data: [],
          backgroundColor: alpha(colors.orders, 0.75),
          hoverBackgroundColor: colors.orders,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: opts,
    plugins: [backgroundPlugin],
  });
}

function buildCharts() {
  readColors();
  Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
  Chart.defaults.color = colors.muted;
  Chart.defaults.borderColor = colors.grid;
  if (lineChart) lineChart.destroy();
  if (barChart) barChart.destroy();
  lineChart = createLineChart();
  barChart = createBarChart();
  updateAll();
}

// ---------- Update everything from the current data ----------
function updateCharts(v) {
  const n = v.labels.length;
  bestIndex = v.sales.indexOf(Math.max(...v.sales));

  // Line chart (+ optional forecast point)
  const labels = [...v.labels];
  const sales = [...v.sales];
  const orders = [...v.orders];
  let salesF = [];
  let ordersF = [];
  if (showForecast && n >= 2) {
    labels.push(`${nextLabel(v.labels[n - 1])} (f)`);
    sales.push(null);
    orders.push(null);
    const pad = Array(n - 1).fill(null);
    salesF = [...pad, v.sales[n - 1], forecastNext(v.sales)];
    ordersF = [...pad, v.orders[n - 1], forecastNext(v.orders)];
  }
  lineChart.data.labels = labels;
  lineChart.data.datasets[0].data = sales;
  lineChart.data.datasets[1].data = orders;
  lineChart.data.datasets[2].data = salesF;
  lineChart.data.datasets[3].data = ordersF;
  lineChart.update();

  // Bar chart
  barChart.data.labels = v.labels;
  barChart.data.datasets[0].data = v.sales;
  barChart.data.datasets[1].data = v.orders;
  barChart.update();
}

// Smoothly count numbers up/down
function animateNumber(el, to, decimals = 0, suffix = '') {
  const from = parseFloat(el.dataset.value || 0);
  el.dataset.value = to;
  const start = performance.now();
  const dur = 600;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = fmt(from + (to - from) * eased, decimals) + suffix;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateKPIs(v) {
  const n = v.labels.length;
  const g = growth(v.sales);
  const best = v.sales.indexOf(Math.max(...v.sales));
  const fSales = forecastNext(v.sales);
  const fOrders = forecastNext(v.orders);

  animateNumber($('#kpiSales'), sum(v.sales));
  $('#kpiSalesSub').textContent = `avg ${fmt(mean(v.sales), 1)} per month`;

  animateNumber($('#kpiOrders'), sum(v.orders));
  $('#kpiOrdersSub').textContent = `${fmt(sum(v.sales) / (sum(v.orders) || 1), 2)} sales per order`;

  const growthEl = $('#kpiGrowth');
  animateNumber(growthEl, g, 1, '%');
  growthEl.className = 'kpi-value ' + (g >= 0 ? 'up' : 'down');
  $('#kpiGrowthSub').textContent = `${v.labels[0]} → ${v.labels[n - 1]} (${g >= 0 ? '▲' : '▼'} ${fmt(Math.abs(v.sales[n - 1] - v.sales[0]))})`;

  $('#kpiBest').textContent = v.labels[best];
  $('#kpiBestSub').textContent = `${fmt(v.sales[best])} sales · ${fmt(v.orders[best])} orders`;

  if (fSales == null) {
    $('#kpiForecast').textContent = '—';
    $('#kpiForecastSub').textContent = 'Need at least 2 months';
  } else {
    animateNumber($('#kpiForecast'), fSales);
    $('#kpiForecastSub').textContent = `${nextLabel(v.labels[n - 1])} · ≈ ${fmt(fOrders)} orders (linear trend)`;
  }
}

function updateStatsTable(v) {
  const rows = [
    ['Count', v.sales.length, v.orders.length, 0],
    ['Total', sum(v.sales), sum(v.orders), 0],
    ['Mean', mean(v.sales), mean(v.orders), 1],
    ['Median', median(v.sales), median(v.orders), 1],
    ['Minimum', Math.min(...v.sales), Math.min(...v.orders), 0],
    ['Maximum', Math.max(...v.sales), Math.max(...v.orders), 0],
    ['Range', Math.max(...v.sales) - Math.min(...v.sales), Math.max(...v.orders) - Math.min(...v.orders), 0],
    ['Std. deviation', stdDev(v.sales), stdDev(v.orders), 1],
  ];
  const tbody = $('#statsTable tbody');
  tbody.innerHTML = '';
  rows.forEach(([label, s, o, d]) => {
    const tr = document.createElement('tr');
    [label, fmt(s, d), fmt(o, d)].forEach((text) => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    });
    tbody.append(tr);
  });
  const gs = growth(v.sales);
  const go = growth(v.orders);
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>Growth</td><td class="${gs >= 0 ? 'up' : 'down'}">${signed(gs)}%</td><td class="${go >= 0 ? 'up' : 'down'}">${signed(go)}%</td>`;
  tbody.append(tr);
}

function updateInsights(v) {
  const list = $('#insights');
  list.innerHTML = '';
  const add = (icon, html) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="ico">${icon}</span><span>${html}</span>`;
    list.append(li);
  };

  if (v.labels.length < 2) {
    add('ℹ️', 'Select at least two months to generate insights.');
    return;
  }

  const { slope } = linearRegression(v.sales);
  add(slope >= 0 ? '📈' : '📉',
    `Sales trend is <b>${slope >= 0 ? 'upward' : 'downward'}</b>, changing by about <b>${signed(slope, 1)}</b> per month.`);

  const r = pearson(v.sales, v.orders);
  const strength = Math.abs(r) > 0.8 ? 'very strong' : Math.abs(r) > 0.5 ? 'moderate' : 'weak';
  add('🔗', `Sales and orders have a <b>${strength}</b> ${r >= 0 ? 'positive' : 'negative'} correlation (r = <b>${r.toFixed(2)}</b>).`);

  // month-over-month changes
  const mom = v.sales.slice(1).map((s, i) => ({ label: escapeHtml(v.labels[i + 1]), pct: ((s - v.sales[i]) / v.sales[i]) * 100 }));
  const bestJump = mom.reduce((a, b) => (b.pct > a.pct ? b : a));
  add('🚀', `Biggest month-over-month jump: <b>${bestJump.label}</b> (${signed(bestJump.pct)}%).`);

  const dips = mom.filter((m) => m.pct < 0);
  if (dips.length) {
    const worst = dips.reduce((a, b) => (b.pct < a.pct ? b : a));
    add('⚠️', `${dips.length} month(s) declined. Largest dip: <b>${worst.label}</b> (${signed(worst.pct)}%).`);
  } else {
    add('✅', 'No month-over-month declines in sales for this period.');
  }

  const cv = (stdDev(v.sales) / mean(v.sales)) * 100;
  add('🎯', `Sales variability (coefficient of variation) is <b>${fmt(cv, 1)}%</b> — ${cv < 15 ? 'quite stable' : cv < 30 ? 'moderately variable' : 'highly variable'}.`);
}

function updateDataTable(newIndex = -1) {
  const tbody = $('#dataTable tbody');
  tbody.innerHTML = '';
  const v = view();
  const bestGlobal = range.from + v.sales.indexOf(Math.max(...v.sales));

  data.labels.forEach((label, i) => {
    const tr = document.createElement('tr');
    if (i < range.from || i > range.to) tr.classList.add('out');
    if (i === bestGlobal) tr.classList.add('best');
    if (i === newIndex) tr.classList.add('new');

    [label, fmt(data.sales[i]), fmt(data.orders[i]), fmt(data.sales[i] / data.orders[i], 2)].forEach((text) => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    });

    const td = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'del-btn';
    btn.type = 'button';
    btn.title = `Remove ${label}`;
    btn.setAttribute('aria-label', `Remove ${label}`);
    btn.textContent = '✕';
    btn.addEventListener('click', () => removeRow(i));
    td.append(btn);
    tr.append(td);
    tbody.append(tr);
  });

  $('#rowCount').textContent = `${data.labels.length} rows`;
}

function populateRangeSelects() {
  const fill = (sel, value) => {
    sel.innerHTML = '';
    data.labels.forEach((label, i) => sel.add(new Option(`${label} (${i + 1})`, i)));
    sel.value = value;
  };
  fill($('#fromSel'), range.from);
  fill($('#toSel'), range.to);
}

function updateAll(newIndex = -1) {
  const v = view();
  updateCharts(v);
  updateKPIs(v);
  updateStatsTable(v);
  updateInsights(v);
  updateDataTable(newIndex);
}

// ---------- Data editing ----------
function resetRangeToAll() {
  range = { from: 0, to: data.labels.length - 1 };
  populateRangeSelects();
}

function addRow(label, sales, orders) {
  data.labels.push(label);
  data.sales.push(sales);
  data.orders.push(orders);
  resetRangeToAll();
  updateAll(data.labels.length - 1);
}

function removeRow(i) {
  if (data.labels.length <= 2) {
    showFormMsg('At least two months are required.', 'error');
    return;
  }
  const label = data.labels[i];
  data.labels.splice(i, 1);
  data.sales.splice(i, 1);
  data.orders.splice(i, 1);
  resetRangeToAll();
  updateAll();
  showFormMsg(`Removed ${label}.`, 'ok');
}

function showFormMsg(text, type = '') {
  const el = $('#formMsg');
  el.textContent = text;
  el.className = 'form-msg ' + type;
}

function suggestNextMonth() {
  $('#addMonth').placeholder = `Month (e.g. ${nextLabel(data.labels[data.labels.length - 1])})`;
}

$('#addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const monthEl = $('#addMonth');
  const salesEl = $('#addSales');
  const ordersEl = $('#addOrders');
  [monthEl, salesEl, ordersEl].forEach((el) => el.classList.remove('invalid'));

  const month = monthEl.value.trim() || nextLabel(data.labels[data.labels.length - 1]);
  const sales = Number(salesEl.value);
  const orders = Number(ordersEl.value);

  let error = '';
  if (data.labels.length >= MAX_ROWS) error = `Maximum of ${MAX_ROWS} rows reached.`;
  else if (!salesEl.value || !Number.isFinite(sales) || sales <= 0) { error = 'Sales must be a positive number.'; salesEl.classList.add('invalid'); }
  else if (!ordersEl.value || !Number.isInteger(orders) || orders <= 0) { error = 'Orders must be a positive whole number.'; ordersEl.classList.add('invalid'); }
  else if (data.labels.includes(month)) { error = `"${month}" already exists – use a different label.`; monthEl.classList.add('invalid'); }

  if (error) { showFormMsg(error, 'error'); return; }

  addRow(month, sales, orders);
  showFormMsg(`Added ${month}: ${fmt(sales)} sales, ${fmt(orders)} orders.`, 'ok');
  e.target.reset();
  suggestNextMonth();
  monthEl.focus();
});

// ---------- Live data simulation ----------
function liveTick() {
  const n = data.labels.length;
  const lastSales = data.sales[n - 1];
  const ratio = lastSales / data.orders[n - 1];
  const sales = Math.max(40, Math.round(lastSales * (1 + (Math.random() * 0.2 - 0.08))));
  const orders = Math.max(10, Math.round((sales / ratio) * (1 + (Math.random() * 0.1 - 0.05))));
  const label = nextLabel(data.labels[n - 1]);
  if (data.labels.includes(label)) {
    // remove the old entry with the same name to keep labels unique
    const old = data.labels.indexOf(label);
    data.labels.splice(old, 1);
    data.sales.splice(old, 1);
    data.orders.splice(old, 1);
  }
  data.labels.push(label);
  data.sales.push(sales);
  data.orders.push(orders);
  while (data.labels.length > LIVE_WINDOW) {
    data.labels.shift();
    data.sales.shift();
    data.orders.shift();
  }
  resetRangeToAll();
  updateAll(data.labels.length - 1);
  suggestNextMonth();
}

function setLive(on) {
  const btn = $('#liveBtn');
  clearInterval(liveTimer);
  liveTimer = on ? setInterval(liveTick, 2000) : null;
  btn.setAttribute('aria-pressed', on);
  btn.textContent = on ? '⏸ Pause live' : '▶ Simulate live data';
}

$('#liveBtn').addEventListener('click', () => setLive(!liveTimer));

// ---------- Controls ----------
$('#fromSel').addEventListener('change', (e) => {
  range.from = Number(e.target.value);
  if (range.from > range.to) { range.to = range.from; $('#toSel').value = range.to; }
  updateAll();
});

$('#toSel').addEventListener('change', (e) => {
  range.to = Number(e.target.value);
  if (range.to < range.from) { range.from = range.to; $('#fromSel').value = range.from; }
  updateAll();
});

$$('.segmented button').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.segmented button').forEach((b) => b.classList.toggle('active', b === btn));
    barMode = btn.dataset.mode;
    barChart.destroy();
    barChart = createBarChart();
    updateCharts(view());
  });
});

$('#forecastToggle').addEventListener('change', (e) => {
  showForecast = e.target.checked;
  updateCharts(view());
});

$('#resetBtn').addEventListener('click', () => {
  setLive(false);
  data = clone(SAMPLE);
  resetRangeToAll();
  updateAll();
  suggestNextMonth();
  showFormMsg('Dataset reset to the original sample.', 'ok');
});

$$('[data-download]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const chart = btn.dataset.download === 'lineChart' ? lineChart : barChart;
    const a = document.createElement('a');
    a.href = chart.toBase64Image('image/png', 1);
    a.download = `${btn.dataset.download}.png`;
    a.click();
  });
});

// ---------- Theme ----------
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  try { localStorage.setItem('exp3-theme', theme); } catch (e) { /* storage unavailable */ }
}

$('#themeToggle').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  buildCharts();
});

// ---------- Step 7: responsiveness helper ----------
function updateViewport() {
  const w = window.innerWidth;
  const device = w < 600 ? 'Mobile' : w < 1024 ? 'Tablet' : 'Desktop';
  $('#viewport').textContent = `${device} · ${w}px`;
}
window.addEventListener('resize', updateViewport);

// ---------- Init ----------
(function init() {
  if (typeof Chart === 'undefined') {
    document.querySelector('.charts').innerHTML =
      '<p class="panel">Chart.js could not be loaded. Please check your internet connection and refresh.</p>';
    return;
  }
  let theme = null;
  try { theme = localStorage.getItem('exp3-theme'); } catch (e) { /* ignore */ }
  if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(theme);
  populateRangeSelects();
  suggestNextMonth();
  updateViewport();
  buildCharts();
})();
