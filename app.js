const STORAGE_KEY = 'patrimonio_ocr_db_v1';

const state = {
  profile: { name: '', unit: '' },
  tabs: [],
  activeTabId: null
};

const el = {
  userName: document.getElementById('userName'),
  userUnit: document.getElementById('userUnit'),
  saveProfileBtn: document.getElementById('saveProfileBtn'),
  loadProfileBtn: document.getElementById('loadProfileBtn'),
  addTabBtn: document.getElementById('addTabBtn'),
  tabs: document.getElementById('tabs'),
  tabPanel: document.getElementById('tabPanel'),
  saveCurrentBtn: document.getElementById('saveCurrentBtn'),
  downloadCurrentBtn: document.getElementById('downloadCurrentBtn'),
  downloadAllBtn: document.getElementById('downloadAllBtn'),
  log: document.getElementById('log')
};

function log(msg) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleString('pt-BR')} - ${msg}`;
  el.log.prepend(li);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const saved = JSON.parse(raw);
  state.profile = saved.profile || state.profile;
  state.tabs = saved.tabs || [];
  state.activeTabId = saved.activeTabId || state.tabs[0]?.id || null;
}

function renderProfile() {
  el.userName.value = state.profile.name;
  el.userUnit.value = state.profile.unit;
}

function createTab(name = '') {
  const id = crypto.randomUUID();
  state.tabs.push({ id, name: name || `Setor ${state.tabs.length + 1}`, records: [] });
  state.activeTabId = id;
  persist();
  render();
  log(`Aba criada: ${name || `Setor ${state.tabs.length}`}`);
}

function getActiveTab() {
  return state.tabs.find(t => t.id === state.activeTabId);
}

function renderTabs() {
  el.tabs.innerHTML = '';
  state.tabs.forEach(tab => {
    const button = document.createElement('button');
    button.className = `tab-btn ${tab.id === state.activeTabId ? 'active' : ''}`;
    button.textContent = tab.name;
    button.onclick = () => {
      state.activeTabId = tab.id;
      persist();
      render();
    };
    el.tabs.appendChild(button);
  });
}

function tableRows(records) {
  return records.map((r, i) => `<tr><td>${i + 1}</td><td>${r.number}</td><td>${r.fileName}</td></tr>`).join('');
}

function renderTabPanel() {
  const active = getActiveTab();
  if (!active) {
    el.tabPanel.innerHTML = '<p class="muted">Nenhuma aba criada ainda.</p>';
    return;
  }

  el.tabPanel.innerHTML = `
    <div class="grid two-cols">
      <label>Nome da aba/setor
        <input id="sectorName" type="text" value="${active.name}">
      </label>
      <label>Enviar imagens de patrimônio
        <input id="sectorFiles" type="file" accept="image/*" multiple>
      </label>
    </div>
    <div class="actions">
      <button id="readImagesBtn" class="btn primary">Ler patrimônios nas imagens</button>
      <button id="copyCurrentBtn" class="btn">Copiar números</button>
      <button id="clearCurrentBtn" class="btn">Limpar aba</button>
    </div>
    <p class="muted">Total de patrimônios lidos: ${active.records.length}</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Patrimônio</th><th>Arquivo</th></tr></thead>
        <tbody>${tableRows(active.records)}</tbody>
      </table>
    </div>
  `;

  document.getElementById('sectorName').addEventListener('change', (e) => {
    active.name = e.target.value.trim() || active.name;
    persist();
    renderTabs();
  });

  document.getElementById('readImagesBtn').addEventListener('click', async () => {
    const files = Array.from(document.getElementById('sectorFiles').files || []);
    if (!files.length) return log('Selecione ao menos uma imagem.');
    log(`Iniciando OCR de ${files.length} imagem(ns) para ${active.name}.`);

    for (const file of files) {
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text || '';
      const numbers = [...new Set((text.match(/\d{4,}/g) || []))];
      numbers.forEach(n => active.records.push({ number: n, fileName: file.name }));
      log(`Arquivo ${file.name}: ${numbers.length} patrimônio(s) encontrado(s).`);
    }

    persist();
    renderTabPanel();
  });

  document.getElementById('copyCurrentBtn').addEventListener('click', async () => {
    const payload = active.records.map(r => r.number).join('\n');
    await navigator.clipboard.writeText(payload);
    log(`Patrimônios da aba ${active.name} copiados.`);
  });

  document.getElementById('clearCurrentBtn').addEventListener('click', () => {
    active.records = [];
    persist();
    renderTabPanel();
    log(`Aba ${active.name} limpa.`);
  });
}

function toCSV(tab) {
  const lines = ['indice,patrimonio,arquivo'];
  tab.records.forEach((r, i) => lines.push(`${i + 1},${r.number},"${r.fileName}"`));
  return lines.join('\n');
}

function download(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function render() {
  renderProfile();
  renderTabs();
  renderTabPanel();
}

el.saveProfileBtn.addEventListener('click', () => {
  state.profile.name = el.userName.value.trim();
  state.profile.unit = el.userUnit.value.trim();
  persist();
  log('Dados do usuário salvos no banco local.');
});

el.loadProfileBtn.addEventListener('click', () => {
  loadFromStorage();
  render();
  log('Dados carregados do banco local.');
});

el.addTabBtn.addEventListener('click', () => createTab());

el.saveCurrentBtn.addEventListener('click', () => {
  persist();
  log('Planilha atual salva no banco local.');
});

el.downloadCurrentBtn.addEventListener('click', () => {
  const active = getActiveTab();
  if (!active) return log('Crie uma aba antes de baixar.');
  download(`${active.name.replace(/\s+/g, '_')}.csv`, toCSV(active));
  log(`Download da planilha atual (${active.name}) iniciado.`);
});

el.downloadAllBtn.addEventListener('click', () => {
  if (!state.tabs.length) return log('Não há abas para baixar.');
  state.tabs.forEach(tab => download(`${tab.name.replace(/\s+/g, '_')}.csv`, toCSV(tab)));
  log('Download de todas as planilhas iniciado.');
});

loadFromStorage();
if (!state.tabs.length) createTab('Setor Inicial'); else render();
