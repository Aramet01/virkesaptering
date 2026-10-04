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
    logTableSection: $('#logTableSection'), logRows: $('#logRows'), offlineStatus: $('#offlineStatus')
  };

  const STORE = 'virkesaptering-state-v2';
  const OLD_STORE = 'virkesaptering-state-v1';
  let rowId = 0;

  function fmt(n, digits=0) {
    return new Intl.NumberFormat('sv-SE', {minimumFractionDigits:digits, maximumFractionDigits:digits}).format(n);
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

  function pointRow(x='', d='') {
    const id = ++rowId;
    const row = document.createElement('div');
    row.className = 'measure-row';
    row.dataset.id = id;
    row.innerHTML = `
      <input class="px" aria-label="Avstånd från rotskäret i meter" type="number" inputmode="decimal" min="0" max="40" step="0.1" value="${x}">
      <input class="pd" aria-label="Diameter på bark i millimeter" type="number" inputmode="numeric" min="20" max="900" step="1" value="${d}">
      <button class="remove" aria-label="Ta bort mätpunkt" type="button">×</button>`;
    row.querySelector('.remove').addEventListener('click', () => { row.remove(); updatePointCount(); saveState(); clearResults(); });
    row.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { updatePointCount(); saveState(); clearResults(); }));
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
    els.resultSection.classList.add('hidden');
    els.cutPlanSection.classList.add('hidden');
    els.logTableSection.classList.add('hidden');
  }

  function stat(label, value, cls='') {
    return `<div class="stat ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function assortmentName(log) {
    if (log.assortment === 'massaved') return 'Massaved';
    if (log.underDimension) return 'Underdim.';
    return 'Timmer';
  }

  function render(result) {
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
      const klass = log.assortment === 'massaved' ? log.pricing.cls : log.pricing.cls;
      tr.className = log.assortment === 'massaved' ? 'row-pulp' : 'row-timber';
      tr.innerHTML = `<td><strong>${idx+1}</strong></td><td><span class="sort-badge ${log.assortment === 'massaved' ? 'badge-pulp' : 'badge-timber'}">${assortment}</span></td><td>${fmt(log.startM,2)}–${fmt(log.endM,2)} m</td><td>${fmt(log.lengthM,2)} m</td><td>${fmt(log.top.obMm,0)} mm</td><td><strong>${fmt(log.top.ubMm,0)} mm</strong></td><td>${klass}</td><td>${fmt(log.pricing.price,0)} kr/m³fub</td><td>${fmt(log.volume,3)}</td><td><strong>${fmt(log.value,0)} kr</strong></td>`;
      els.logRows.appendChild(tr);
    });
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

  function resetAll() {
    if (!confirm('Nollställa alla sparade mätdata?')) return;
    localStorage.removeItem(STORE);
    localStorage.removeItem(OLD_STORE);
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
  els.species.addEventListener('change', ()=>{setQualityOptions(true);saveState();clearResults();});
  [els.quality,els.stemLength,els.objective,els.massavedQuality,els.massavedTransport,els.startM,els.kerfMm,els.dbhPointM,els.latitudeDeg,els.allowUnder].forEach(el=>el.addEventListener('change',()=>{saveState();clearResults();}));
  window.addEventListener('online',networkStatus);
  window.addEventListener('offline',networkStatus);
  networkStatus();

  setQualityOptions(false);
  if (!loadState()) generateGrid(2); else updatePointCount();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
})();
