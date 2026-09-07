/* Visão da semana — a tela que o cliente abre. */

import * as M from '../metrics.js';
import {
  tile, statusChip, legend, barList, lineChart, columnChart, seriesColor,
  fmtInt, fmtPct, fmtHours, fmtMoney, fmtRange, fmtDay, esc,
} from '../charts.js';

export function renderOverview(data, state) {
  const { meta, rows, reasons, queue, refunds, replacements, revenue, chargebacks } = data;
  const w = state.window;
  const cmp = state.period.compare;
  const reasonLabel = state.reason ? data.reasonById.get(state.reason)?.label : null;

  const cur = M.ticketKpis(rows, { ...w, reason: state.reason });
  const prev = cmp ? M.ticketKpis(rows, { ...cmp, reason: state.reason }) : null;

  const money = M.revenueIn(revenue, w.from, w.to);
  const moneyPrev = cmp ? M.revenueIn(revenue, cmp.from, cmp.to) : null;
  const ref = M.refundsIn(refunds, w.from, w.to);
  const repl = M.replacementsIn(replacements, w.from, w.to);
  const refRate = M.refundRate(refunds, revenue, w.from, w.to);
  const refRatePrev = cmp ? M.refundRate(refunds, revenue, cmp.from, cmp.to) : null;
  const cbRate = M.chargebackRate(chargebacks, revenue, w.from, w.to);
  const cbRatePrev = cmp ? M.chargebackRate(chargebacks, revenue, cmp.from, cmp.to) : null;

  const t = meta.targets;
  const days = M.byDay(rows, { ...w, reason: state.reason });
  const perReason = M.byReason(rows, reasons, w);

  /* -------------------------------------------------------------- topo -- */

  const d = (a, b, dir) => M.change(a, b, dir);
  const lbl = (delta, fmt) => (delta.delta == null ? '' : fmt(Math.abs(delta.delta)));

  const dCreated = d(cur.created, prev?.created, 'lower_is_better');
  const dFrt = d(cur.frtMedian, prev?.frtMedian, 'lower_is_better');
  const dU24 = d(cur.pctUnder24, prev?.pctUnder24, 'higher_is_better');
  const dRes = d(cur.resMedian, prev?.resMedian, 'lower_is_better');
  const dReopen = d(cur.reopenRate, prev?.reopenRate, 'lower_is_better');
  const dRefund = d(refRate, refRatePrev, 'lower_is_better');
  const dCb = d(cbRate, cbRatePrev, 'lower_is_better');

  const kpisTop = [
    tile({
      hero: true, label: 'Conversas recebidas', value: fmtInt(cur.created),
      delta: dCreated, deltaLabel: lbl(dCreated, fmtInt),
      foot: `${fmtInt(cur.answered)} respondidas · ${fmtInt(cur.closed)} fechadas`,
    }),
    tile({
      label: 'Primeira resposta', value: fmtHours(cur.frtMedian), unit: 'mediana',
      delta: dFrt, deltaLabel: lbl(dFrt, fmtHours),
      status: M.goalStatus(cur.frtMedian, t.frt_median_hours),
      foot: `9 em cada 10 em até ${fmtHours(cur.frtP90)}`,
    }),
    tile({
      label: 'Respondidos em até 24h', value: fmtPct(cur.pctUnder24),
      delta: dU24, deltaLabel: lbl(dU24, (v) => fmtPct(v)),
      status: M.goalStatus(cur.pctUnder24, t.pct_answered_under_24h),
      foot: `${fmtInt(cur.frt.length - M.countUnder(cur.frt, 24))} passaram de um dia`,
    }),
    tile({
      label: 'Resolução', value: fmtHours(cur.resMedian), unit: 'mediana',
      delta: dRes, deltaLabel: lbl(dRes, fmtHours),
      status: M.goalStatus(cur.resMedian, t.resolution_median_hours),
      foot: `${fmtInt(cur.closed)} conversas fechadas`,
    }),
  ].join('');

  // Os dois cartões de fila são retrato de um instante, não soma do período —
  // então não mudam com o seletor. Quando o período escolhido não é o do
  // retrato, o cartão precisa dizer isso, senão o número parece do período.
  const snapDia = fmtDay(data.queue.snapshot_at);
  const foraDoPeriodo = state.periodId !== 'current';
  const notaFila = foraDoPeriodo ? ` · retrato de ${snapDia}, não do período escolhido` : '';

  const kpisBottom = [
    tile({
      label: 'Fila no fechamento', value: fmtInt(queue.summary.backlog),
      status: foraDoPeriodo ? null : M.goalStatus(queue.summary.backlog, t.backlog),
      foot: `${fmtInt(queue.summary.aging.over_72h)} esperando há mais de 3 dias${notaFila}`,
    }),
    tile({
      label: 'Sem resposta há +24h', value: fmtInt(queue.summary.over_24h_unanswered),
      status: foraDoPeriodo ? null : M.goalStatus(queue.summary.over_24h_unanswered, t.over_24h_unanswered),
      foot: `nenhuma resposta humana ainda${notaFila}`,
    }),
    tile({
      label: 'Taxa de reembolso', value: fmtPct(refRate, 2),
      delta: dRefund, deltaLabel: lbl(dRefund, (v) => fmtPct(v, 2)),
      status: M.goalStatus(refRate, t.refund_rate),
      foot: `${fmtMoney(ref.total)} sobre ${fmtMoney(money.revenue)}`,
    }),
    tile({
      label: 'Taxa de chargeback', value: fmtPct(cbRate, 2),
      delta: dCb, deltaLabel: lbl(dCb, (v) => fmtPct(v, 2)),
      status: M.goalStatus(cbRate, t.chargeback_rate),
      foot: `${fmtInt(M.chargebacksOpenedIn(chargebacks, w.from, w.to).count)} disputas em ${fmtInt(money.orders)} pedidos`,
    }),
  ].join('');

  /* ---------------------------------------------------------- gráficos -- */

  const dayList = days.map((x) => x.date);
  const volume = lineChart({
    days: dayList,
    series: [
      { key: 'created', label: 'Recebidas', color: seriesColor(0), values: days.map((x) => x.created) },
      { key: 'answered', label: 'Respondidas', color: seriesColor(1), values: days.map((x) => x.answered) },
      { key: 'closed', label: 'Fechadas', color: seriesColor(2), values: days.map((x) => x.closed) },
    ],
    yLabel: 'Conversas por dia',
  });

  const frtCols = columnChart({
    days: dayList,
    values: days.map((x) => (x.frtMedian == null ? null : Math.round(x.frtMedian * 10) / 10)),
    label: 'Primeira resposta (mediana)',
    formatValue: (v) => `${v}h`,
    color: 'var(--series-1)',
  });

  /* ------------------------------------------------------- por motivo --- */

  const totalCreated = M.sum(perReason.map((r) => r.created));
  const motivoBars = barList(
    perReason.map((r) => ({
      label: r.label, value: r.created,
      sub: fmtPct(r.share),
      color: r.reason === state.reason ? 'var(--rose-ink)' : 'var(--series-1)',
    })),
    { format: fmtInt });

  const motivoTable = `<div class="tablewrap"><table>
    <thead><tr>
      <th>Motivo do contato</th>
      <th class="num">Recebidas</th><th class="num">Fatia</th>
      <th class="num">1ª resposta</th><th class="num">Até 24h</th>
      <th class="num">Resolução</th><th class="num">Reabertura</th>
    </tr></thead>
    <tbody>${perReason.map((r) => `
      <tr${r.reason === state.reason ? ' style="background:var(--rose-tint)"' : ''}>
        <td>${esc(r.label)}</td>
        <td class="num">${fmtInt(r.created)}</td>
        <td class="num">${fmtPct(r.share)}</td>
        <td class="num">${fmtHours(r.frtMedian)}</td>
        <td class="num">${fmtPct(r.pctUnder24)}</td>
        <td class="num">${fmtHours(r.resMedian)}</td>
        <td class="num">${fmtPct(r.reopenRate)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot><tr>
      <td>Total / ponderado</td>
      <td class="num">${fmtInt(totalCreated)}</td>
      <td class="num">100,0%</td>
      <td class="num">${fmtHours(M.ticketKpis(rows, w).frtMedian)}</td>
      <td class="num">${fmtPct(M.ticketKpis(rows, w).pctUnder24)}</td>
      <td class="num">${fmtHours(M.ticketKpis(rows, w).resMedian)}</td>
      <td class="num">${fmtPct(M.ticketKpis(rows, w).reopenRate)}</td>
    </tr></tfoot>
  </table></div>`;

  /* ------------------------------------------------ reembolso e troca --- */

  const REF_LABEL = {
    not_delivered: 'Não entregue', damaged_in_transit: 'Danificado no transporte',
    quality_issue: 'Qualidade do produto', adverse_reaction: 'Reação na pele',
    late_delivery: 'Entrega atrasada', wrong_item: 'Item errado',
    changed_mind: 'Desistência', subscription_charge: 'Cobrança de assinatura',
    missing_part: 'Item faltando no kit',
  };

  const dinheiro = `
    <dl class="stat-inline">
      <div><dt>Reembolsado</dt><dd>${fmtMoney(ref.total)}<span class="sub">${fmtInt(ref.count)} reembolsos · média ${fmtMoney(ref.average, { cents: true })}</span></dd></div>
      <div><dt>Parciais</dt><dd>${fmtPct(ref.partialShare)}<span class="sub">devolução parcial em vez de total</span></dd></div>
      <div><dt>Reposições</dt><dd>${fmtMoney(repl.total)}<span class="sub">${fmtInt(repl.count)} envios · ${fmtInt(repl.repeats)} pela segunda vez</span></dd></div>
      <div><dt>Custo total do problema</dt><dd>${fmtMoney(ref.total + repl.total)}<span class="sub">${fmtPct(M.percent(ref.total + repl.total, money.revenue), 2)} da receita</span></dd></div>
    </dl>`;

  const refBars = barList(
    ref.byReason.map((g) => ({ label: REF_LABEL[g.key] ?? g.key, value: g.count, sub: fmtMoney(g.amount) })),
    { format: fmtInt });

  /* ------------------------------------------------------------ metas --- */

  // Fila e "sem resposta" vêm do retrato, não do período. Num período que não
  // é o do retrato eles não têm valor a mostrar — melhor um traço do que um
  // número que parece pertencer àquela semana e não pertence.
  const valores = {
    frt_median_hours: cur.frtMedian,
    pct_answered_under_24h: cur.pctUnder24,
    resolution_median_hours: cur.resMedian,
    backlog: foraDoPeriodo ? null : queue.summary.backlog,
    over_24h_unanswered: foraDoPeriodo ? null : queue.summary.over_24h_unanswered,
    reopen_rate: cur.reopenRate,
    refund_rate: refRate,
    chargeback_rate: cbRate,
  };
  const unidade = (v, unit) => {
    if (v == null) return '—';
    if (unit === 'hours') return fmtHours(v);
    if (unit === 'percent') return fmtPct(v, v < 10 ? 2 : 1);
    if (unit === 'usd') return fmtMoney(v);
    return fmtInt(v);
  };

  const metas = `<div class="tablewrap"><table>
    <thead><tr><th>Meta</th><th class="num">Agora</th><th class="num">Meta</th><th class="num">Limite</th><th>Situação</th></tr></thead>
    <tbody>${Object.entries(t).map(([id, target]) => {
      const v = valores[id];
      const st = M.goalStatus(v, target);
      return `<tr>
        <td>${esc(target.label)}</td>
        <td class="num"><b>${unidade(v, target.unit)}</b></td>
        <td class="num">${unidade(target.goal, target.unit)}</td>
        <td class="num">${unidade(target.warning, target.unit)}</td>
        <td style="text-align:left">${statusChip(st, v == null && foraDoPeriodo ? 'sem retrato' : null)}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>
  <p class="note">Os limiares vivem em <code>data/meta.json</code>. Mudar um alvo muda o chip desta tabela sem tocar em código; tirar uma linha do arquivo tira a linha daqui.${
    foraDoPeriodo ? ` <b>Fila</b> e <b>sem resposta há +24h</b> aparecem como traço: são medidas do retrato de ${esc(snapDia)}, e não existe retrato do período que você escolheu.` : ''}</p>`;

  /* ------------------------------------------------------------ monta --- */

  const escopo = state.reason
    ? `<p class="note note--scoped">Filtrado por <b>${esc(reasonLabel)}</b>. Reembolsos, reposições e chargebacks não carregam motivo de contato — esses blocos continuam mostrando o período inteiro.</p>`
    : '';

  return `
    ${escopo}
    <div class="grid grid--kpi">${kpisTop}</div>
    <div class="grid grid--kpi">${kpisBottom}</div>

    <section class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Volume por dia</h2>
          <p class="card__note">Recebidas é quando a conversa nasce; respondidas é quando alguém de verdade respondeu. Os dias em que a linha rosa passa da âmbar são os dias em que a fila cresceu.</p>
        </div>
        <span class="card__aside">${esc(fmtRange(w.from, w.to))}</span>
      </div>
      <div class="card__body">${volume}
        ${legend([
          { label: 'Recebidas', color: seriesColor(0) },
          { label: 'Respondidas', color: seriesColor(1) },
          { label: 'Fechadas', color: seriesColor(2) },
        ], { line: true })}
      </div>
    </section>

    <div class="grid grid--2">
      <section class="card">
        <div class="card__head"><div>
          <h2 class="card__title">Tempo até a primeira resposta</h2>
          <p class="card__note">Mediana do dia, em horas. Calculada sobre o conjunto real de conversas respondidas naquele dia.</p>
        </div></div>
        <div class="card__body">${frtCols}</div>
      </section>

      <section class="card">
        <div class="card__head"><div>
          <h2 class="card__title">Reembolsos e reposições</h2>
          <p class="card__note">A taxa de reembolso é dinheiro sobre dinheiro — valor devolvido dividido pela receita do mesmo período. Nunca reembolsos ÷ conversas.</p>
        </div></div>
        <div class="card__body">${dinheiro}
          <h3 style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin:22px 0 12px">Motivo do reembolso</h3>
          ${refBars}
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">Por que as pessoas escrevem</h2>
        <p class="card__note">Com uma loja só, o motivo do contato é o eixo de comparação do portal. Esta tabela ignora o filtro de propósito — ela é a comparação.</p>
      </div></div>
      <div class="card__body">${motivoBars}<div style="margin-top:24px">${motivoTable}</div>
        <p class="note">A linha de total é recalculada sobre todas as conversas reunidas, não é a média das células acima. Contagem soma; mediana e porcentagem, não.</p>
      </div>
    </section>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">Metas</h2>
        <p class="card__note">Onde cada número caiu em relação ao que foi combinado.</p>
      </div></div>
      <div class="card__body">${metas}</div>
    </section>
  `;
}
