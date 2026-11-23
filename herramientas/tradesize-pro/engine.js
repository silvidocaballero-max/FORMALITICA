/* TradeSize Pro · motor de cálculo (port exacto de la capa de dominio de la app).
   Aritmética con fracciones exactas (BigInt). Solo se redondea al mostrar. */
(function (root) {
  "use strict";
  const B = BigInt;
  const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
  class Q {
    constructor(n, d = 1n) {
      if (d === 0n) throw new Error("División por cero");
      if (d < 0n) { n = -n; d = -d; }
      const g = gcd(n, d) || 1n; this.n = n / g; this.d = d / g;
    }
    static of(x) { return x instanceof Q ? x : Q.parse(String(x)); }
    static parse(s) {
      s = String(s).trim().replace(/\s/g, "").replace(",", ".");
      if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
      const neg = s.startsWith("-"); if (neg) s = s.slice(1);
      const [i, f = ""] = s.split(".");
      const n = B((i || "0") + f), d = 10n ** B(f.length);
      return new Q(neg ? -n : n, d);
    }
    static int(k) { return new Q(B(k)); }
    add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
    div(o) { o = Q.of(o); return new Q(this.n * o.d, this.d * o.n); }
    cmp(o) { o = Q.of(o); const a = this.n * o.d, b = o.n * this.d; return a < b ? -1 : a > b ? 1 : 0; }
    lt(o) { return this.cmp(o) < 0; } le(o) { return this.cmp(o) <= 0; }
    gt(o) { return this.cmp(o) > 0; } ge(o) { return this.cmp(o) >= 0; } eq(o) { return this.cmp(o) === 0; }
    abs() { return new Q(this.n < 0n ? -this.n : this.n, this.d); }
    floor() { let q = this.n / this.d; if (this.n < 0n && q * this.d !== this.n) q -= 1n; return q; }
    ceil() { let q = this.n / this.d; if (this.n > 0n && q * this.d !== this.n) q += 1n; return q; }
    isInt() { return this.d === 1n; }
    /* Redondeo a `scale` decimales: half-up (mostrar) o hacia arriba (riesgos y costes). */
    scaled(scale, mode) {
      const m = 10n ** B(scale), x = this.mul(new Q(m));
      let k;
      if (mode === "ceil") k = x.ceil();
      else { const t = x.abs().add(new Q(1n, 2n)).floor(); k = x.n < 0n ? -t : t; }
      return { k, scale };
    }
    toFixed(scale, mode) {
      const { k } = this.scaled(scale, mode);
      const neg = k < 0n; let s = (neg ? -k : k).toString().padStart(scale + 1, "0");
      const i = s.slice(0, s.length - scale), f = scale ? s.slice(s.length - scale) : "";
      return (neg ? "-" : "") + i + (f ? "." + f : "");
    }
    toNumber() { return Number(this.n) / Number(this.d); }
  }
  const ZERO = Q.int(0), ONE = Q.int(1), HUNDRED = Q.int(100);
  const qmin = (a, b) => a.le(b) ? a : b, qmax = (a, b) => a.ge(b) ? a : b;
  const scaleOf = s => { s = String(s); const p = s.indexOf("."); return p < 0 ? 0 : s.length - p - 1; };

  class CalcError extends Error { constructor(field, message) { super(message); this.field = field; } }

  const CURRENCIES = [
    ["EUR", "Euro", "€"], ["USD", "Dólar estadounidense", "$"], ["GBP", "Libra esterlina", "£"],
    ["JPY", "Yen japonés", "¥"], ["CHF", "Franco suizo", "CHF"], ["CAD", "Dólar canadiense", "C$"],
    ["AUD", "Dólar australiano", "A$"], ["NZD", "Dólar neozelandés", "NZ$"]
  ];
  const symbolOf = c => (CURRENCIES.find(x => x[0] === c) || [c, c, c])[2];

  const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "USD/CAD", "AUD/USD", "NZD/USD", "EUR/GBP", "EUR/JPY",
    "GBP/JPY", "EUR/CHF", "EUR/AUD", "EUR/CAD", "GBP/CHF", "AUD/JPY", "CAD/JPY", "CHF/JPY", "AUD/NZD"];
  function pairInfo(symbol) {
    const [base, quote] = symbol.split("/");
    const jpy = quote === "JPY";
    return { symbol, base, quote, pipSize: jpy ? "0.01" : "0.0001", priceDecimals: jpy ? 3 : 5 };
  }

  /* Contratos verificados con CME Group (noviembre de 2026). Comisiones a 0 por defecto. */
  const FUTURES = [
    { symbol: "MES", name: "Micro E-mini S&P 500", market: "Índices", type: "Micro", tickSize: "0.25", tickValue: "1.25", multiplier: "5" },
    { symbol: "ES", name: "E-mini S&P 500", market: "Índices", type: "E-mini", tickSize: "0.25", tickValue: "12.50", multiplier: "50" },
    { symbol: "MNQ", name: "Micro E-mini Nasdaq-100", market: "Índices", type: "Micro", tickSize: "0.25", tickValue: "0.50", multiplier: "2" },
    { symbol: "NQ", name: "E-mini Nasdaq-100", market: "Índices", type: "E-mini", tickSize: "0.25", tickValue: "5.00", multiplier: "20" },
    { symbol: "MGC", name: "Micro Oro", market: "Metales", type: "Micro", tickSize: "0.10", tickValue: "1.00", multiplier: "10" },
    { symbol: "GC", name: "Oro", market: "Metales", type: "Estándar", tickSize: "0.10", tickValue: "10.00", multiplier: "100" }
  ].map(f => Object.assign({ currency: "USD", commissionPerSide: "0", extraCost: "0" }, f));

  function num(v) { if (v === null || v === undefined || String(v).trim() === "") return null; const q = Q.parse(v); return q; }

  function resolveBudget(capitalS, mode, valueS) {
    const capital = num(capitalS), value = num(valueS);
    if (capital === null) throw new CalcError("capital", "Introduce el capital de la cuenta.");
    if (capital.le(ZERO)) throw new CalcError("capital", "El capital debe ser mayor que cero.");
    if (value === null) throw new CalcError("risk", "Introduce cuánto quieres arriesgar.");
    if (value.le(ZERO)) throw new CalcError("risk", "El riesgo debe ser mayor que cero.");
    let money, percent;
    if (mode === "money") { money = value; percent = money.div(capital).mul(HUNDRED); }
    else { percent = value; money = capital.mul(percent).div(HUNDRED); }
    if (money.gt(capital)) throw new CalcError("risk", "El riesgo no puede ser mayor que el capital de la cuenta.");
    return { capital, money, percent, mode };
  }

  function requirePrice(v, field, missing) {
    const q = num(v);
    if (q === null) throw new CalcError(field, missing);
    if (q.le(ZERO)) throw new CalcError(field, "El precio debe ser mayor que cero.");
    return q;
  }
  function validateDirection(direction, entry, stop) {
    if (entry.eq(stop)) throw new CalcError("stopLoss", "El Stop Loss no puede ser igual al precio de entrada.");
    if (direction === "long" && stop.gt(entry)) throw new CalcError("stopLoss", "En una compra, el Stop Loss debe estar por debajo del precio de entrada.");
    if (direction === "short" && stop.lt(entry)) throw new CalcError("stopLoss", "En una venta, el Stop Loss debe estar por encima del precio de entrada.");
  }
  function takeProfit(entry, stop, direction, multiple) {
    const dist = entry.sub(stop).abs().mul(Q.int(multiple));
    return direction === "long" ? entry.add(dist) : entry.sub(dist);
  }
  function manualConversion(from, to, rateS) {
    const rate = num(rateS);
    if (rate === null) throw new CalcError("conversionRate", `Necesitamos el tipo de cambio ${to}/${from} para pasar el resultado a ${to}. Introduce cuántos ${from} equivalen a 1 ${to}.`);
    if (rate.le(ZERO)) throw new CalcError("conversionRate", "El tipo de cambio debe ser mayor que cero.");
    return { factor: ONE.div(rate), source: "manual", manualRate: String(rateS).replace(",", ".") };
  }

  const forexNeedsRate = (pairSymbol, account) => { const p = pairInfo(pairSymbol); return account !== p.quote && account !== p.base; };

  /* input: { pair, direction, capital, account, riskMode, risk, entry, stop, rate,
              costs: { contractSize, lotStep, commissionOpen, commissionClose, commissionType: 'perLot'|'percent', spreadPips, brokerConfigured } } */
  function calcForex(input) {
    const budget = resolveBudget(input.capital, input.riskMode, input.risk);
    const entry = requirePrice(input.entry, "entry", "Introduce el precio de entrada.");
    const stop = requirePrice(input.stop, "stopLoss", "Introduce el precio del Stop Loss.");
    validateDirection(input.direction, entry, stop);
    const c = input.costs;
    const contract = num(c.contractSize), step = num(c.lotStep);
    const cOpen = num(c.commissionOpen) || ZERO, cClose = num(c.commissionClose) || ZERO, spread = num(c.spreadPips) || ZERO;
    if (contract === null || contract.le(ZERO)) throw new CalcError("contractSize", "El tamaño de contrato debe ser mayor que cero.");
    if (step === null || step.le(ZERO)) throw new CalcError("lotStep", "El incremento mínimo de lotaje debe ser mayor que cero.");
    if (cOpen.lt(ZERO) || cClose.lt(ZERO) || spread.lt(ZERO)) throw new CalcError("costs", "Las comisiones y el spread no pueden ser negativos.");

    const pair = pairInfo(input.pair), acc = input.account;
    let conv;
    if (acc === pair.quote) conv = { factor: ONE, source: "same" };
    else if (acc === pair.base) conv = { factor: ONE.div(qmin(entry, stop)), source: "fromPairPrice" };
    else conv = manualConversion(pair.quote, acc, input.rate);
    const cv = x => x.mul(conv.factor);

    const pipSize = Q.parse(pair.pipSize);
    const priceDistance = entry.sub(stop).abs();
    const pips = priceDistance.div(pipSize);
    const pipValuePerLot = cv(pipSize.mul(contract));
    const lossPerLot = cv(priceDistance.mul(contract));
    let commOpen, commClose;
    if (c.commissionType !== "percent") { commOpen = cOpen; commClose = cClose; }
    else {
      commOpen = cv(contract.mul(entry)).mul(cOpen).div(HUNDRED);
      commClose = cv(contract.mul(qmax(entry, stop))).mul(cClose).div(HUNDRED);
    }
    const spreadCostPerLot = spread.mul(pipValuePerLot);
    const riskPerLot = lossPerLot.add(commOpen).add(commClose).add(spreadCostPerLot);
    const rawLots = budget.money.div(riskPerLot);
    const lots = Q.int(0).add(new Q(rawLots.div(step).floor())).mul(step);
    const stopLossLoss = lossPerLot.mul(lots);
    const totalCosts = commOpen.add(commClose).add(spreadCostPerLot).mul(lots);
    const totalRisk = riskPerLot.mul(lots);
    if (totalRisk.gt(budget.money)) throw new Error("Error interno: el riesgo calculado supera el presupuesto.");

    const warnings = [];
    if (!c.brokerConfigured) warnings.push("No hay ningún broker configurado: las comisiones y el spread no están incluidos.");
    if (conv.source === "manual") warnings.push("Se ha usado un tipo de cambio introducido manualmente. Revísalo si ha pasado tiempo.");
    if (budget.percent.gt(Q.int(2))) warnings.push("Estás arriesgando más del 2 % de tu capital en una sola operación.");
    const tp1 = takeProfit(entry, stop, input.direction, 1), tp2 = takeProfit(entry, stop, input.direction, 2);
    if (tp2.le(ZERO)) warnings.push("El Take Profit 1:2 quedaría en un precio no válido (cero o negativo).");

    const stepScale = scaleOf(c.lotStep);
    const details = [
      ["money", "Valor del pip (1 lote)", pipValuePerLot, 4],
      ["money", "Valor del pip (tu posición)", pipValuePerLot.mul(lots), 4],
      ["money", "Pérdida hasta el SL por lote", lossPerLot],
      ["money", "Comisión de apertura por lote", commOpen],
      ["money", "Comisión de cierre por lote", commClose],
      ["money", "Coste de spread por lote", spreadCostPerLot],
      ["money", "Riesgo total por lote", riskPerLot],
      ["text", "Tamaño de contrato", `${c.contractSize} unidades`],
      ["text", "Incremento mínimo", `${c.lotStep} lotes`],
      ["number", "Lotes sin redondear", rawLots, 4]
    ];
    if (conv.manualRate) details.push(["text", "Tipo de cambio usado", `1 ${acc} = ${conv.manualRate} ${pair.quote}`]);
    return {
      market: "forex", instrument: pair.symbol, direction: input.direction, account: acc, priceDecimals: pair.priceDecimals,
      entry, stop, tp1, tp2, size: lots, sizeUnit: "lotes", sizeDecimals: stepScale < 2 ? 2 : stepScale,
      units: lots.mul(contract), budget, totalRisk, totalRiskPercent: totalRisk.div(budget.capital).mul(HUNDRED),
      stopLossLoss, totalCosts, distance: pips, distanceUnit: "pips", priceDistance,
      net1: stopLossLoss.mul(Q.int(1)).sub(totalCosts), net2: stopLossLoss.mul(Q.int(2)).sub(totalCosts),
      minimumRiskNeeded: riskPerLot.mul(step), warnings, details, brokerConfigured: !!c.brokerConfigured,
      canTrade: lots.gt(ZERO),
      _raw: { pipValuePerLot, lossPerLot, commOpen, commClose, spreadCostPerLot, riskPerLot, rawLots, conv }
    };
  }

  /* input: { instrument:{tickSize,tickValue,currency,commissionPerSide,extraCost,symbol,name,type}, direction, capital, account, riskMode, risk, entry, stop, rate } */
  function calcFutures(input) {
    const inst = input.instrument;
    if (!inst) throw new CalcError("instrument", "Elige un contrato de futuros.");
    const tickSize = num(inst.tickSize), tickValue = num(inst.tickValue);
    const comm = num(inst.commissionPerSide) || ZERO, extra = num(inst.extraCost) || ZERO;
    if (tickSize === null || tickValue === null || tickSize.le(ZERO) || tickValue.le(ZERO))
      throw new CalcError("instrument", "El tamaño y el valor del tick del contrato deben ser mayores que cero.");
    if (comm.lt(ZERO) || extra.lt(ZERO)) throw new CalcError("costs", "Las comisiones y costes no pueden ser negativos.");
    const budget = resolveBudget(input.capital, input.riskMode, input.risk);
    const entry = requirePrice(input.entry, "entry", "Introduce el precio de entrada.");
    const stop = requirePrice(input.stop, "stopLoss", "Introduce el precio del Stop Loss.");
    validateDirection(input.direction, entry, stop);

    const conv = input.account === inst.currency ? { factor: ONE, source: "same" } : manualConversion(inst.currency, input.account, input.rate);
    const cv = x => x.mul(conv.factor);
    const distance = entry.sub(stop).abs();
    const exactTicks = distance.div(tickSize);
    const ticks = exactTicks.ceil();
    const lossPerContract = cv(new Q(ticks).mul(tickValue));
    const commissionPerContract = cv(comm.mul(Q.int(2)));
    const extraPerContract = cv(extra);
    const riskPerContract = lossPerContract.add(commissionPerContract).add(extraPerContract);
    const contracts = budget.money.div(riskPerContract).floor();
    const cQ = new Q(contracts);
    const totalRisk = riskPerContract.mul(cQ);
    if (totalRisk.gt(budget.money)) throw new Error("Error interno: el riesgo calculado supera el presupuesto.");

    const warnings = [];
    if (!exactTicks.isInt()) warnings.push(`La distancia no es múltiplo exacto del tick (${inst.tickSize}). Se ha redondeado al alza a ${ticks} ticks.`);
    if (comm.eq(ZERO)) warnings.push("Este contrato no tiene comisiones configuradas: el cálculo no las incluye.");
    if (conv.source === "manual") warnings.push("Se ha usado un tipo de cambio introducido manualmente. Revísalo si ha pasado tiempo.");
    if (budget.percent.gt(Q.int(2))) warnings.push("Estás arriesgando más del 2 % de tu capital en una sola operación.");
    const tp1 = takeProfit(entry, stop, input.direction, 1), tp2 = takeProfit(entry, stop, input.direction, 2);
    if (tp2.le(ZERO)) warnings.push("El Take Profit 1:2 quedaría en un precio no válido (cero o negativo).");

    const ps = scaleOf(inst.tickSize);
    const stopLossLoss = lossPerContract.mul(cQ), totalCosts = commissionPerContract.add(extraPerContract).mul(cQ);
    const details = [
      ["text", "Contrato", `${inst.name} (${inst.type})`],
      ["text", "Tamaño del tick", `${inst.tickSize} puntos`],
      ["text", "Valor del tick", `${inst.tickValue} ${inst.currency}`],
      ["money", "Pérdida hasta el SL por contrato", lossPerContract],
      ["money", "Comisiones ida y vuelta por contrato", commissionPerContract],
      ["money", "Costes adicionales por contrato", extraPerContract],
      ["money", "Riesgo total por contrato", riskPerContract]
    ];
    if (conv.manualRate) details.push(["text", "Tipo de cambio usado", `1 ${input.account} = ${conv.manualRate} ${inst.currency}`]);
    return {
      market: "futures", instrument: inst.symbol, direction: input.direction, account: input.account, priceDecimals: ps < 2 ? 2 : ps,
      entry, stop, tp1, tp2, size: cQ, sizeUnit: "contratos", sizeDecimals: 0, units: null,
      budget, totalRisk, totalRiskPercent: totalRisk.div(budget.capital).mul(HUNDRED), stopLossLoss, totalCosts,
      distance: new Q(ticks), distanceUnit: "ticks", priceDistance: distance,
      net1: stopLossLoss.sub(totalCosts), net2: stopLossLoss.mul(Q.int(2)).sub(totalCosts),
      minimumRiskNeeded: riskPerContract, warnings, details, brokerConfigured: comm.gt(ZERO), canTrade: contracts > 0n,
      _raw: { lossPerContract, commissionPerContract, extraPerContract, riskPerContract, ticks, contracts }
    };
  }

  /* Formato de España: punto para miles, coma para decimales. */
  function group(d) { return d.replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function fmtFixed(s, trim) {
    let neg = s.startsWith("-"); if (neg) s = s.slice(1);
    let [i, f = ""] = s.split(".");
    if (trim) f = f.replace(/0+$/, "");
    const body = group(i) + (f ? "," + f : "");
    return neg && !/^[0.,]+$/.test(body) ? "-" + body : body;
  }
  const fmt = {
    number: (q, dec, trim) => fmtFixed(q.toFixed(dec), trim),
    money: (q, cur, dec = 2) => fmtFixed(q.toFixed(dec)) + " " + symbolOf(cur),
    moneyUp: (q, cur, dec = 2) => fmtFixed(q.toFixed(dec, "ceil")) + " " + symbolOf(cur),
    percent: (q, dec = 2) => fmtFixed(q.toFixed(dec)) + " %",
    price: (q, dec) => fmtFixed(q.toFixed(dec))
  };

  root.TradeSize = { Q, CalcError, CURRENCIES, PAIRS, FUTURES, pairInfo, forexNeedsRate, calcForex, calcFutures, fmt, symbolOf };
})(typeof window !== "undefined" ? window : globalThis);
