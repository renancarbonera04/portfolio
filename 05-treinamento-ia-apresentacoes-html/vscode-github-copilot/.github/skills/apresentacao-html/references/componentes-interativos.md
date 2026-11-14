# Componentes interativos — código-base

Todos os componentes usam as variáveis do guia de marca da empresa (ver `guia-de-marca.md`) e funcionam **sem bibliotecas**. Formas: cards com cantos diagonais, barras com canto inferior direito curvo, colunas com canto superior direito curvo.
O núcleo de navegação completo está em `assets/template-apresentacao.html`; aqui estão os blocos para combinar.

Convenção: cada slide é um `<section class="slide">`. Quando um slide fica ativo, o núcleo chama `aoEntrar(slide)`, que dispara as animações abaixo **somente daquele slide**.

---

## 1. Contador animado (número de impacto)
```html
<div class="kpi">
  <div class="valor"><span class="contador" data-alvo="12.4" data-casas="1" data-sufixo="%">0</span></div>
  <div class="legenda">crescimento de volume no trimestre</div>
</div>
```
```js
function animarContadores(slide){
  slide.querySelectorAll('.contador').forEach(function(el){
    var alvo = parseFloat(el.dataset.alvo), casas = +(el.dataset.casas || 0);
    var pre = el.dataset.prefixo || '', suf = el.dataset.sufixo || '';
    var t0 = performance.now(), dur = 1400;
    function passo(t){
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); // desacelera no fim
      el.textContent = pre + (alvo * e).toLocaleString('pt-BR', {minimumFractionDigits: casas, maximumFractionDigits: casas}) + suf;
      if (p < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  });
}
```

## 2. Barras horizontais animadas (comparação)
```html
<div class="barras" data-max="160">
  <div class="barra"><span>Set</span><span class="trilho"><span class="preench" data-valor="142"></span></span><b>142</b></div>
  <div class="barra"><span>Ago</span><span class="trilho"><span class="preench" data-valor="135"></span></span><b>135</b></div>
  <div class="barra meta"><span>Meta</span><span class="trilho"><span class="preench" data-valor="130"></span></span><b>130</b></div>
</div>
```
```css
.barras{display:flex;flex-direction:column;gap:22px}
.barra{display:grid;grid-template-columns:140px 1fr 110px;align-items:center;gap:18px;font-size:26px}
.trilho{height:40px;background:var(--gelo);border-bottom-right-radius:18px;overflow:hidden}
.preench{display:block;height:100%;width:0;background:var(--destaque);border-bottom-right-radius:18px;transition:width 1.1s cubic-bezier(.2,.8,.2,1)}
.barra.meta .preench{background:var(--acento)}
```
```js
function animarBarras(slide){
  slide.querySelectorAll('.barras').forEach(function(grupo){
    var max = parseFloat(grupo.dataset.max);
    var barras = grupo.querySelectorAll('.preench');
    barras.forEach(function(b){ b.style.width = '0'; });
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      barras.forEach(function(b){ b.style.width = (parseFloat(b.dataset.valor) / max * 100) + '%'; });
    }); });
  });
}
```

## 3. Colunas animadas (evolução no tempo)
```html
<div class="colunas" data-max="150">
  <div class="col"><b>120</b><span class="haste" data-valor="120"></span><small>Jul</small></div>
  <div class="col"><b>135</b><span class="haste" data-valor="135"></span><small>Ago</small></div>
  <div class="col"><b>142</b><span class="haste" data-valor="142"></span><small>Set</small></div>
</div>
```
```css
.colunas{display:flex;align-items:flex-end;gap:40px;height:420px;border-bottom:2px solid var(--apoio)}
.col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:10px;font-size:24px}
.haste{width:100%;max-width:120px;height:0;background:var(--destaque);border-top-right-radius:var(--raio-p);transition:height 1.1s cubic-bezier(.2,.8,.2,1)}
.col small{font-size:22px;color:var(--apoio);margin-bottom:-40px}
```
```js
function animarColunas(slide){
  slide.querySelectorAll('.colunas').forEach(function(g){
    var max = parseFloat(g.dataset.max), hastes = g.querySelectorAll('.haste');
    hastes.forEach(function(h){ h.style.height = '0'; });
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      hastes.forEach(function(h){ h.style.height = (parseFloat(h.dataset.valor) / max * 80) + '%'; });
    }); });
  });
}
```

## 4. Abas (várias categorias no mesmo slide)
```html
<div class="abas">
  <div class="abas-botoes" role="tablist">
    <button class="aba-btn" role="tab" aria-selected="true" data-aba="aba-produtos">Produtos</button>
    <button class="aba-btn" role="tab" aria-selected="false" data-aba="aba-servicos">Serviços</button>
  </div>
  <div class="aba-painel" id="aba-produtos" role="tabpanel">Conteúdo 1</div>
  <div class="aba-painel" id="aba-servicos" role="tabpanel" hidden>Conteúdo 2</div>
</div>
```
```js
document.addEventListener('click', function(e){
  var btn = e.target.closest('.aba-btn'); if (!btn) return;
  var grupo = btn.closest('.abas');
  grupo.querySelectorAll('.aba-btn').forEach(function(b){ b.setAttribute('aria-selected', b === btn); });
  grupo.querySelectorAll('.aba-painel').forEach(function(p){ p.hidden = p.id !== btn.dataset.aba; });
});
```

## 5. Acordeão (detalhe sob demanda) — zero JavaScript
```html
<details class="acordeao"><summary>Por que o volume caiu em julho?</summary><p>Explicação...</p></details>
```
```css
.acordeao{background:#fff;border-radius:var(--diag);padding:18px 24px;margin-bottom:12px;font-size:24px}
.acordeao summary{font-weight:700;cursor:pointer;color:var(--destaque)}
.acordeao p{margin-top:12px}
```

## 6. Card que vira (pergunta → resposta)
```html
<button class="flip" aria-label="Virar card"><span class="flip-in"><span class="frente">Pergunta</span><span class="verso">Resposta</span></span></button>
```
```css
.flip{border:0;background:none;width:360px;height:240px;perspective:1000px;cursor:pointer;font:inherit}
.flip-in{position:relative;display:block;width:100%;height:100%;transition:transform .6s;transform-style:preserve-3d}
.flip.virado .flip-in{transform:rotateY(180deg)}
.frente,.verso{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;border-radius:var(--diag);backface-visibility:hidden;font-size:26px}
.frente{background:var(--destaque);color:var(--fundo)}
.verso{background:var(--acento);color:var(--tinta);transform:rotateY(180deg)}
```
```js
document.addEventListener('click', function(e){ var f = e.target.closest('.flip'); if (f) f.classList.toggle('virado'); });
```

## 7. Linha do tempo clicável
```html
<div class="linha-tempo">
  <button class="marco ativo" data-texto="Piloto em 20 lojas">Jan</button>
  <button class="marco" data-texto="Expansão para a regional">Mar</button>
  <button class="marco" data-texto="Escala nacional">Jun</button>
</div>
<p class="marco-detalhe">Piloto em 20 lojas</p>
```
```css
.linha-tempo{display:flex;justify-content:space-between;position:relative;margin:40px 0}
.linha-tempo::before{content:"";position:absolute;left:0;right:0;top:50%;height:4px;background:var(--gelo)}
.marco{position:relative;font:inherit;font-size:22px;font-weight:700;width:96px;height:96px;border-radius:50%;border:4px solid var(--destaque);background:var(--fundo);color:var(--destaque);cursor:pointer}
.marco.ativo{background:var(--destaque);color:var(--fundo)}
```
```js
document.addEventListener('click', function(e){
  var m = e.target.closest('.marco'); if (!m) return;
  var lt = m.closest('.linha-tempo');
  lt.querySelectorAll('.marco').forEach(function(x){ x.classList.toggle('ativo', x === m); });
  lt.nextElementSibling.textContent = m.dataset.texto;
});
```

## 8. Quiz com feedback
```html
<div class="quiz">
  <p class="pergunta">Qual região mais cresceu?</p>
  <div class="quiz-opcoes">
    <button class="quiz-op">Nordeste</button>
    <button class="quiz-op" data-certa>Sul</button>
    <button class="quiz-op">Sudeste</button>
  </div>
  <p class="quiz-feedback" aria-live="polite"></p>
</div>
```
```js
document.addEventListener('click', function(e){
  var op = e.target.closest('.quiz-op'); if (!op) return;
  var q = op.closest('.quiz'); if (q.dataset.respondido) return;
  q.dataset.respondido = '1';
  q.querySelectorAll('.quiz-op').forEach(function(o){ if (o.hasAttribute('data-certa')) o.classList.add('certa'); });
  var ok = op.hasAttribute('data-certa');
  if (!ok) op.classList.add('errada');
  q.querySelector('.quiz-feedback').textContent = ok ? '✔ Isso mesmo!' : '✖ Quase! A resposta certa está destacada.';
});
```

## 9. Simulador "e se" (controle deslizante)
```html
<label class="sim">Novos pontos de venda: <b id="sim-pdv">100</b>
  <input type="range" min="0" max="500" step="10" value="100" id="sim-range">
</label>
<p class="sim-res">Vendas adicionais estimadas: <b id="sim-vol">180</b> mil unidades</p>
```
```js
var r = document.getElementById('sim-range');
r.addEventListener('input', function(){
  var pdv = +r.value; // premissa ilustrativa (confirmar com a área): 1,8 mil unidades por ponto/mês
  document.getElementById('sim-pdv').textContent = pdv;
  document.getElementById('sim-vol').textContent = (pdv * 1.8).toLocaleString('pt-BR', {maximumFractionDigits: 0});
});
```
> Atenção: o teclado (setas) dentro de um `<input>` não deve trocar de slide — o núcleo de navegação ignora teclas quando o foco está em campos.

## 10. Rosca (participação) em SVG
```html
<svg viewBox="0 0 42 42" width="320" height="320" class="rosca" role="img" aria-label="Participação de 64%">
  <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--gelo)" stroke-width="6"/>
  <circle class="rosca-valor" cx="21" cy="21" r="15.915" fill="none" stroke="var(--destaque)" stroke-width="6"
          stroke-dasharray="0 100" data-valor="64" transform="rotate(-90 21 21)" style="transition:stroke-dasharray 1.2s"/>
  <text x="21" y="23.5" text-anchor="middle" font-size="7" font-weight="700" fill="var(--tinta)">64%</text>
</svg>
```
```js
function animarRoscas(slide){
  slide.querySelectorAll('.rosca-valor').forEach(function(c){
    c.style.strokeDasharray = '0 100';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      var v = parseFloat(c.dataset.valor); c.style.strokeDasharray = v + ' ' + (100 - v);
    }); });
  });
}
```

## 11. Campo de cor com curvatura + faixa (regra de composição do guia de marca)
```html
<div class="campo"><p><b>Decisão:</b> aprovar o piloto do roteiro inteligente.</p></div>
```
```css
.campo{background:var(--tinta);color:var(--fundo);padding:36px 40px;
  border-top-right-radius:var(--raio-m);          /* curvatura média */
  border-top:10px solid var(--destaque)}        /* a faixa acompanha a curva */
```

## 12. Logo e ícones da empresa (sempre como imagem)
```html
<!-- Cabeçalho: versão de cor conforme o fundo -->
<img class="logo" src="marca/logo.svg" alt="[Sua empresa]">           <!-- fundo claro -->
<img class="logo" src="marca/logo-negativo.svg" alt="[Sua empresa]">  <!-- fundo escuro -->
<!-- Macrográfico em capa/divisória: grande e cortado pela borda -->
<img class="macro" src="marca/grafismo.svg" alt="" style="position:absolute;right:-90px;bottom:-70px;width:820px">
<!-- Ícone da biblioteca da empresa -->
<img src="marca/icones/caminhao.svg" alt="" width="56">
```
Nunca redesenhe, recolora fora da paleta, rotacione ou distorça esses arquivos, e nunca digite o código SVG deles.
