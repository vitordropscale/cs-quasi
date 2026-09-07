/* Operação — a tela do time, não do cliente.

   Tudo aqui é SNAPSHOT: o estado da fila num instante. Nada nesta tela é uma
   soma de dias e nada pode ser somado entre períodos. Por isso ela não muda
   com o seletor de período — só o instante de queue.json a define. */

import * as M from '../metrics.js';
import {
  tile, legend, barList, stackedRow, stepColor,
  fmtInt, fmtPct, fmtHours, fmtStamp, esc,
} from '../charts.js';

const CRIT_LABEL = {
  no_reply_over_24h: 'Sem resposta há +24h',
  waiting_over_3_days: 'Esperando há +3 dias',
  reopened: 'Reaberto',
  refund_requested: 'Pediu reembolso',
  escalated: 'Escalado',
};

export function renderOperation(data, state) {
  const { queue, reasonById, refunds, meta } = data;
  const s = queue.summary;
  const snap = queue.snapshot_at;

  const agents = M.agentStats(queue);
  const refByAgent = M.refundsByAgent(refunds, meta.period_end, meta.period_end);
  const nameOf = (id) => queue.agents.find((a) => a.agent_id === id)?.agent_name ?? '—';
  const labelOf = (r) => reasonById.get(r)?.label ?? r;

  const t = meta.targets;
  const filtro = state.reason;

  /* ---------------------------------------------------------- cartões -- */

  const kpis = [
    tile({
      hero: true, label: 'Na fila agora', value: fmtInt(s.backlog),
      status: M.goalStatus(s.backlog, t.backlog),
      foot: `${fmtInt(s.unassigned)} sem ninguém atribuído`,
    }),
    tile({
      label: 'Sem resposta há +24h', value: fmtInt(s.over_24h_unanswered),
      status: M.goalStatus(s.over_24h_unanswered, t.over_24h_unanswered),
      foot: 'aberto e ainda sem resposta humana',
    }),
    tile({
      label: 'Esperando há +3 dias', value: fmtInt(s.aging.over_72h),
      foot: `${fmtPct(M.percent(s.aging.over_72h, s.backlog))} da fila`,
    }),
    tile({
      label: 'Respondidos no dia', value: fmtInt(s.answered_today),
      foot: `${fmtInt(agents.length)} atendentes em turno`,
    }),
  ].join('');

  /* -------------------------------------------------------- fila/idade -- */

  const aging = [
    { label: 'Menos de 24h', value: s.aging.under_24h, color: stepColor(0) },
    { label: 'De 24h a 72h', value: s.aging.h24_to_72h, color: stepColor(1) },
    { label: 'Mais de 72h', value: s.aging.over_72h, color: stepColor(2) },
  ];

  const idade = `
    ${stackedRow(aging, { height: 30 })}
    ${legend(aging.map((a) => ({ label: `${a.label} — ${fmtInt(a.value)}`, color: a.color })))}
    <p class="note">As três faixas particionam a fila: elas somam exatamente ${fmtInt(s.backlog)}.
    Idade é diferente de "sem resposta" — um ticket pode ter 30h de vida e já ter sido respondido.</p>`;

  /* ------------------------------------------------------ fila/motivo -- */

  const porMotivo = [...(queue.by_reason ?? [])].sort((a, b) => b.backlog - a.backlog);
  const filaMotivo = barList(
    porMotivo.map((r) => ({
      label: labelOf(r.reason), value: r.backlog,
      sub: `${fmtInt(r.over_24h_unanswered)} sem resposta`,
      color: r.reason === filtro ? 'var(--rose-ink)' : 'var(--series-1)',
    })),
    { format: fmtInt });

  /* ---------------------------------------------------------- críticos -- */

  const criticos = (queue.critical ?? [])
    .filter((c) => !filtro || c.reason === filtro)
    .map((c) => ({ ...c, age: M.ageInHours(c.created_at, snap) }))
    .sort((a, b) => b.age - a.age);

  const tabelaCritica = criticos.length === 0
    ? `<p class="empty">Nada na fila crítica para esta seleção.</p>`
    : `<div class="tablewrap"><table>
      <thead><tr>
        <th>Conversa</th><th>Motivo</th><th class="num">Idade</th>
        <th>1ª resposta</th><th>Responsável</th><th>Por que está aqui</th>
      </tr></thead>
      <tbody>${criticos.map((c) => `
        <tr>
          <td>${esc(c.subject)}<span class="cell-sub">${esc(c.customer)} · ${esc(c.order_id)} · ${esc(c.ticket_id)}</span></td>
          <td>${esc(labelOf(c.reason))}</td>
          <td class="num">${fmtHours(c.age)}</td>
          <td style="text-align:left">${c.first_human_reply_at
            ? esc(fmtStamp(c.first_human_reply_at))
            : '<span class="chip chip--crit">nunca respondida</span>'}</td>
          <td style="text-align:left">${c.assignee_id
            ? esc(nameOf(c.assignee_id))
            : '<span class="chip chip--warn">sem responsável</span>'}</td>
          <td style="text-align:left">${esc(CRIT_LABEL[c.escalation_reason] ?? c.escalation_reason)}</td>
        </tr>`).join('')}
      </tbody></table></div>`;

  /* ---------------------------------------------------------- agentes -- */

  const totalAnswered = M.sum(agents.map((a) => a.answered));
  const poolFrt = agents.flatMap((a) => a.frt_hours ?? []);

  const tabelaAgentes = `<div class="tablewrap"><table>
    <thead><tr>
      <th>Atendente</th><th class="num">Respondidas</th><th class="num">Fechadas</th>
      <th class="num">1ª resposta</th><th class="num">Passou de 24h</th>
      <th class="num">Reabertas</th><th class="num">Reembolsos</th>
    </tr></thead>
    <tbody>${agents.map((a) => `
      <tr>
        <td>${esc(a.agent_name)}</td>
        <td class="num">${fmtInt(a.answered)}</td>
        <td class="num">${fmtInt(a.closed)}</td>
        <td class="num">${fmtHours(a.frtMedian)}</td>
        <td class="num">${fmtInt(a.over24)}</td>
        <td class="num">${fmtInt(a.reopened)}<span class="cell-sub">${fmtPct(a.reopenRate)}</span></td>
        <td class="num">${fmtInt(refByAgent.get(a.agent_id) ?? 0)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot><tr>
      <td>Total / ponderado</td>
      <td class="num">${fmtInt(totalAnswered)}</td>
      <td class="num">${fmtInt(M.sum(agents.map((a) => a.closed)))}</td>
      <td class="num">${fmtHours(M.median(poolFrt))}</td>
      <td class="num">${fmtInt(M.sum(agents.map((a) => a.over24)))}</td>
      <td class="num">${fmtInt(M.sum(agents.map((a) => a.reopened)))}</td>
      <td class="num">${fmtInt(M.sum(agents.map((a) => refByAgent.get(a.agent_id) ?? 0)))}</td>
    </tr></tfoot>
  </table></div>
  <p class="note">A mediana do rodapé sai do conjunto reunido das ${fmtInt(poolFrt.length)} conversas
  respondidas no dia, não da média das medianas de cada pessoa. Reembolsos vêm de
  <code>refunds.json</code> contados por atendente — assim esta tabela e os cartões de
  reembolso não têm como discordar.</p>`;

  /* --------------------------------------------------------- mais velho -- */

  const o = s.oldest_ticket;
  const maisVelho = `
    <div class="plan__metric" style="display:flex;flex-wrap:wrap;gap:6px 20px;align-items:baseline">
      <b style="font-weight:600">${esc(o.subject)}</b>
      <span>${esc(labelOf(o.reason))}</span>
      <span>aberta há <b>${fmtHours(M.ageInHours(o.created_at, snap))}</b></span>
      <span>${o.assignee_id ? esc(nameOf(o.assignee_id)) : 'sem responsável'}</span>
      <span style="color:var(--muted)">${esc(o.ticket_id)}</span>
    </div>`;

  /* ------------------------------------------------------------ monta --- */

  const escopo = filtro
    ? `<p class="note note--scoped">Fila crítica e fila por motivo estão filtradas por <b>${esc(labelOf(filtro))}</b>. Os cartões do topo e a tabela de atendentes descrevem a operação inteira.</p>`
    : '';

  return `
    <p class="note note--scoped" style="background:var(--neutral-bg);color:var(--ink-2)">
      Retrato da fila em <b>${esc(fmtStamp(snap))}</b>. Nada nesta tela é soma de dias —
      é o que existia naquele instante, então o seletor de período não a altera.
    </p>
    ${escopo}
    <div class="grid grid--kpi">${kpis}</div>

    <div class="grid grid--2">
      <section class="card">
        <div class="card__head"><div>
          <h2 class="card__title">Há quanto tempo a fila espera</h2>
        </div></div>
        <div class="card__body">${idade}</div>
      </section>

      <section class="card">
        <div class="card__head"><div>
          <h2 class="card__title">Fila por motivo</h2>
          <p class="card__note">Onde a fila está parada agora.</p>
        </div></div>
        <div class="card__body">${filaMotivo}</div>
      </section>
    </div>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">A conversa mais antiga em aberto</h2>
      </div></div>
      <div class="card__body">${maisVelho}</div>
    </section>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">Fila crítica</h2>
        <p class="card__note">O que precisa de alguém hoje, mais velha primeiro.</p>
      </div>
      <span class="card__aside">${fmtInt(criticos.length)} conversas</span></div>
      <div class="card__body">${tabelaCritica}</div>
    </section>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">Por atendente</h2>
        <p class="card__note">Números do dia do retrato, ${esc(fmtStamp(snap).split(',')[0])}.</p>
      </div></div>
      <div class="card__body">${tabelaAgentes}</div>
    </section>
  `;
}
