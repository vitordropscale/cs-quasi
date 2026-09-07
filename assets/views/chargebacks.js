/* Chargebacks.

   O arquivo responde duas perguntas diferentes e mantê-las separadas é o ponto:

   · Quantas ENTRARAM no período — recortado por opened_at. É a única base da taxa.
   · Onde as disputas estão AGORA — varredura de todas as linhas, ignorando o
     período. Uma disputa aberta antes da semana e ainda indecisa é dinheiro em
     risco hoje; limitá-la à semana seria reportá-la como se tivesse se resolvido. */

import * as M from '../metrics.js';
import {
  tile, statusChip, legend, barList, stackedRow,
  fmtInt, fmtPct, fmtMoney, fmtStamp, fmtDay, fmtRange, esc,
} from '../charts.js';

const REASON = {
  fraud_unauthorised: 'Fraude / não autorizada',
  product_not_received: 'Produto não recebido',
  product_not_as_described: 'Produto diferente do anunciado',
  subscription_not_cancelled: 'Assinatura não cancelada',
  duplicate_charge: 'Cobrança duplicada',
  credit_not_processed: 'Crédito não processado',
  unrecognised_descriptor: 'Não reconheceu a cobrança',
};
const NETWORK = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', paypal: 'PayPal' };
const STATUS = {
  open: 'Recebida', under_review: 'Em análise no banco',
  won: 'Ganha', lost: 'Perdida', accepted: 'Aceita sem contestar',
};

export function renderChargebacks(data, state) {
  const { chargebacks, revenue, meta } = data;
  const w = state.window;
  const cmp = state.period.compare;
  const snap = data.chargebackSnapshot;

  const abertos = M.chargebacksOpenedIn(chargebacks, w.from, w.to);
  const money = M.revenueIn(revenue, w.from, w.to);
  const rate = M.chargebackRate(chargebacks, revenue, w.from, w.to);
  const ratePrev = cmp ? M.chargebackRate(chargebacks, revenue, cmp.from, cmp.to) : null;
  const dRate = M.change(rate, ratePrev, 'lower_is_better');

  const st = M.chargebackStanding(chargebacks);
  const valorRate = M.percent(abertos.amount, money.revenue);

  /* ---------------------------------------------------------- cartões -- */

  const kpis = [
    tile({
      hero: true, label: 'Taxa de chargeback', value: fmtPct(rate, 2),
      delta: dRate, deltaLabel: dRate.delta == null ? '' : fmtPct(Math.abs(dRate.delta), 2),
      status: M.goalStatus(rate, meta.targets.chargeback_rate),
      foot: `${fmtInt(abertos.count)} disputas em ${fmtInt(money.orders)} pedidos`,
    }),
    tile({
      label: 'Valor disputado no período', value: fmtMoney(abertos.amount),
      foot: `${fmtPct(valorRate, 2)} da receita — a razão em dinheiro, que não é a que dispara nada`,
    }),
    tile({
      label: 'Parado no banco agora', value: fmtInt(st.pending.length),
      foot: `${fmtMoney(st.pendingAmount)} sem decisão`,
    }),
    tile({
      label: 'Aproveitamento', value: fmtPct(st.winRate),
      foot: `${fmtInt(st.won.length)} ganhas de ${fmtInt(st.decided.length)} decididas`,
    }),
  ].join('');

  /* -------------------------------------------------------- resultado -- */

  const segmentos = [
    { label: 'Ganhas', value: st.won.length, color: 'var(--good)' },
    { label: 'Perdidas', value: st.lost.length, color: 'var(--crit)' },
    { label: 'Aceitas sem contestar', value: st.accepted.length, color: 'var(--serious)' },
    { label: 'Ainda pendentes', value: st.pending.length, color: 'var(--axis)' },
  ];

  const resultado = `
    ${stackedRow(segmentos, { height: 30 })}
    ${legend(segmentos.map((s) => ({ label: `${s.label} — ${fmtInt(s.value)}`, color: s.color })))}
    <dl class="stat-inline" style="margin-top:22px">
      <div><dt>Dinheiro retido</dt><dd>${fmtMoney(st.wonAmount)}<span class="sub">casos ganhos</span></dd></div>
      <div><dt>Dinheiro perdido</dt><dd>${fmtMoney(st.lostAmount)}<span class="sub">perdidas + aceitas</span></dd></div>
      <div><dt>Taxas do processador</dt><dd>${fmtMoney(st.fees)}<span class="sub">${fmtInt(chargebacks.length)} casos × US$ 15</span></dd></div>
      <div><dt>Custo total</dt><dd>${fmtMoney(st.lostAmount + st.fees)}<span class="sub">perdido mais as taxas</span></dd></div>
    </dl>
    <p class="note">Aproveitamento é ganhas ÷ decididas. As pendentes ficam de fora — contá-las
    rebaixaria a taxa por nenhum outro motivo além de o tempo ainda não ter passado.
    A taxa do processador é cobrada dê no que der e não volta numa vitória, por isso ela é somada
    sobre todos os casos e não só sobre os perdidos.</p>`;

  /* --------------------------------------------------------- pendentes -- */

  const pendentes = [...st.pending]
    .map((c) => ({ ...c, age: M.ageInHours(c.opened_at, snap) }))
    .sort((a, b) => b.age - a.age);

  const tabelaPendentes = pendentes.length === 0
    ? `<p class="empty">Nenhuma disputa esperando decisão do banco.</p>`
    : `<div class="tablewrap"><table>
      <thead><tr>
        <th>Caso</th><th>Motivo alegado</th><th>Bandeira</th>
        <th class="num">Valor</th><th class="num">Idade</th><th>Situação</th><th>Defesa</th>
      </tr></thead>
      <tbody>${pendentes.map((c) => `
        <tr>
          <td>${esc(c.order_id)}<span class="cell-sub">${esc(c.chargeback_id)} · aberta em ${esc(fmtDay(c.opened_at))}</span></td>
          <td>${esc(REASON[c.reason] ?? c.reason)}</td>
          <td>${esc(NETWORK[c.network] ?? c.network)}</td>
          <td class="num">${fmtMoney(c.amount_usd, { cents: true })}</td>
          <td class="num">${Math.round(c.age / 24)} d</td>
          <td style="text-align:left">${esc(STATUS[c.status] ?? c.status)}</td>
          <td style="text-align:left">${c.represented
            ? '<span class="chip chip--good">enviada</span>'
            : '<span class="chip chip--warn">ainda não enviada</span>'}</td>
        </tr>`).join('')}
      </tbody></table></div>
      <p class="note">Idade contada contra o retrato de ${esc(fmtStamp(snap))}. Algumas foram
      abertas antes da semana relatada e continuam aqui — é dinheiro em risco hoje,
      independentemente do período que a página está mostrando.</p>`;

  /* ------------------------------------------------------- por motivo -- */

  const motivos = barList(
    st.byReason.map((g) => ({ label: REASON[g.key] ?? g.key, value: g.count, sub: fmtMoney(g.amount) })),
    { format: fmtInt });

  const redes = barList(
    st.byNetwork.map((g) => ({ label: NETWORK[g.key] ?? g.key, value: g.count, sub: fmtMoney(g.amount) })),
    { format: fmtInt });

  /* ------------------------------------------------------------ monta --- */

  return `
    <div class="grid grid--kpi">${kpis}</div>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">A taxa que as bandeiras olham</h2>
        <p class="card__note">Chargeback é medido em <b>quantidade ÷ pedidos</b>, não em valor ÷ receita.
        É essa razão que as bandeiras monitoram e sobre a qual definem limite — é ela que decide se a
        conta entra em programa de monitoramento. A razão em dinheiro está no cartão ao lado porque é o
        que o problema custa, mas não é o número que dispara nada.</p>
      </div>
      <span class="card__aside">${esc(fmtRange(w.from, w.to))}</span></div>
      <div class="card__body">
        <dl class="stat-inline">
          <div><dt>Disputas abertas</dt><dd>${fmtInt(abertos.count)}<span class="sub">no período relatado</span></dd></div>
          <div><dt>Pedidos</dt><dd>${fmtInt(money.orders)}<span class="sub">denominador da taxa</span></dd></div>
          <div><dt>Taxa</dt><dd>${fmtPct(rate, 2)}<span class="sub">${statusChip(M.goalStatus(rate, meta.targets.chargeback_rate))}</span></dd></div>
          <div><dt>Limite de monitoramento</dt><dd>${fmtPct(meta.targets.chargeback_rate.warning, 2)}<span class="sub">onde os programas costumam começar</span></dd></div>
        </dl>
      </div>
    </section>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">Onde as disputas estão agora</h2>
        <p class="card__note">Todas as ${fmtInt(chargebacks.length)} linhas do arquivo, sem recorte de período.</p>
      </div></div>
      <div class="card__body">${resultado}</div>
    </section>

    <div class="grid grid--2">
      <section class="card">
        <div class="card__head"><div><h2 class="card__title">Motivo alegado</h2></div></div>
        <div class="card__body">${motivos}</div>
      </section>
      <section class="card">
        <div class="card__head"><div><h2 class="card__title">Bandeira</h2></div></div>
        <div class="card__body">${redes}</div>
      </section>
    </div>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">Esperando decisão do banco</h2>
        <p class="card__note">Dinheiro que ainda pode voltar — ou não.</p>
      </div>
      <span class="card__aside">${fmtInt(pendentes.length)} casos · ${fmtMoney(st.pendingAmount)}</span></div>
      <div class="card__body">${tabelaPendentes}</div>
    </section>
  `;
}
