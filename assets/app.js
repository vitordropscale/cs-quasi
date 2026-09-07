/* Partida: carrega os dados, liga os filtros, chama os renderizadores.

   Nada aqui calcula métrica e nada aqui busca arquivo. Ele só decide o que
   mostrar e passa adiante o objeto que data.js devolveu. */

import { loadData } from './data.js';
import { buildPeriods } from './metrics.js';
import { wireCharts, fmtRange, fmtStamp, fmtDay, esc } from './charts.js';

import { renderOverview } from './views/overview.js';
import { renderOperation } from './views/operation.js';
import { renderChargebacks } from './views/chargebacks.js';
import { renderPlans } from './views/plans.js';
import { renderSources } from './views/sources.js';

const VIEWS = {
  overview: {
    title: 'This week',
    render: renderOverview,
    sub: (s) => `Quasi support, ${fmtRange(s.window.from, s.window.to)}` +
      (s.period.compare ? `, against the ${s.period.compare.label}.` : '.'),
  },
  operation: {
    title: 'Operations',
    render: renderOperation,
    sub: () => 'Where the queue stands right now and who is holding what. Internal view.',
  },
  chargebacks: {
    title: 'Chargebacks',
    render: renderChargebacks,
    sub: (s) => `Disputes opened ${fmtRange(s.window.from, s.window.to)}, and where every case stands today.`,
  },
  plans: {
    title: 'Action plans',
    render: renderPlans,
    sub: () => 'What we committed to fixing, and the number each plan will be judged by.',
  },
  sources: {
    title: 'Where the numbers come from',
    render: renderSources,
    sub: () => 'What each metric measures, how it is computed, and what changes when the data goes live.',
  },
};

const $ = (sel) => document.querySelector(sel);

const state = { view: 'overview', periodId: 'current', reason: null, period: null, window: null };
let data = null;

/* ---------------------------------------------------------------- boot -- */

(async function start() {
  try {
    data = await loadData();
  } catch (err) {
    fail(err);
    return;
  }

  state.periods = buildPeriods(data.meta);
  applyPeriod(state.periodId);

  fillPeriodFilter();
  fillReasonFilter();
  fillRailMeta();
  showWarnings(data.warnings);

  $('#filter-period').addEventListener('change', (e) => {
    applyPeriod(e.target.value);
    render();
  });
  $('#filter-reason').addEventListener('change', (e) => {
    state.reason = e.target.value || null;
    render();
  });

  document.querySelectorAll('.navitem').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.dataset.view));
  });

  addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if (VIEWS[v] && v !== state.view) go(v, { silent: true });
  });

  const initial = location.hash.slice(1);
  if (VIEWS[initial]) state.view = initial;

  $('#loading').remove();
  render();
})();

/* ------------------------------------------------------------- filtros -- */

function applyPeriod(id) {
  state.periodId = id;
  state.period = state.periods.find((p) => p.id === id) ?? state.periods[0];
  state.window = { from: state.period.from, to: state.period.to };
}

function fillPeriodFilter() {
  $('#filter-period').innerHTML = state.periods.map((p) =>
    `<option value="${p.id}"${p.id === state.periodId ? ' selected' : ''}>${esc(p.label)} · ${esc(fmtRange(p.from, p.to))}</option>`
  ).join('');
}

function fillReasonFilter() {
  $('#filter-reason').innerHTML = `<option value="">All reasons</option>` +
    data.reasons.map((r) => `<option value="${esc(r.reason)}">${esc(r.label)}</option>`).join('');
}

function fillRailMeta() {
  const m = data.meta;
  $('#rail-meta').innerHTML = `
    <b>${esc(m.brand.name)}</b>
    Commslayer · Shopify<br>
    Generated ${esc(fmtStamp(m.generated_at))}<br>
    Reporting in ${esc(m.reporting_timezone)}`;
}

function showWarnings(warnings) {
  if (!warnings || warnings.length === 0) return;
  const box = $('#alerts');
  box.hidden = false;
  box.innerHTML = warnings.map((w) =>
    `<p class="alert"><b>Inconsistent data:</b> ${esc(w)}</p>`).join('');
}

/* ------------------------------------------------------------ desenhar -- */

function go(view, { silent = false } = {}) {
  if (!VIEWS[view]) return;
  state.view = view;
  if (!silent) location.hash = view;
  render();
  $('#conteudo').focus({ preventScroll: true });
  scrollTo({ top: 0, behavior: 'smooth' });
}

function render() {
  const def = VIEWS[state.view];

  document.querySelectorAll('.navitem').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.view === state.view));

  $('#view-title').textContent = def.title;
  $('#view-sub').textContent = def.sub(state);
  document.title = `Quasi · ${def.title}`;

  // O seletor de motivo não faz sentido onde nada é recortado por motivo.
  const usaMotivo = state.view === 'overview' || state.view === 'operation';
  $('#filter-reason').closest('.field').style.display = usaMotivo ? '' : 'none';
  $('#filter-period').closest('.field').style.display =
    (state.view === 'plans' || state.view === 'operation') ? 'none' : '';

  for (const id of Object.keys(VIEWS)) {
    const el = document.getElementById(`view-${id}`);
    el.hidden = id !== state.view;
    if (id !== state.view) el.innerHTML = '';
  }

  const host = document.getElementById(`view-${state.view}`);
  try {
    host.innerHTML = def.render(data, state);
    wireCharts(host);
  } catch (err) {
    console.error(err);
    host.innerHTML = `<p class="empty">Could not build this view: ${esc(err.message)}</p>`;
  }
}

function fail(err) {
  console.error(err);
  const el = $('#loading');
  if (el) {
    el.className = 'alert';
    el.innerHTML = `<span><b>Could not load the data.</b> ${esc(err.message)}</span>`;
  }
}
