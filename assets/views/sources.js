/* De onde vêm os números — a tela que responde "isso aí é medido como?" */

import { fmtStamp, fmtDay, fmtInt, esc } from '../charts.js';

export function renderSources(data) {
  const { meta, rows, refunds, replacements, chargebacks, queue, reasons } = data;

  const contagem = [
    ['meta.json', 'Limites do período e as metas', '1 objeto'],
    ['reasons.json', 'Registro dos motivos de contato', `${reasons.length} motivos`],
    ['tickets-daily.json', 'Um registro por motivo por dia', `${fmtInt(rows.length)} linhas`],
    ['queue.json', 'Retrato da fila num instante', `${fmtInt(queue.critical?.length ?? 0)} críticas · ${fmtInt(queue.agents?.length ?? 0)} atendentes`],
    ['refunds.json', 'Uma linha por reembolso', `${fmtInt(refunds.length)} reembolsos`],
    ['replacements.json', 'Uma linha por reposição enviada', `${fmtInt(replacements.length)} reposições`],
    ['revenue.json', 'Receita e pedidos por dia, da Shopify', `${fmtInt(data.revenue.length)} dias`],
    ['chargebacks.json', 'Uma linha por disputa', `${fmtInt(chargebacks.length)} disputas`],
    ['action-plans.json', 'Escrito à mão, fora do gerador', `${fmtInt(data.plans.length)} planos`],
  ];

  const definicoes = [
    ['Primeira resposta',
     'Horas entre a conversa nascer e a primeira resposta <b>humana</b>. Resposta automática, macro disparada por automação e mensagem de bot não contam. É a definição que mais depende da API: se o Commslayer não distinguir bot de gente no payload da mensagem, esta métrica desaba para perto de zero e deixa de significar qualquer coisa.'],
    ['Respondidas',
     'Conversas que receberam ao menos uma resposta humana <b>naquele dia</b> — contadas pela resposta, não pela criação. Uma conversa que nasce domingo e é respondida segunda conta na segunda, e o valor dela passa de 24h.'],
    ['Resolução',
     'Horas entre nascer e o fechamento final. Se foi reaberta e fechada de novo, vale o <b>último</b> fechamento.'],
    ['Taxa de reabertura',
     'Reabertas ÷ fechadas na mesma janela.'],
    ['Fila',
     'Conversas abertas ou pendentes no instante do retrato. É uma contagem do que existe, não um total do que aconteceu — por isso não soma entre períodos.'],
    ['Sem resposta há +24h',
     'Abertas há mais de 24h e ainda sem nenhuma resposta humana. Diferente das faixas de idade: uma conversa pode ter 30h de vida e já ter sido respondida.'],
    ['Taxa de reembolso',
     '<b>Dinheiro sobre dinheiro</b>: valor devolvido ÷ receita da mesma janela. Nunca reembolsos ÷ conversas. É para isso que <code>revenue.json</code> existe.'],
    ['Taxa de chargeback',
     '<b>Quantidade ÷ pedidos</b>, não valor ÷ receita. É a razão que as bandeiras monitoram e sobre a qual definem limite. A razão em dinheiro é reportada ao lado porque é o que custa, mas não é o número que dispara nada.'],
    ['Aproveitamento em disputas',
     'Ganhas ÷ decididas, onde decididas = ganhas + perdidas + aceitas. Pendentes ficam de fora.'],
  ];

  const convencoes = [
    ['Mediana nunca é guardada',
     '<code>tickets-daily.json</code> carrega um valor por ticket, não uma mediana pronta, porque mediana de medianas não é mediana. Se o arquivo guardasse <code>frt_median</code> por motivo e por dia, não haveria jeito correto de produzir a mediana da semana, nem a mediana entre motivos. Como os valores crus estão lá, toda mediana da tela — do dia, do motivo, da semana, de qualquer recorte do filtro — sai do conjunto real de conversas.'],
    ['Contagem e dinheiro somam; mediana e porcentagem não',
     'A linha de total das tabelas é recalculada sobre o conjunto reunido, o que a pondera por volume. É por isso que ela é rotulada <i>Total / ponderado</i> e quase nunca é a média das células acima dela.'],
    ['Porcentagem não é armazenada',
     'Onde os dois números crus existem, o JSON carrega os dois e a divisão acontece em <code>metrics.js</code>. Os únicos valores em forma de porcentagem nos dados são <b>alvos</b> em <code>meta.json</code>, que são limiares, não medições.'],
    ['Ausente é <code>null</code>',
     'Nunca <code>""</code>, nunca <code>0</code>, nunca <code>"N/A"</code>. <code>0</code> quer dizer zero medido.'],
    ['Duração é sempre hora, como número',
     '<code>3.75</code> significa 3h45. Nunca segundo, nunca minuto, nunca <code>"3h45m"</code>. Formatar é trabalho da interface.'],
  ];

  const fase2 = [
    ['Um job agendado escreve o JSON',
     'Uma rotina chama a API do Commslayer e a da Shopify, calcula as mesmas contagens cruas e os mesmos arrays por ticket que o contrato define, escreve <code>data/*.json</code> e comita. <b>Nada neste repositório muda — nem o <code>data.js</code>.</b> A página passa a mostrar número real porque os arquivos embaixo dela mudaram. É o caminho pretendido.'],
    ['Um endpoint ao vivo',
     'Só a tabela <code>SOURCES</code> no topo de <code>data.js</code> muda: caminho vira URL. O formato devolvido continua idêntico.'],
    ['Continua sendo arquivo, preenchido à mão',
     'Funciona e é honesto enquanto o volume for pequeno. Deixa de funcionar no dia em que alguém esquecer de atualizar — e o <code>generated_at</code> no rodapé é justamente o que torna isso visível.'],
  ];

  const li = (pairs) => pairs.map(([k, v]) =>
    `<dt>${k}</dt><dd>${v}</dd>`).join('');

  return `
    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">Como este portal é alimentado hoje</h2>
        <p class="card__note">Nove arquivos JSON em <code>data/</code>. A interface não calcula
        nada a partir de outro lugar, e nenhum módulo além de <code>assets/data.js</code> lê esses arquivos.</p>
      </div></div>
      <div class="card__body">
        <div class="tablewrap"><table>
          <thead><tr><th>Arquivo</th><th>O que é</th><th>Tamanho hoje</th></tr></thead>
          <tbody>${contagem.map(([f, d, n]) => `
            <tr><td><code>${esc(f)}</code></td><td style="text-align:left">${esc(d)}</td><td style="text-align:left">${esc(n)}</td></tr>`).join('')}
          </tbody>
        </table></div>
        <dl class="stat-inline" style="margin-top:24px">
          <div><dt>Loja</dt><dd style="font-size:17px">${esc(meta.brand.name)}<span class="sub">${esc(meta.brand.site)}</span></dd></div>
          <div><dt>Atendimento</dt><dd style="font-size:17px">Commslayer<span class="sub">origem de tudo que é conversa</span></dd></div>
          <div><dt>Loja online</dt><dd style="font-size:17px">Shopify<span class="sub">receita, pedidos e reembolsos</span></dd></div>
          <div><dt>Fuso do relatório</dt><dd style="font-size:17px">${esc(meta.reporting_timezone)}<span class="sub">em que os dias são fechados</span></dd></div>
          <div><dt>Gerado em</dt><dd style="font-size:17px">${esc(fmtStamp(meta.generated_at))}<span class="sub">um portal desatualizado aparece como desatualizado</span></dd></div>
        </dl>
      </div>
    </section>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">O que cada número quer dizer</h2>
        <p class="card__note">Vale a pena ler antes de discutir se um número está bom ou ruim.</p>
      </div></div>
      <div class="card__body"><dl class="deflist">${li(definicoes)}</dl></div>
    </section>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">Convenções que valem para tudo</h2>
      </div></div>
      <div class="card__body"><dl class="deflist">${li(convencoes)}</dl></div>
    </section>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">Fase 2: trocar número fictício por número real</h2>
        <p class="card__note">A aposta deste projeto é que trocar dado falso por dado real
        <b>não encosta na interface</b>. Só <code>assets/data.js</code> busca alguma coisa; todo o
        resto recebe o objeto que ele devolve. A tela está acoplada a um formato, não a uma fonte.</p>
      </div></div>
      <div class="card__body">
        <dl class="deflist">${li(fase2)}</dl>
        <p class="note note--scoped" style="margin-top:20px">
          <b>Token de API nunca pode chegar ao navegador.</b> Se este portal for publicado como
          site estático, tudo que a página consegue ler qualquer visitante também consegue. Isso
          descarta chamar a API do Commslayer a partir do código do cliente — a busca tem que
          acontecer num job, do lado de fora.
        </p>
        <p class="note">
          Antes de escrever a rotina de ingestão, uma pergunta decide se o resto é viável:
          <b>o payload de mensagem do Commslayer distingue resposta de bot de resposta de gente?</b>
          Primeira resposta está definida como tempo até a primeira resposta <i>humana</i>. Se
          resposta automática for indistinguível de resposta de atendente, a métrica desaba para
          perto de zero e para de significar qualquer coisa.
        </p>
      </div>
    </section>

    <section class="card">
      <div class="card__head"><div>
        <h2 class="card__title">Sobre os números desta página</h2>
      </div></div>
      <div class="card__body">
        <p style="font-size:13.5px;color:var(--ink-2);max-width:80ch">
          Todos são <b>fictícios</b>. Foram gerados por <code>tools/generate-data.ps1</code> com semente
          fixa, então rodar de novo produz exatamente os mesmos números e o portal não muda sozinho.
          São plausíveis e internamente consistentes — as medianas batem com os arrays, as faixas de
          idade somam a fila, os atendentes somam o dia — mas foram <b>gerados, não medidos</b>.
          O que é real aqui é o formato, as definições e a matemática.
        </p>
        <p class="note">Período mostrado: ${esc(fmtDay(meta.period_start))} a ${esc(fmtDay(meta.period_end))},
        comparado com ${esc(fmtDay(meta.previous_period_start))} a ${esc(fmtDay(meta.previous_period_end))}.</p>
      </div>
    </section>
  `;
}
