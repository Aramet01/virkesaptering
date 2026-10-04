(() => {
  'use strict';
  const L = window.TimberLogic;
  if (!L) throw new Error('TimberLogic saknas');

  const $ = (s) => document.querySelector(s);
  const els = {
    species: $('#species'), quality: $('#quality'), stemLength: $('#stemLength'), objective: $('#objective'),
    massavedQuality: $('#massavedQuality'), massavedTransport: $('#massavedTransport'),
    startM: $('#startM'), kerfMm: $('#kerfMm'), dbhPointM: $('#dbhPointM'), latitudeDeg: $('#latitudeDeg'), allowUnder: $('#allowUnder'),
    points: $('#points'), pointCount: $('#pointCount'), message: $('#message'), calculate: $('#calculate'),
    resultSection: $('#resultSection'), stockCount: $('#stockCount'), pulpCount: $('#pulpCount'), resultMode: $('#resultMode'), totalValue: $('#totalValue'), stats: $('#stats'), warningBox: $('#warningBox'),
    cutPlanSection: $('#cutPlanSection'), cutPlan: $('#cutPlan'), stemBar: $('#stemBar'),
    logTableSection: $('#logTableSection'), logRows: $('#logRows'), offlineStatus: $('#offlineStatus'),
    saveStem: $('#saveStem'), saveNextStem: $('#saveNextStem'), saveStemNote: $('#saveStemNote'),
    harvestSelect: $('#harvestSelect'), harvestName: $('#harvestName'), harvestState: $('#harvestState'), harvestMeta: $('#harvestMeta'),
    newHarvest: $('#newHarvest'), viewSummary: $('#viewSummary'),
    harvestSummarySection: $('#harvestSummarySection'), harvestSummaryTitle: $('#harvestSummaryTitle'), harvestSummaryStatus: $('#harvestSummaryStatus'),
    harvestStats: $('#harvestStats'), harvestRows: $('#harvestRows'), harvestEmpty: $('#harvestEmpty'), exportCsv: $('#exportCsv'), finishHarvest: $('#finishHarvest')
  };

  const STORE = 'virkesaptering-state-v2';
  const OLD_STORE = 'virkesaptering-state-v1';
  const HARVEST_STORE = 'virkesaptering-harvests-v1';
  let rowId = 0;
  let currentResult = null;
  let currentStemSaved = false;
  let harvestData = {version:1, currentId:null, harvests:[]};

  function fmt(n, digits=0) {
    return new Intl.NumberFormat('sv-SE', {minimumFractionDigits:digits, maximumFractionDigits:digits}).format(Number(n) || 0);
  }

  function isoNow() { return new Date().toISOString(); }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('sv-SE', {dateStyle:'short', timeStyle:'short'}).format(d);
  }

  function defaultHarvestName() {
    return `Avverkning ${new Intl.DateTimeFormat('sv-SE').format(new Date())}`;
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  }

  function setQualityOptions(preserve=true) {
    const old = preserve ? els.quality.value : '';
    els.quality.innerHTML = '';
    for (const q of L.QUALITY_OPTIONS[els.species.value]) {
      const o = document.createElement('option');
      o.value = q.value; o.textContent = q.label; els.quality.appendChild(o);
    }
    if ([...els.quality.options].some(o => o.value === old)) els.quality.value = old;
  }

  function qualityLabel(species, value) {
    const q = (L.QUALITY_OPTIONS[species] || []).find(x => x.value === value);
    return q ? q.label : value;
  }

  function pointRow(x='', d='') {
    const id = ++rowId;
    const row = document.createElement('div');
    row.className = 'measure-row';
    row.dataset.id = id;
    row.innerHTML = `
      <input class="px" aria-label="Avstånd från rotskäret i meter" type="number" inputmode="decimal" min="0" max="40" step="0.1" value="${x}">
      <input class="pd" aria-label="Diameter på bark i millimeter" type="number" inputmode="numeric" min="20" max="900" step="1" value="${d}">
      <button class="remove" aria-label="Ta bort mätpunkt" type="button">×</button>`;
    row.querySelector('.remove').addEventListener('click', () => { row.remove(); inputChanged(); });
    row.querySelectorAll('input').forEach(i => i.addEventListener('input', inputChanged));
    els.points.appendChild(row);
    updatePointCount();
    return row;
  }

  function getPointRows() {
    return [...els.points.querySelectorAll('.measure-row')].map(r => ({
      x: r.querySelector('.px').value,
      d: r.querySelector('.pd').value
    }));
  }

  function completePoints() {
    return getPointRows().map(p => ({x:Number(p.x), d:Number(p.d)})).filter(p => Number.isFinite(p.x) && Number.isFinite(p.d) && p.d > 0);
  }

  function updatePointCount() {
    const complete = completePoints().length;
    els.pointCount.textContent = `${complete} ifyllda / ${els.points.children.length} rader`;
  }

  function inputChanged() {
    updatePointCount();
    saveState();
    clearResults();
  }

  function generateGrid(interval) {
    const total = Number(els.stemLength.value);
    if (!Number.isFinite(total) || total < 2.9) {
      els.message.textContent = 'Ange stammens längd först.'; return;
    }
    els.points.innerHTML = '';
    const dbh = Number(els.dbhPointM.value);
    const vals = new Set();
    vals.add(0.1);
    if (Number.isFinite(dbh) && dbh > 0 && dbh < total) vals.add(Math.round(dbh*100)/100);
    for (let x=interval; x<total; x+=interval) vals.add(Math.round(x*100)/100);
    vals.add(Math.round(total*100)/100);
    [...vals].sort((a,b)=>a-b).forEach(x => pointRow(x.toFixed(x % 1 ? 2 : 1), ''));
    els.message.textContent = 'Fyll i diametern utanpå bark vid varje mätpunkt.';
    saveState(); clearResults();
    const firstEmpty = els.points.querySelector('.pd');
    if (firstEmpty) firstEmpty.focus();
  }

  function addManualPoint() {
    const row = pointRow('', '');
    row.querySelector('.px').focus();
    saveState(); clearResults();
  }

  function clearDiameters() {
    els.points.querySelectorAll('.pd').forEach(i => i.value='');
    updatePointCount(); saveState(); clearResults();
    const first = els.points.querySelector('.pd'); if (first) first.focus();
  }

  function options() {
    return {
      species: els.species.value,
      quality: els.quality.value,
      objective: els.objective.value,
      massavedQuality: els.massavedQuality.value,
      massavedTransportKm: Number(els.massavedTransport.value) || 0,
      startM: Number(els.startM.value) || 0,
      kerfMm: Number(els.kerfMm.value) || 0,
      dbhPointM: Number(els.dbhPointM.value) || 1.10,
      latitudeDeg: Number(els.latitudeDeg.value) || 64.25,
      allowUnderDimension: els.allowUnder.checked
    };
  }

  function clearResults() {
    currentResult = null;
    currentStemSaved = false;
    els.resultSection.classList.add('hidden');
    els.cutPlanSection.classList.add('hidden');
    els.logTableSection.classList.add('hidden');
    updateSaveButtons();
  }

  function stat(label, value, cls='') {
    return `<div class="stat ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function assortmentName(log) {
    if (log.assortment === 'massaved') return 'Massaved';
    if (log.underDimension) return 'Underdim.';
    return 'Timmer';
  }

  function activeHarvest() {
    return harvestData.harvests.find(h => h.id === harvestData.currentId) || null;
  }

  function harvestTotals(harvest) {
    const totals = {
      stems:0, tall:0, gran:0, timberCount:0, underCount:0, massavedCount:0,
      timberVolume:0, massavedVolume:0, volume:0, timberValue:0, massavedValue:0, transportDeductionValue:0, value:0
    };
    if (!harvest) return totals;
    for (const s of harvest.stems || []) {
      totals.stems += 1;
      if (s.species === 'tall') totals.tall += 1;
      if (s.species === 'gran') totals.gran += 1;
      totals.timberCount += Number(s.summary.normalCount) || 0;
      totals.underCount += Number(s.summary.underCount) || 0;
      totals.massavedCount += Number(s.summary.massavedCount) || 0;
      totals.timberVolume += Number(s.summary.timberVolume) || 0;
      totals.massavedVolume += Number(s.summary.massavedVolume) || 0;
      totals.volume += Number(s.summary.volume) || 0;
      totals.timberValue += Number(s.summary.timberValue) || 0;
      totals.massavedValue += Number(s.summary.massavedValue) || 0;
      totals.transportDeductionValue += Number(s.summary.transportDeductionValue) || 0;
      totals.value += Number(s.summary.value) || 0;
    }
    return totals;
  }

  function createHarvest(name) {
    const h = {
      id:makeId('harvest'),
      name:(name || defaultHarvestName()).trim() || defaultHarvestName(),
      startedAt:isoNow(),
      finishedAt:null,
      stems:[]
    };
    harvestData.harvests.unshift(h);
    harvestData.currentId = h.id;
    saveHarvestData();
    renderHarvestUI();
    return h;
  }

  function saveHarvestData() {
    try { localStorage.setItem(HARVEST_STORE, JSON.stringify(harvestData)); } catch (_) {}
  }

  function loadHarvestData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HARVEST_STORE) || 'null');
      if (parsed && Array.isArray(parsed.harvests)) harvestData = parsed;
    } catch (_) {}
    if (!Array.isArray(harvestData.harvests)) harvestData.harvests = [];
    if (!harvestData.currentId || !harvestData.harvests.some(h => h.id === harvestData.currentId)) {
      const open = harvestData.harvests.find(h => !h.finishedAt);
      if (open) harvestData.currentId = open.id;
      else if (harvestData.harvests[0]) harvestData.currentId = harvestData.harvests[0].id;
    }
    if (!harvestData.harvests.length) createHarvest(defaultHarvestName());
    else renderHarvestUI();
  }

  function renderHarvestSelect() {
    const current = harvestData.currentId;
    els.harvestSelect.innerHTML = '';
    for (const h of harvestData.harvests) {
      const t = harvestTotals(h);
      const o = document.createElement('option');
      o.value = h.id;
      o.textContent = `${h.name} · ${t.stems} st${h.finishedAt ? ' · avslutad' : ' · pågående'}`;
      els.harvestSelect.appendChild(o);
    }
    if ([...els.harvestSelect.options].some(o => o.value === current)) els.harvestSelect.value = current;
  }

  function renderHarvestHeader() {
    const h = activeHarvest();
    if (!h) return;
    const t = harvestTotals(h);
    els.harvestName.value = h.name;
    els.harvestName.disabled = !!h.finishedAt;
    els.harvestState.textContent = h.finishedAt ? 'Avslutad' : 'Pågående';
    els.harvestMeta.textContent = `${t.stems} stammar · ${fmt(t.volume,3)} m³fub* · ${fmt(t.value,0)} kr* · start ${formatDateTime(h.startedAt)}`;
  }

  function renderHarvestSummary() {
    const h = activeHarvest();
    if (!h) return;
    const t = harvestTotals(h);
    els.harvestSummaryTitle.textContent = h.name;
    els.harvestSummaryStatus.textContent = h.finishedAt ? `Avslutad ${formatDateTime(h.finishedAt)}` : 'Pågående';
    els.harvestStats.innerHTML = [
      stat('Stammar', `${t.stems} st`),
      stat('Tall / gran', `${t.tall} / ${t.gran} st`),
      stat('Timmerstockar', `${t.timberCount} st`, 'stat-timber'),
      stat('Massavedsbitar', `${t.massavedCount} st`, 'stat-pulp'),
      stat('Timmervolym*', `${fmt(t.timberVolume,3)} m³fub`, 'stat-timber'),
      stat('Massavedsvolym*', `${fmt(t.massavedVolume,3)} m³fub`, 'stat-pulp'),
      stat('Total volym*', `${fmt(t.volume,3)} m³fub`),
      stat('Timmervärde*', `${fmt(t.timberValue,0)} kr`, 'stat-timber'),
      stat('Massavedsvärde*', `${fmt(t.massavedValue,0)} kr`, 'stat-pulp'),
      stat('Transportavdrag massaved', `${fmt(t.transportDeductionValue,0)} kr`),
      stat('Totalt värde*', `${fmt(t.value,0)} kr`),
      stat('Medel/stam*', `${t.stems ? fmt(t.value/t.stems,0) : '0'} kr`),
      stat('Underdimension', `${t.underCount} st`)
    ].join('');

    els.harvestRows.innerHTML = '';
    (h.stems || []).forEach((s, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${idx+1}</strong></td><td>${s.species === 'gran' ? 'Gran' : 'Tall'}</td><td>${fmt(s.stemLength,2)} m</td><td>${s.summary.normalCount} st</td><td>${s.summary.massavedCount} st</td><td>${fmt(s.summary.volume,3)} m³fub</td><td><strong>${fmt(s.summary.value,0)} kr</strong></td><td>${formatDateTime(s.savedAt)}</td><td><button type="button" class="delete-stem" data-stem-id="${s.id}" ${h.finishedAt ? 'disabled' : ''} aria-label="Ta bort stam ${idx+1}">Ta bort</button></td>`;
      els.harvestRows.appendChild(tr);
    });
    els.harvestEmpty.classList.toggle('hidden', !!(h.stems && h.stems.length));
    els.finishHarvest.disabled = !!h.finishedAt || !h.stems.length;
    els.finishHarvest.textContent = h.finishedAt ? 'Avverkningen är avslutad' : 'Avsluta & sammanfatta';
    els.exportCsv.disabled = !h.stems.length;

    els.harvestRows.querySelectorAll('.delete-stem').forEach(btn => btn.addEventListener('click', () => {
      const current = activeHarvest();
      if (!current || current.finishedAt) return;
      const stemId = btn.dataset.stemId;
      if (!confirm('Ta bort denna stam från sammanställningen?')) return;
      current.stems = current.stems.filter(s => s.id !== stemId);
      saveHarvestData(); renderHarvestUI();
    }));
  }

  function renderHarvestUI() {
    renderHarvestSelect();
    renderHarvestHeader();
    renderHarvestSummary();
    updateSaveButtons();
  }

  function updateSaveButtons() {
    const h = activeHarvest();
    const canSave = !!currentResult && !currentStemSaved && !!h && !h.finishedAt;
    els.saveStem.disabled = !canSave;
    els.saveNextStem.disabled = !canSave;
    if (!h) els.saveStemNote.textContent = '';
    else if (h.finishedAt) els.saveStemNote.textContent = 'Vald avverkning är avslutad. Skapa en ny avverkning för att spara fler stammar.';
    else if (currentStemSaved) els.saveStemNote.textContent = 'Den här beräkningen är sparad i avverkningen.';
    else if (currentResult) els.saveStemNote.textContent = 'Spara stammen för att ta med den i sammanfattningen.';
    else els.saveStemNote.textContent = '';
  }

  function leanPlan(plan) {
    return (plan || []).map(log => ({
      assortment:log.assortment,
      label:log.label,
      normalTimber:!!log.normalTimber,
      underDimension:!!log.underDimension,
      startM:Number(log.startM)||0,
      endM:Number(log.endM)||0,
      lengthM:Number(log.lengthM)||0,
      top:{obMm:Number(log.top && log.top.obMm)||0, ubMm:Number(log.top && log.top.ubMm)||0},
      pricing:{
        price:Number(log.pricing && log.pricing.price)||0,
        base:Number(log.pricing && log.pricing.base)||0,
        deduction:Number(log.pricing && log.pricing.deduction)||0,
        cls:log.pricing && log.pricing.cls != null ? String(log.pricing.cls) : ''
      },
      volume:Number(log.volume)||0,
      value:Number(log.value)||0,
      extrapolated:!!log.extrapolated
    }));
  }

  function stemRecord(result) {
    const o = options();
    const transportDeductionValue = (result.plan || []).filter(log => log.assortment === 'massaved').reduce((sum, log) => sum + (Number(log.volume)||0) * (Number(log.pricing && log.pricing.deduction)||0), 0);
    return {
      id:makeId('stem'),
      savedAt:isoNow(),
      species:els.species.value,
      quality:els.quality.value,
      qualityLabel:qualityLabel(els.species.value, els.quality.value),
      stemLength:Number(els.stemLength.value)||0,
      objective:els.objective.value,
      massavedQuality:els.massavedQuality.value,
      massavedTransportKm:Number(els.massavedTransport.value)||0,
      startM:Number(els.startM.value)||0,
      kerfMm:Number(els.kerfMm.value)||0,
      measurementPoints:completePoints(),
      options:o,
      summary:{
        normalCount:Number(result.normalCount)||0,
        underCount:Number(result.underCount)||0,
        massavedCount:Number(result.massavedCount)||0,
        timberValue:Number(result.timberValue)||0,
        massavedValue:Number(result.massavedValue)||0,
        transportDeductionValue,
        value:Number(result.value)||0,
        timberVolume:Number(result.timberVolume)||0,
        massavedVolume:Number(result.massavedVolume)||0,
        volume:Number(result.volume)||0,
        usedLengthM:Number(result.usedLengthM)||0,
        remainingM:Number(result.remainingM)||0,
        extrapolated:!!result.extrapolated
      },
      plan:leanPlan(result.plan)
    };
  }

  function saveCurrentStem(next=false) {
    const h = activeHarvest();
    if (!h) { els.message.textContent = 'Ingen avverkning är vald.'; return; }
    if (h.finishedAt) { els.message.textContent = 'Avverkningen är avslutad. Skapa en ny avverkning först.'; return; }
    if (!currentResult || currentStemSaved) return;
    h.stems.push(stemRecord(currentResult));
    currentStemSaved = true;
    saveHarvestData();
    renderHarvestUI();
    els.message.textContent = `Stam ${h.stems.length} är sparad i ${h.name}.`;
    if (next) prepareNextStem();
  }

  function prepareNextStem() {
    els.points.querySelectorAll('.pd').forEach(i => i.value='');
    updatePointCount();
    currentResult = null;
    currentStemSaved = false;
    els.resultSection.classList.add('hidden');
    els.cutPlanSection.classList.add('hidden');
    els.logTableSection.classList.add('hidden');
    saveState();
    updateSaveButtons();
    els.message.textContent = 'Föregående stam är sparad. Fyll i diametrarna för nästa stam.';
    const first = els.points.querySelector('.pd');
    if (first) first.focus();
    const card = els.points.closest('.card');
    if (card) card.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function render(result) {
    currentResult = result;
    currentStemSaved = false;
    els.resultSection.classList.remove('hidden');
    els.cutPlanSection.classList.remove('hidden');
    els.logTableSection.classList.remove('hidden');

    els.stockCount.textContent = result.normalCount;
    els.pulpCount.textContent = result.massavedCount;
    els.resultMode.textContent = els.objective.value === 'count'
      ? 'Kapplan som först prioriterar flest normala timmerstockar och därefter värdet.'
      : 'Kapplan som jämför timmer och massaved för högsta uppskattade totalvärde.';
    els.totalValue.textContent = `${fmt(result.value, 0)} kr`;
    els.stats.innerHTML = [
      stat('Timmervärde*', `${fmt(result.timberValue,0)} kr`, 'stat-timber'),
      stat('Massavedsvärde*', `${fmt(result.massavedValue,0)} kr`, 'stat-pulp'),
      stat('Massaved transportavdrag', `${fmt(Math.min(80, 0.35*(Number(els.massavedTransport.value)||0)),2)} kr/m³fub`),
      stat('Timmervolym*', `${fmt(result.timberVolume,3)} m³fub`),
      stat('Massavedsvolym*', `${fmt(result.massavedVolume,3)} m³fub`),
      stat('Underdimension timmer', `${result.underCount} st`),
      stat('Rest efter sista bit', `${fmt(result.remainingM,2)} m`),
      stat('Använd virkeslängd', `${fmt(result.usedLengthM,2)} m`),
      stat('Totalt sortiment', `${result.plan.length} bitar`)
    ].join('');

    const warnings = [];
    if (result.extrapolated) warnings.push('Minst en del av kapplanen bygger på extrapolerad stamdiameter. Lägg gärna till en mätpunkt närmare den delen.');
    if (Number(els.massavedTransport.value) === 0 && result.massavedCount > 0) warnings.push('Massavedsvärdet visas före transportavdrag eftersom transportavståndet är satt till 0 km.');
    if (warnings.length) {
      els.warningBox.innerHTML = warnings.map(x=>`<div>${x}</div>`).join('');
      els.warningBox.classList.remove('hidden');
    } else {
      els.warningBox.classList.add('hidden');
    }

    els.cutPlan.innerHTML = '';
    result.plan.forEach((log, idx) => {
      const isPulp = log.assortment === 'massaved';
      const row = document.createElement('div');
      row.className = `cut-row ${isPulp ? 'cut-pulp' : 'cut-timber'}`;
      row.innerHTML = `<div class="cut-index">${idx+1}</div><div><strong>${fmt(log.lengthM,2)} m ${assortmentName(log).toLowerCase()}</strong><small>${fmt(log.startM,2)}–${fmt(log.endM,2)} m · topp ${fmt(log.top.ubMm,0)} mm ub</small></div><div class="cut-at"><small>Kapa vid</small><strong>${fmt(log.endM,2)} m</strong></div>`;
      els.cutPlan.appendChild(row);
    });

    els.stemBar.innerHTML = '';
    const total = result.totalLengthM;
    if (result.startM > 0) {
      const s = document.createElement('div'); s.className='stem-piece stem-rest'; s.style.width=`${result.startM/total*100}%`; s.textContent='start'; els.stemBar.appendChild(s);
    }
    result.plan.forEach((log, idx) => {
      const p = document.createElement('div');
      p.className = `stem-piece ${log.assortment === 'massaved' ? 'stem-pulp' : 'stem-timber'}`;
      p.style.width=`${log.lengthM/total*100}%`;
      p.textContent=String(idx+1);
      p.title=`${assortmentName(log)} ${idx+1}: ${fmt(log.lengthM,2)} m`;
      els.stemBar.appendChild(p);
    });
    const usedEnd = result.plan[result.plan.length-1].endM;
    if (usedEnd < total) {
      const r = document.createElement('div'); r.className='stem-piece stem-rest'; r.style.width=`${(total-usedEnd)/total*100}%`; r.textContent='rest'; els.stemBar.appendChild(r);
    }

    els.logRows.innerHTML = '';
    result.plan.forEach((log, idx) => {
      const tr = document.createElement('tr');
      const assortment = assortmentName(log);
      const klass = log.pricing.cls;
      tr.className = log.assortment === 'massaved' ? 'row-pulp' : 'row-timber';
      tr.innerHTML = `<td><strong>${idx+1}</strong></td><td><span class="sort-badge ${log.assortment === 'massaved' ? 'badge-pulp' : 'badge-timber'}">${assortment}</span></td><td>${fmt(log.startM,2)}–${fmt(log.endM,2)} m</td><td>${fmt(log.lengthM,2)} m</td><td>${fmt(log.top.obMm,0)} mm</td><td><strong>${fmt(log.top.ubMm,0)} mm</strong></td><td>${klass}</td><td>${fmt(log.pricing.price,0)} kr/m³fub</td><td>${fmt(log.volume,3)}</td><td><strong>${fmt(log.value,0)} kr</strong></td>`;
      els.logRows.appendChild(tr);
    });
    updateSaveButtons();
  }

  function calculate() {
    updatePointCount();
    const points = completePoints();
    const result = L.optimizeStem(points, Number(els.stemLength.value), options());
    if (!result.ok) {
      clearResults(); els.message.textContent = result.error; return;
    }
    render(result);
    els.message.textContent = result.extrapolated ? 'Beräkningen är klar, men delar av profilen är extrapolerade.' : 'Beräkningen är klar.';
    saveState();
    els.resultSection.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function state() {
    return {
      species:els.species.value,
      quality:els.quality.value,
      stemLength:els.stemLength.value,
      objective:els.objective.value,
      massavedQuality:els.massavedQuality.value,
      massavedTransport:els.massavedTransport.value,
      startM:els.startM.value,
      kerfMm:els.kerfMm.value,
      dbhPointM:els.dbhPointM.value,
      latitudeDeg:els.latitudeDeg.value,
      allowUnder:els.allowUnder.checked,
      points:getPointRows()
    };
  }

  function saveState() {
    try { localStorage.setItem(STORE, JSON.stringify(state())); } catch (_) {}
  }

  function loadState() {
    let s=null;
    try { s=JSON.parse(localStorage.getItem(STORE)||'null'); } catch (_) {}
    if (!s) {
      try { s=JSON.parse(localStorage.getItem(OLD_STORE)||'null'); } catch (_) {}
    }
    if (!s) return false;
    els.species.value=s.species||'tall';
    setQualityOptions(false);
    if ([...els.quality.options].some(o=>o.value===s.quality)) els.quality.value=s.quality;
    els.stemLength.value=s.stemLength||'18.0';
    els.objective.value=s.objective||'value';
    els.massavedQuality.value=s.massavedQuality||'prima';
    els.massavedTransport.value=s.massavedTransport??'0';
    els.startM.value=s.startM??'0';
    els.kerfMm.value=s.kerfMm??'0';
    els.dbhPointM.value=s.dbhPointM||'1.10';
    els.latitudeDeg.value=s.latitudeDeg||'64.25';
    els.allowUnder.checked=!!s.allowUnder;
    els.points.innerHTML='';
    (s.points||[]).forEach(p=>pointRow(p.x,p.d));
    return true;
  }

  function hasUnsavedResult() { return !!currentResult && !currentStemSaved; }

  function switchHarvest(id) {
    if (id === harvestData.currentId) return;
    if (hasUnsavedResult() && !confirm('Den beräknade stammen är inte sparad. Byta avverkning ändå?')) {
      els.harvestSelect.value = harvestData.currentId;
      return;
    }
    harvestData.currentId = id;
    saveHarvestData();
    renderHarvestUI();
  }

  function newHarvest() {
    if (hasUnsavedResult() && !confirm('Den beräknade stammen är inte sparad. Skapa ny avverkning ändå?')) return;
    const h = activeHarvest();
    if (h && !h.finishedAt && h.stems.length) {
      if (!confirm(`Avsluta "${h.name}" och skapa en ny avverkning?`)) return;
      h.finishedAt = isoNow();
    } else if (h && !h.finishedAt && !h.stems.length) {
      harvestData.harvests = harvestData.harvests.filter(x => x.id !== h.id);
    }
    createHarvest(defaultHarvestName());
    clearResults();
    els.message.textContent = 'Ny avverkning skapad.';
  }

  function finishHarvest() {
    const h = activeHarvest();
    if (!h || h.finishedAt || !h.stems.length) return;
    if (hasUnsavedResult() && !confirm('Den beräknade stammen är inte sparad. Avsluta avverkningen ändå?')) return;
    if (!confirm(`Avsluta "${h.name}" med ${h.stems.length} sparade stammar?`)) return;
    h.finishedAt = isoNow();
    saveHarvestData();
    renderHarvestUI();
    els.harvestSummarySection.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function renameHarvest() {
    const h = activeHarvest();
    if (!h || h.finishedAt) return;
    const name = els.harvestName.value.trim();
    h.name = name || defaultHarvestName();
    saveHarvestData();
    renderHarvestUI();
  }

  function csvEscape(value) {
    const s = value == null ? '' : String(value);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }

  function csvNumber(n, digits=3) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '';
    return x.toFixed(digits).replace('.', ',');
  }

  function exportCsv() {
    const h = activeHarvest();
    if (!h || !h.stems.length) return;
    const t = harvestTotals(h);
    const headers = ['Radtyp','Avverkning','Stamnr','Bitnr','Sparad','Träslag','Timmerkvalitet','Stamlängd_m','Sortiment','Från_m','Till_m','Längd_m','Topp_pb_mm','Topp_ub_mm','Klass_kvalitet','Pris_kr_m3fub','Volym_m3fub','Värde_kr','Timmer_st','Underdim_st','Massaved_st','Timmer_m3fub','Massaved_m3fub','Totalt_m3fub','Timmervärde_kr','Massavedsvärde_kr','Transportavdrag_massaved_kr','Totalt_värde_kr','Rest_m','Extrapolerad'];
    const rows = [headers];
    rows.push(['SAMMANFATTNING',h.name,'','','', '', '', '', '', '', '', '', '', '', '', '', '', '', t.timberCount, t.underCount, t.massavedCount, csvNumber(t.timberVolume), csvNumber(t.massavedVolume), csvNumber(t.volume), csvNumber(t.timberValue,2), csvNumber(t.massavedValue,2), csvNumber(t.transportDeductionValue,2), csvNumber(t.value,2), '', '']);
    h.stems.forEach((s, i) => {
      rows.push(['STAM',h.name,i+1,'',formatDateTime(s.savedAt),s.species === 'gran' ? 'Gran' : 'Tall',s.qualityLabel,csvNumber(s.stemLength,2),'','','','','','','','','','',s.summary.normalCount,s.summary.underCount,s.summary.massavedCount,csvNumber(s.summary.timberVolume),csvNumber(s.summary.massavedVolume),csvNumber(s.summary.volume),csvNumber(s.summary.timberValue,2),csvNumber(s.summary.massavedValue,2),csvNumber(s.summary.transportDeductionValue,2),csvNumber(s.summary.value,2),csvNumber(s.summary.remainingM,2),s.summary.extrapolated?'Ja':'Nej']);
      (s.plan || []).forEach((log, j) => {
        rows.push(['BIT',h.name,i+1,j+1,formatDateTime(s.savedAt),s.species === 'gran' ? 'Gran' : 'Tall',s.qualityLabel,csvNumber(s.stemLength,2),log.assortment === 'massaved' ? 'Massaved' : (log.underDimension ? 'Underdim. timmer' : 'Timmer'),csvNumber(log.startM,2),csvNumber(log.endM,2),csvNumber(log.lengthM,2),csvNumber(log.top.obMm,0),csvNumber(log.top.ubMm,0),log.pricing.cls,csvNumber(log.pricing.price,2),csvNumber(log.volume),csvNumber(log.value,2),'','','','','','','','','','','',log.extrapolated?'Ja':'Nej']);
      });
    });
    const text = '\ufeff' + rows.map(row => row.map(csvEscape).join(';')).join('\r\n');
    const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = h.name.toLowerCase().replace(/[^a-z0-9åäö_-]+/gi,'_').replace(/^_+|_+$/g,'') || 'avverkning';
    a.href = url; a.download = `${safe}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function resetAll() {
    if (!confirm('Nollställa ALL lokal data, inklusive alla sparade avverkningar och stammar? Detta går inte att ångra.')) return;
    localStorage.removeItem(STORE);
    localStorage.removeItem(OLD_STORE);
    localStorage.removeItem(HARVEST_STORE);
    location.reload();
  }

  function networkStatus() {
    els.offlineStatus.textContent = navigator.onLine ? 'Online · offlineklar' : 'Offline';
  }

  $('#grid1').addEventListener('click', ()=>generateGrid(1));
  $('#grid2').addEventListener('click', ()=>generateGrid(2));
  $('#addPoint').addEventListener('click', addManualPoint);
  $('#clearDiameters').addEventListener('click', clearDiameters);
  $('#resetAll').addEventListener('click', resetAll);
  els.calculate.addEventListener('click', calculate);
  els.saveStem.addEventListener('click', ()=>saveCurrentStem(false));
  els.saveNextStem.addEventListener('click', ()=>saveCurrentStem(true));
  els.newHarvest.addEventListener('click', newHarvest);
  els.viewSummary.addEventListener('click', ()=>els.harvestSummarySection.scrollIntoView({behavior:'smooth',block:'start'}));
  els.finishHarvest.addEventListener('click', finishHarvest);
  els.exportCsv.addEventListener('click', exportCsv);
  els.harvestName.addEventListener('change', renameHarvest);
  els.harvestSelect.addEventListener('change', e=>switchHarvest(e.target.value));
  els.species.addEventListener('change', ()=>{setQualityOptions(true);inputChanged();});
  [els.quality,els.stemLength,els.objective,els.massavedQuality,els.massavedTransport,els.startM,els.kerfMm,els.dbhPointM,els.latitudeDeg,els.allowUnder].forEach(el=>el.addEventListener('change',inputChanged));
  window.addEventListener('online',networkStatus);
  window.addEventListener('offline',networkStatus);
  networkStatus();

  setQualityOptions(false);
  if (!loadState()) generateGrid(2); else updatePointCount();
  loadHarvestData();
  updateSaveButtons();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
})();
