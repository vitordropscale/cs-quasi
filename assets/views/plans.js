/* Planos de ação.

   Esta tela é o conteúdo inteiro de data/action-plans.json. Acrescentar um plano,
   reescrever um passo, marcar um como feito, trocar o responsável ou a prioridade
   acontece lá, nunca aqui.

   É a única tela que ignora o seletor de período: um plano não pertence a uma
   semana, ele fica aberto até ser fechado. */

import { statusChip, fmtDay, esc } from '../charts.js';

const STATUS = {
  not_started: { label: 'Não começou', chip: 'chip--none' },
  in_progress: { label: 'Em andamento', chip: 'chip--warn' },
  blocked: { label: 'Travado', chip: 'chip--crit' },
  done: { label: 'Concluído', chip: 'chip--good' },
};

const TIPO = {
  supplier: 'fornecedor', tech: 'técnico', comms: 'comunicação',
  policy: 'política', internal: 'interno',
};

export function renderPlans(data) {
  const plans = [...(data.plans ?? [])].sort((a, b) =>
    (a.priority - b.priority) || a.title.localeCompare(b.title, 'pt-BR'));

  if (plans.length === 0) {
    return `<p class="empty">Nenhum plano registrado.</p>`;
  }

  const cards = plans.map((p) => {
    const feitos = p.actions.filter((a) => a.done).length;
    const st = STATUS[p.status] ?? { label: p.status, chip: 'chip--none' };

    return `<section class="card plan">
      <div class="plan__top">
        <h2 class="plan__title">${esc(p.title)}</h2>
        <div class="plan__tags">
          <span class="chip ${st.chip}">${esc(st.label)}</span>
          <span class="chip chip--none chip--plain">prioridade ${esc(p.priority)}</span>
          <span class="chip chip--none chip--plain">${feitos} de ${p.actions.length} passos</span>
        </div>
      </div>

      <div class="plan__block">
        <h4>O problema</h4>
        <p>${esc(p.problem)}</p>
      </div>

      ${p.why_it_matters ? `<div class="plan__block">
        <h4>Por que este e não outro</h4>
        <p>${esc(p.why_it_matters)}</p>
      </div>` : ''}

      <div class="plan__block">
        <h4>Passos</h4>
        <ul class="steps">${p.actions.map((a) => `
          <li class="step${a.done ? ' step--done' : ''}">
            <span class="step__dot" aria-hidden="true"></span>
            <span class="step__text">${esc(a.text)}${TIPO[a.type] ? `<span class="tag">${esc(TIPO[a.type])}</span>` : ''}</span>
          </li>`).join('')}
        </ul>
      </div>

      <div class="plan__block">
        <h4>Como saberemos que funcionou</h4>
        <p class="plan__metric">${p.metric ? esc(p.metric) : 'Sem métrica definida — um plano sem métrica é um desejo.'}</p>
      </div>

      <p class="note">
        ${p.owner ? `Responsável: <b>${esc(p.owner)}</b>` : '<b>Sem responsável definido</b>'}
        · aberto em ${esc(fmtDay(p.opened_at))} · ${esc(p.plan_id)}
      </p>
    </section>`;
  }).join('');

  return `
    <p class="note note--scoped">
      Esta tela não olha o seletor de período — um plano não pertence a uma semana,
      fica aberto até ser fechado. Os pontinhos são só leitura: o avanço é registrado
      editando <code>data/action-plans.json</code>, não clicando aqui.
    </p>
    ${cards}`;
}
