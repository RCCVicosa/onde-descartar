(() => {
  const state = { data:null, lastRoute:'inicio', currentResidue:null };
  const pages = [...document.querySelectorAll('.page')];
  const navLinks = [...document.querySelectorAll('[data-route]')];
  const app = document.getElementById('app');
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');
  const accessibilityToggle = document.getElementById('accessibilityToggle');
  const accessibilityPanel = document.getElementById('accessibilityPanel');
  const toast = document.getElementById('toast');

  function showToast(message){
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function route(name, {focus=true} = {}){
    const valid = pages.some(p => p.dataset.page === name) ? name : 'inicio';
    if (valid !== 'ficha') state.lastRoute = valid;
    pages.forEach(p => p.classList.toggle('active', p.dataset.page === valid));
    document.querySelectorAll('.nav a[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === valid));
    mainNav.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded','false');
    location.hash = valid;
    if (focus) {
      window.scrollTo({top:0,behavior:'smooth'});
      setTimeout(() => app.focus({preventScroll:true}), 160);
    }
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-route]');
    if (trigger){
      e.preventDefault();
      route(trigger.dataset.route);
    }
  });

  menuToggle?.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  document.getElementById('globalSearchBtn')?.addEventListener('click', () => {
    route('residuos');
    setTimeout(() => document.getElementById('residueSearch')?.focus(), 220);
  });

  accessibilityToggle?.addEventListener('click', () => {
    const open = accessibilityPanel.hasAttribute('hidden');
    if (open) accessibilityPanel.removeAttribute('hidden'); else accessibilityPanel.setAttribute('hidden','');
    accessibilityToggle.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.accessibility-wrap') && !accessibilityPanel.hasAttribute('hidden')){
      accessibilityPanel.setAttribute('hidden','');
      accessibilityToggle.setAttribute('aria-expanded','false');
    }
  });

  let fontScale = Number(localStorage.getItem('rcc-font-scale') || '1');
  document.documentElement.style.setProperty('--font-scale', fontScale);
  document.body.classList.toggle('readable', localStorage.getItem('rcc-readable') === '1');
  document.body.classList.toggle('high-contrast', localStorage.getItem('rcc-contrast') === '1');
  document.body.classList.toggle('dark-mode', localStorage.getItem('rcc-dark') === '1');

  document.querySelectorAll('[data-access]').forEach(btn => btn.addEventListener('click', () => {
    const action = btn.dataset.access;
    if (action === 'font-plus'){
      fontScale = Math.min(1.35, +(fontScale + .08).toFixed(2));
      document.documentElement.style.setProperty('--font-scale',fontScale); localStorage.setItem('rcc-font-scale',fontScale);
    }
    if (action === 'font-minus'){
      fontScale = Math.max(.9, +(fontScale - .08).toFixed(2));
      document.documentElement.style.setProperty('--font-scale',fontScale); localStorage.setItem('rcc-font-scale',fontScale);
    }
    if (action === 'readable'){
      document.body.classList.toggle('readable'); localStorage.setItem('rcc-readable',document.body.classList.contains('readable')?'1':'0');
    }
    if (action === 'contrast'){
      document.body.classList.toggle('high-contrast'); localStorage.setItem('rcc-contrast',document.body.classList.contains('high-contrast')?'1':'0');
    }
    if (action === 'dark'){
      document.body.classList.toggle('dark-mode'); localStorage.setItem('rcc-dark',document.body.classList.contains('dark-mode')?'1':'0');
    }
    if (action === 'speak') speakCurrentPage();
    if (action === 'stop-speak') window.speechSynthesis?.cancel();
  }));

  function speakCurrentPage(){
    if (!('speechSynthesis' in window)) return showToast('A leitura em voz alta não está disponível neste navegador.');
    window.speechSynthesis.cancel();
    const active = document.querySelector('.page.active');
    const text = active?.innerText?.replace(/\s+/g,' ').trim();
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR'; u.rate = .95;
    window.speechSynthesis.speak(u);
    showToast('Leitura em voz alta iniciada.');
  }

  const statusLabel = s => ({confirmado:'Confirmado',pendente:'Pendente',lacuna:'Lacuna identificada'}[s] || 'Em revisão');

  function renderStages(){
    const grid = document.getElementById('stageGrid');
    if (!grid || !state.data) return;
    grid.innerHTML = state.data.etapas.map(etapa => {
      const count = state.data.residuos.filter(r => r.etapas.includes(etapa.id)).length;
      return `<button class="stage-card" data-stage="${etapa.id}"><strong>${escapeHtml(etapa.nome)}</strong><span>${count} resíduo(s) cadastrado(s) • ${escapeHtml(etapa.descricao)}</span></button>`;
    }).join('');
    grid.querySelectorAll('[data-stage]').forEach(btn => btn.addEventListener('click', () => showStage(btn.dataset.stage)));
  }

  function showStage(id){
    const etapa = state.data.etapas.find(e => e.id === id);
    const residuos = state.data.residuos.filter(r => r.etapas.includes(id));
    const panel = document.getElementById('stageResults');
    panel.classList.remove('hidden');
    panel.innerHTML = `<h2>${escapeHtml(etapa?.nome || 'Etapa')}</h2>${residuos.length ? `<div class="residue-list">${residuos.map(residueCard).join('')}</div>` : '<p>Nenhum resíduo cadastrado para esta etapa.</p>'}`;
    panel.querySelectorAll('[data-residue]').forEach(btn => btn.addEventListener('click', () => openResidue(btn.dataset.residue, 'etapas')));
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function residueCard(r){
    return `<button class="residue-card" data-residue="${r.id}"><span class="class-badge">${escapeHtml(r.classe)}</span><span><strong>${escapeHtml(r.nome)}</strong><span>Ver ficha de gerenciamento</span></span><span class="status-pill ${escapeHtml(r.status)}">${statusLabel(r.status)}</span></button>`;
  }

  function renderResidues(filter=''){
    const list = document.getElementById('residueList');
    if (!list || !state.data) return;
    const q = normalize(filter);
    const rows = state.data.residuos.filter(r => normalize(`${r.nome} ${r.classe}`).includes(q));
    list.innerHTML = rows.length ? rows.map(residueCard).join('') : '<p>Nenhum resíduo encontrado para essa pesquisa.</p>';
    list.querySelectorAll('[data-residue]').forEach(btn => btn.addEventListener('click', () => openResidue(btn.dataset.residue, 'residuos')));
  }

  document.getElementById('residueSearch')?.addEventListener('input', e => renderResidues(e.target.value));

  function openResidue(id, from){
    const r = state.data.residuos.find(x => x.id === id); if (!r) return;
    state.currentResidue = r; state.lastRoute = from || state.lastRoute;
    const sheet = document.getElementById('residueSheet');
    const stageNames = r.etapas.map(id => state.data.etapas.find(e => e.id === id)?.nome).filter(Boolean);
    sheet.innerHTML = `
      <header class="sheet-header"><div><h2>${escapeHtml(r.nome)}</h2><p>${escapeHtml(r.origem)}</p><div class="sheet-meta"><span class="meta-chip">${statusLabel(r.status)}</span>${stageNames.map(s=>`<span class="meta-chip">${escapeHtml(s)}</span>`).join('')}</div></div><div class="sheet-class">Classe ${escapeHtml(r.classe)}</div></header>
      <div class="sheet-grid">
        ${sheetSection('Segregação',r.segregacao)}
        ${sheetSection('Acondicionamento',r.acondicionamento)}
        ${sheetSection('Armazenamento temporário',r.armazenamento)}
        ${sheetSection('Transporte',r.transporte)}
        ${sheetSection('Reutilização ou reciclagem',r.reutilizacao)}
        ${sheetSection('Destinação aplicável',r.destinacao)}
        ${sheetSection('Alternativa em Viçosa/MG',r.alternativaLocal,'full')}
        ${sheetSection('Fonte e verificação',`${r.fonte} • Situação: ${r.verificacao}`,'full')}
      </div>`;
    route('ficha');
  }

  function sheetSection(title,text,extra=''){
    return `<section class="sheet-section ${extra}"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text || 'Informação ainda não cadastrada.')}</p></section>`;
  }

  document.getElementById('backFromSheet')?.addEventListener('click', () => route(state.lastRoute || 'residuos'));

  function normalize(v=''){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}

  async function loadData(){
    let data, source='JSON';
    try{
      const res = await fetch('data/base.json',{cache:'no-store'});
      if (!res.ok) throw new Error('Falha ao carregar base');
      data = await res.json();
    } catch(e){ data = window.RCC_FALLBACK_DATA; source='base de apoio local'; }
    state.data = data;
    const status = document.getElementById('dataStatus');
    if (status) status.textContent = `${data.meta?.versao || 'Protótipo'} • atualização ${data.meta?.atualizacao || 'não informada'} • ${source}`;
    renderStages(); renderResidues();
  }

  const initial = location.hash.replace('#','');
  route(initial || 'inicio',{focus:false});
  loadData();
})();


/* ===== Acessibilidade 1.0 — WCAG + VLibras ===== */
(() => {
  const announce = (message) => {
    let live = document.getElementById('a11y-status');
    if (!live) {
      live = document.createElement('div');
      live.id = 'a11y-status';
      live.className = 'sr-only';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      document.body.appendChild(live);
    }
    live.textContent = '';
    window.setTimeout(() => { live.textContent = message; }, 40);
  };

  // Nomes acessíveis para controles principais.
  const menu = document.getElementById('menuToggle');
  const search = document.getElementById('globalSearchBtn');
  const accToggle = document.getElementById('accessibilityToggle');
  const toast = document.getElementById('toast');
  if (menu && !menu.getAttribute('aria-label')) menu.setAttribute('aria-label', 'Abrir menu de navegação');
  if (search && !search.getAttribute('aria-label')) search.setAttribute('aria-label', 'Pesquisar resíduos');
  if (accToggle && !accToggle.getAttribute('aria-label')) accToggle.setAttribute('aria-label', 'Abrir recursos de acessibilidade');
  if (toast) {
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
  }

  // Landmarks e identificação das páginas para tecnologias assistivas.
  const app = document.getElementById('app');
  if (app && app.tagName.toLowerCase() !== 'main') app.setAttribute('role', 'main');
  document.querySelectorAll('.page').forEach((page, index) => {
    const heading = page.querySelector('h1, h2');
    if (heading) {
      if (!heading.id) heading.id = 'page-heading-' + (index + 1);
      page.setAttribute('role', 'region');
      page.setAttribute('aria-labelledby', heading.id);
    }
  });

  // Ícones ilustrativos acompanhados de texto não devem ser lidos duas vezes.
  document.querySelectorAll(
    '.nav-icon-img, .top-icon-img, .hero-action-icon img, .feature-icon img, .audience-grid img, .search-input-icon'
  ).forEach(img => {
    if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
    img.setAttribute('aria-hidden', 'true');
  });

  // Qualquer imagem restante recebe um alt seguro caso esteja sem atributo.
  document.querySelectorAll('img:not([alt])').forEach(img => {
    const label = img.getAttribute('title') || '';
    img.setAttribute('alt', label);
  });

  // Garante títulos/nomes acessíveis nos cards gerados dinamicamente.
  const observer = new MutationObserver(() => {
    document.querySelectorAll('button:not([aria-label])').forEach(btn => {
      const text = btn.textContent.replace(/\s+/g, ' ').trim();
      if (text) btn.setAttribute('aria-label', text);
    });
  });
  observer.observe(document.body, {childList:true, subtree:true});

  // Integração oficial do VLibras Widget 7.
  function loadVLibras() {
    if (document.getElementById('vlibras-plugin-script')) return;
    const script = document.createElement('script');
    script.id = 'vlibras-plugin-script';
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.defer = true;
    script.onload = () => announce('VLibras carregado. O botão de Libras está disponível na página.');
    script.onerror = () => announce('Não foi possível carregar o VLibras neste momento.');
    document.body.appendChild(script);
  }
  loadVLibras();

  // Acrescenta a opção Libras ao painel já existente, se houver.
  const panel = document.getElementById('accessibilityPanel');
  if (panel && !panel.querySelector('[data-access="libras"]')) {
    const librasButton = document.createElement('button');
    librasButton.type = 'button';
    librasButton.dataset.access = 'libras';
    librasButton.innerHTML = '<span class="acc-icon" aria-hidden="true">LIB</span><span>Libras (VLibras)</span>';
    librasButton.addEventListener('click', () => {
      const btn = window.VLibrasWidget?.initBtn;
      if (btn) {
        btn.click();
        announce('VLibras aberto.');
      } else {
        loadVLibras();
        announce('VLibras está sendo carregado. Use o botão de Libras que aparecerá na página.');
      }
    });
    panel.appendChild(librasButton);
  }

  // Se o HTML não trouxer o menu de acessibilidade, cria um controle flutuante de contingência.
  if (!accToggle || !panel) {
    const wrap = document.createElement('div');
    wrap.className = 'a11y-fallback';
    wrap.innerHTML = `
      <button type="button" class="a11y-fallback-toggle" aria-expanded="false" aria-controls="a11yFallbackPanel">
        <span aria-hidden="true">♿</span><span>Acessibilidade</span>
      </button>
      <div id="a11yFallbackPanel" class="a11y-fallback-panel" hidden>
        <button type="button" data-fallback-action="font-minus">A− <span>Diminuir fonte</span></button>
        <button type="button" data-fallback-action="font-plus">A+ <span>Aumentar fonte</span></button>
        <button type="button" data-fallback-action="contrast">◐ <span>Alto contraste</span></button>
        <button type="button" data-fallback-action="speak">🔊 <span>Ouvir página</span></button>
        <button type="button" data-fallback-action="stop">■ <span>Parar leitura</span></button>
        <button type="button" data-fallback-action="libras">LIB <span>Libras (VLibras)</span></button>
      </div>`;
    document.body.appendChild(wrap);
    const toggle = wrap.querySelector('.a11y-fallback-toggle');
    const fallbackPanel = wrap.querySelector('.a11y-fallback-panel');
    toggle.addEventListener('click', () => {
      const open = fallbackPanel.hasAttribute('hidden');
      fallbackPanel.toggleAttribute('hidden', !open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    wrap.querySelectorAll('[data-fallback-action]').forEach(btn => btn.addEventListener('click', () => {
      const action = btn.dataset.fallbackAction;
      let scale = Number(localStorage.getItem('rcc-font-scale') || '1');
      if (action === 'font-plus') {
        scale = Math.min(1.35, +(scale + .08).toFixed(2));
        document.documentElement.style.setProperty('--font-scale', scale);
        localStorage.setItem('rcc-font-scale', scale);
        announce('Tamanho da fonte aumentado.');
      }
      if (action === 'font-minus') {
        scale = Math.max(.9, +(scale - .08).toFixed(2));
        document.documentElement.style.setProperty('--font-scale', scale);
        localStorage.setItem('rcc-font-scale', scale);
        announce('Tamanho da fonte reduzido.');
      }
      if (action === 'contrast') {
        document.body.classList.toggle('high-contrast');
        localStorage.setItem('rcc-contrast', document.body.classList.contains('high-contrast') ? '1' : '0');
        announce('Alto contraste alternado.');
      }
      if (action === 'speak') {
        const active = document.querySelector('.page.active');
        const text = active?.innerText?.replace(/\s+/g, ' ').trim();
        if ('speechSynthesis' in window && text) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'pt-BR';
          utterance.rate = .95;
          window.speechSynthesis.speak(utterance);
          announce('Leitura em voz alta iniciada.');
        } else announce('Leitura em voz alta indisponível neste navegador.');
      }
      if (action === 'stop') {
        window.speechSynthesis?.cancel();
        announce('Leitura em voz alta interrompida.');
      }
      if (action === 'libras') {
        const vlBtn = window.VLibrasWidget?.initBtn;
        if (vlBtn) vlBtn.click(); else loadVLibras();
      }
    }));
  }

  // Atalho Alt+A abre o painel de acessibilidade sem conflitar com a navegação por Tab.
  document.addEventListener('keydown', (event) => {
    if (event.altKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      const toggle = document.getElementById('accessibilityToggle') || document.querySelector('.a11y-fallback-toggle');
      toggle?.click();
      toggle?.focus();
      announce('Menu de acessibilidade aberto.');
    }
  });

  announce('Recursos de acessibilidade carregados. Atalho Alt mais A abre o menu de acessibilidade.');
})();
