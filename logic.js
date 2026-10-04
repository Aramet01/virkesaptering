(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TimberLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PRICE_LIST = {
    id: 'NS46-01',
    validFrom: '2026-04-20',
    region: 'Vindeln',
    unit: 'kr/m³fub',
    diameters: [140, 160, 180, 200, 220, 240, 260, 280, 300, 400],
    lengthsCm: [340, 370, 400, 430, 460, 490, 520, 550],
    prices: {
      tall: {
        q1:  [520, 580, 630, 680, 720, 750, 780, 805, 820, 775],
        q23: [450, 470, 485, 500, 510, 515, 520, 525, 530, 500],
        q48: [440, 442, 443, 444, 445, 445, 445, 445, 445, 440]
      },
      gran: {
        q1:  [450, 480, 505, 525, 540, 555, 570, 585, 590, 550],
        q28: [440, 442, 444, 446, 448, 448, 448, 448, 448, 440]
      }
    },
    lengthCorrections: {
      tall: {340:-39, 370:-14, 400:-16, 430:4, 460:0, 490:19, 520:21, 550:23},
      gran: {340:-38, 370:-22, 400:-27, 430:7, 460:0, 490:24, 520:26, 550:28}
    },
    underDimensionPrice: 360,
    minNormalTopUbMm: 140,
    underDimensionMinUbMm: 120,
    maxDiameterUbMm: 600,
    massaved: {
      barrPrimaPrice: 410,
      barrSekundaPrice: 360,
      minLengthDm: 29,
      maxLengthDm: 57,
      minDiameterUbMm: 50,
      maxDiameterUbMm: 700,
      transportRateKrPerM3Km: 0.35,
      maxTransportDeductionKrPerM3: 80
    }
  };

  const QUALITY_OPTIONS = {
    tall: [
      {value:'q1', label:'Kvalitet 1'},
      {value:'q23', label:'Kvalitet 2 & 3'},
      {value:'q48', label:'Kvalitet 4 & 8'}
    ],
    gran: [
      {value:'q1', label:'Kvalitet 1'},
      {value:'q28', label:'Kvalitet 2 & 8'}
    ]
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sortAndValidatePoints(points) {
    const cleaned = (points || [])
      .map(p => ({x:Number(p.x), d:Number(p.d)}))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.d) && p.x >= 0 && p.d > 0)
      .sort((a,b) => a.x - b.x);

    if (cleaned.length < 3) return {ok:false, points:cleaned, error:'Minst tre kompletta mätpunkter behövs.'};
    for (let i=1; i<cleaned.length; i++) {
      if (Math.abs(cleaned[i].x - cleaned[i-1].x) < 1e-9) {
        return {ok:false, points:cleaned, error:'Två mätpunkter har samma avstånd.'};
      }
    }
    return {ok:true, points:cleaned, error:''};
  }

  function profileDiameterOb(points, x) {
    const p = points;
    if (!p || p.length < 2) return null;
    let a, b, mode = 'interpolerad';
    if (x <= p[0].x) {
      a = p[0]; b = p[1];
      mode = x < p[0].x ? 'extrapolerad' : 'uppmätt';
    } else if (x >= p[p.length - 1].x) {
      a = p[p.length - 2]; b = p[p.length - 1];
      mode = x > p[p.length - 1].x ? 'extrapolerad' : 'uppmätt';
    } else {
      for (let i=0; i<p.length-1; i++) {
        if (x >= p[i].x && x <= p[i+1].x) {
          a = p[i]; b = p[i+1];
          if (Math.abs(x-a.x)<1e-9 || Math.abs(x-b.x)<1e-9) mode = 'uppmätt';
          break;
        }
      }
    }
    if (!a || !b) return null;
    const slope = (b.d - a.d) / (b.x - a.x);
    return {d: Math.max(1, a.d + slope * (x - a.x)), mode};
  }

  // Skogforsk 2004 / StanForD bark functions. Returns DOUBLE bark thickness in mm.
  function doubleBarkThicknessMm(species, dbhObMm, diameterObMm, heightFromButtM, latitudeDeg) {
    const dbh = Number(dbhObMm);
    const dia = Number(diameterObMm);
    const hCm = Number(heightFromButtM) * 100;
    const lat = Number(latitudeDeg);
    if (![dbh, dia, hCm, lat].every(Number.isFinite) || dbh <= 0 || dia <= 0 || hCm < 0) return null;

    if (species === 'gran') {
      return Math.max(2, 0.46146 + 0.01386 * dbh + 0.03571 * dia);
    }

    const dbhB = Math.min(dbh, 590);
    const a = 72.1814 + 0.0789 * dbhB - 0.9868 * lat;
    const k = 0.0078557 - 0.0000132 * dbhB;
    if (!(a > 0) || !(k > 0)) return 2;
    const hTg = -Math.log(0.12 / a) / k;
    let db = 3.5808 + 0.0109 * dbhB + a * Math.exp(-k * hCm);
    if (hCm > hTg) db = 3.5808 + 0.0109 * dbhB + 0.12 - 0.005 * (hCm - hTg);
    return Math.max(2, db);
  }

  function diameterUbAt(points, x, options) {
    const ob = profileDiameterOb(points, x);
    if (!ob) return null;
    const dbhPointM = Number(options.dbhPointM);
    const dbhProfile = profileDiameterOb(points, dbhPointM);
    const dbhObMm = Number.isFinite(Number(options.dbhOverrideMm)) && Number(options.dbhOverrideMm) > 0
      ? Number(options.dbhOverrideMm)
      : dbhProfile && dbhProfile.d;
    if (!dbhObMm) return null;
    const bark = doubleBarkThicknessMm(options.species, dbhObMm, ob.d, x, options.latitudeDeg);
    if (!Number.isFinite(bark)) return null;
    return {
      obMm: ob.d,
      ubMm: Math.max(0, ob.d - bark),
      doubleBarkMm: bark,
      mode: ob.mode,
      dbhObMm
    };
  }

  function diameterClass(ubMm) {
    if (!Number.isFinite(ubMm) || ubMm < PRICE_LIST.minNormalTopUbMm) return null;
    let cls = PRICE_LIST.diameters[0];
    for (const v of PRICE_LIST.diameters) if (ubMm >= v) cls = v;
    return cls;
  }

  function basePrice(species, quality, cls) {
    const arr = PRICE_LIST.prices[species] && PRICE_LIST.prices[species][quality];
    const idx = PRICE_LIST.diameters.indexOf(cls);
    return arr && idx >= 0 ? arr[idx] : null;
  }

  function correctedPrice(species, quality, topUbMm, lengthCm) {
    if (topUbMm >= PRICE_LIST.underDimensionMinUbMm && topUbMm < PRICE_LIST.minNormalTopUbMm) {
      return {price:PRICE_LIST.underDimensionPrice, cls:'120–139', underDimension:true, base:PRICE_LIST.underDimensionPrice, correction:0};
    }
    const cls = diameterClass(topUbMm);
    if (cls == null) return null;
    const base = basePrice(species, quality, cls);
    const correction = PRICE_LIST.lengthCorrections[species][lengthCm];
    if (!Number.isFinite(base) || !Number.isFinite(correction)) return null;
    return {price:base + correction, cls, underDimension:false, base, correction};
  }

  function massavedPrice(options) {
    const quality = options.massavedQuality === 'sekunda' ? 'sekunda' : 'prima';
    const base = quality === 'sekunda' ? PRICE_LIST.massaved.barrSekundaPrice : PRICE_LIST.massaved.barrPrimaPrice;
    const km = Math.max(0, Number(options.massavedTransportKm) || 0);
    const deduction = Math.min(PRICE_LIST.massaved.maxTransportDeductionKrPerM3, PRICE_LIST.massaved.transportRateKrPerM3Km * km);
    return {quality, base, km, deduction, price:Math.max(0, base - deduction)};
  }

  // Field estimate of solid volume under bark by frustum integration through the measured profile.
  function estimateVolumeFub(points, startM, endM, options, stepM) {
    const step = clamp(Number(stepM) || 0.10, 0.02, 0.50);
    if (!(endM > startM)) return 0;
    let volume = 0;
    for (let a=startM; a<endM-1e-9; a += step) {
      const b = Math.min(endM, a + step);
      const d1 = diameterUbAt(points, a, options);
      const d2 = diameterUbAt(points, b, options);
      if (!d1 || !d2) return null;
      const r1 = d1.ubMm / 2000;
      const r2 = d2.ubMm / 2000;
      const len = b - a;
      volume += Math.PI * len * (r1*r1 + r1*r2 + r2*r2) / 3;
    }
    return volume;
  }

  function diameterRangeUb(points, startM, endM, options) {
    let min = Infinity;
    let max = 0;
    let extrapolated = false;
    const step = 0.10;
    for (let x=startM; x<endM; x+=step) {
      const d = diameterUbAt(points, x, options);
      if (!d) return null;
      min = Math.min(min, d.ubMm);
      max = Math.max(max, d.ubMm);
      if (d.mode === 'extrapolerad') extrapolated = true;
    }
    const end = diameterUbAt(points, endM, options);
    if (!end) return null;
    min = Math.min(min, end.ubMm);
    max = Math.max(max, end.ubMm);
    if (end.mode === 'extrapolerad') extrapolated = true;
    return {min, max, extrapolated};
  }

  function evaluateTimberLog(points, startM, lengthCm, options) {
    const lengthM = lengthCm / 100;
    const endM = startM + lengthM;
    // Fältapproximation: toppdiameter tas 10 cm från stockens topp.
    const topMeasureM = Math.max(startM, endM - 0.10);
    const top = diameterUbAt(points, topMeasureM, options);
    if (!top) return null;

    const range = diameterRangeUb(points, startM, endM, options);
    if (!range) return null;
    if (range.max > PRICE_LIST.maxDiameterUbMm) {
      return {valid:false, reason:'Över 600 mm ub på grövsta delen', assortment:'timmer', startM, endM, lengthCm, top, maxUb:range.max};
    }

    const pricing = correctedPrice(options.species, options.quality, top.ubMm, lengthCm);
    if (!pricing || top.ubMm < PRICE_LIST.underDimensionMinUbMm) {
      return {valid:false, reason:'Toppdiameter under 120 mm ub', assortment:'timmer', startM, endM, lengthCm, top, maxUb:range.max};
    }
    if (pricing.underDimension && !options.allowUnderDimension) {
      return {valid:false, reason:'Underdimension är avstängd', assortment:'timmer', startM, endM, lengthCm, top, maxUb:range.max};
    }

    const volume = estimateVolumeFub(points, startM, endM, options, 0.10);
    if (!Number.isFinite(volume)) return null;
    const value = volume * pricing.price;
    return {
      valid:true,
      assortment:'timmer',
      label:pricing.underDimension ? 'Underdimension timmer' : 'Timmer',
      normalTimber: !pricing.underDimension,
      underDimension: pricing.underDimension,
      startM,
      endM,
      lengthCm,
      lengthM,
      top,
      minUb:range.min,
      maxUb:range.max,
      pricing,
      volume,
      value,
      extrapolated:range.extrapolated || startM < points[0].x || endM > points[points.length-1].x
    };
  }

  function evaluateMassavedLog(points, startM, lengthDm, options) {
    const lengthM = lengthDm / 10;
    const endM = startM + lengthM;
    const top = diameterUbAt(points, endM, options);
    if (!top) return null;
    const range = diameterRangeUb(points, startM, endM, options);
    if (!range) return null;
    if (range.min < PRICE_LIST.massaved.minDiameterUbMm) {
      return {valid:false, reason:'Under 50 mm ub', assortment:'massaved', startM, endM, lengthDm, top};
    }
    if (range.max > PRICE_LIST.massaved.maxDiameterUbMm) {
      return {valid:false, reason:'Över 700 mm ub', assortment:'massaved', startM, endM, lengthDm, top};
    }
    const pricing = massavedPrice(options);
    const volume = estimateVolumeFub(points, startM, endM, options, 0.10);
    if (!Number.isFinite(volume)) return null;
    return {
      valid:true,
      assortment:'massaved',
      label:'Barrmassaved',
      normalTimber:false,
      underDimension:false,
      startM,
      endM,
      lengthDm,
      lengthM,
      top,
      minUb:range.min,
      maxUb:range.max,
      pricing:{price:pricing.price, base:pricing.base, deduction:pricing.deduction, cls:pricing.quality === 'sekunda' ? 'Sekunda' : 'Prima', correction:0},
      volume,
      value:volume * pricing.price,
      extrapolated:range.extrapolated || startM < points[0].x || endM > points[points.length-1].x
    };
  }

  function optimizeStem(pointsInput, totalLengthM, options) {
    const validation = sortAndValidatePoints(pointsInput);
    if (!validation.ok) return {ok:false, error:validation.error, plan:[]};
    const points = validation.points;
    const requestedTotal = Number(totalLengthM);
    const measuredEndM = points[points.length - 1].x;
    const totalM = Number.isFinite(requestedTotal) && requestedTotal > 0 ? Math.min(requestedTotal, measuredEndM) : measuredEndM;
    const startM = Math.max(0, Number(options.startM) || 0);
    const kerfM = Math.max(0, Number(options.kerfMm) || 0) / 1000;
    const objective = options.objective === 'count' ? 'count' : 'value';
    if (!Number.isFinite(totalM) || totalM < 2.9) return {ok:false,error:'Sista kompletta mätpunkten måste ligga minst 2,90 m från rotskäret.',plan:[]};
    if (startM >= totalM) return {ok:false,error:'Startpunkten ligger efter stammens slut.',plan:[]};

    const totalMm = Math.round(totalM * 1000);
    const startMm = Math.round(startM * 1000);
    const kerfMm = Math.round(kerfM * 1000);
    const memo = new Map();

    function emptyResult() {
      return {normalCount:0,underCount:0,massavedCount:0,timberValue:0,massavedValue:0,value:0,timberVolume:0,massavedVolume:0,volume:0,usedLengthM:0,plan:[]};
    }

    function scoreBetter(a, b) {
      if (!b) return true;
      if (objective === 'count') {
        if (a.normalCount !== b.normalCount) return a.normalCount > b.normalCount;
        if (Math.abs(a.value-b.value)>1e-8) return a.value > b.value;
        return a.usedLengthM > b.usedLengthM;
      }
      if (Math.abs(a.value - b.value) > 1e-8) return a.value > b.value;
      if (a.normalCount !== b.normalCount) return a.normalCount > b.normalCount;
      return a.usedLengthM > b.usedLengthM;
    }

    function addLog(log, child) {
      const timber = log.assortment === 'timmer';
      const massaved = log.assortment === 'massaved';
      return {
        normalCount:(log.normalTimber ? 1 : 0)+child.normalCount,
        underCount:(log.underDimension ? 1 : 0)+child.underCount,
        massavedCount:(massaved ? 1 : 0)+child.massavedCount,
        timberValue:(timber ? log.value : 0)+child.timberValue,
        massavedValue:(massaved ? log.value : 0)+child.massavedValue,
        value:log.value+child.value,
        timberVolume:(timber ? log.volume : 0)+child.timberVolume,
        massavedVolume:(massaved ? log.volume : 0)+child.massavedVolume,
        volume:log.volume+child.volume,
        usedLengthM:log.lengthM+child.usedLengthM,
        plan:[log].concat(child.plan)
      };
    }

    function solve(posMm) {
      if (memo.has(posMm)) return memo.get(posMm);
      let best = emptyResult();

      for (const lengthCm of PRICE_LIST.lengthsCm) {
        const lenMm = lengthCm * 10;
        const endMm = posMm + lenMm;
        if (endMm > totalMm) continue;
        const log = evaluateTimberLog(points, posMm/1000, lengthCm, options);
        if (!log || !log.valid) continue;
        const nextMm = endMm + kerfMm;
        const child = nextMm <= totalMm ? solve(nextMm) : emptyResult();
        const candidate = addLog(log, child);
        if (scoreBetter(candidate, best)) best = candidate;
      }

      for (let lengthDm=PRICE_LIST.massaved.minLengthDm; lengthDm<=PRICE_LIST.massaved.maxLengthDm; lengthDm++) {
        const lenMm = lengthDm * 100;
        const endMm = posMm + lenMm;
        if (endMm > totalMm) continue;
        const log = evaluateMassavedLog(points, posMm/1000, lengthDm, options);
        if (!log || !log.valid) continue;
        const nextMm = endMm + kerfMm;
        const child = nextMm <= totalMm ? solve(nextMm) : emptyResult();
        const candidate = addLog(log, child);
        if (scoreBetter(candidate, best)) best = candidate;
      }

      memo.set(posMm, best);
      return best;
    }

    const result = solve(startMm);
    if (!result.plan.length) {
      return {ok:false,error:'Ingen giltig timmer- eller massavedsbit kunde apteras från vald startpunkt.',plan:[],points};
    }

    const finalEnd = result.plan[result.plan.length-1].endM;
    return {
      ok:true,
      error:'',
      points,
      ...result,
      totalLengthM:totalM,
      startM,
      remainingM:Math.max(0,totalM-finalEnd),
      extrapolated:result.plan.some(x=>x.extrapolated)
    };
  }

  return {
    PRICE_LIST,
    QUALITY_OPTIONS,
    sortAndValidatePoints,
    profileDiameterOb,
    doubleBarkThicknessMm,
    diameterUbAt,
    diameterClass,
    correctedPrice,
    massavedPrice,
    estimateVolumeFub,
    evaluateTimberLog,
    evaluateMassavedLog,
    optimizeStem
  };
});
