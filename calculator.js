/* 信長の野望・真戦 攻城シミュレータ：計算ロジック（外部依存なし） */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KojoCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DURABILITY = Object.freeze({ 4: 15000, 5: 50000, 6: 100000, 7: 200000 });
  const MINUTES_PER_HIT = 5;
  const STAMINA_PER_HIT = 10;
  const MAX_HITS = 10;

  function integer(value, fallback = 0, min = 0, max = 1000000000) {
    if (value === '' || value === null || value === undefined) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
  }

  function maxAttackRounds(stamina) {
    return Math.min(MAX_HITS, Math.floor(integer(stamina, 0, 0, 100) / STAMINA_PER_HIT));
  }

  function timeRisk(minutes) {
    if (minutes === null) return 'unknown';
    if (minutes > 60) return 'over';
    if (minutes === 60) return 'danger';
    if (minutes >= 55) return 'tight';
    return 'safe';
  }

  /**
   * この計算では全兵器が同じ攻城値・現在体力を持ち、5分ごとに1回攻撃する。
   * 注意：守備軍の殲滅、攻撃開始前の遅延、体力回復は計算対象外。
   */
  function simulateCity({ durability, troops, power, stamina }) {
    const hp = integer(durability, 1, 1);
    const units = integer(troops, 0, 0);
    const atk = integer(power, 290, 1);
    const currentStamina = integer(stamina, 100, 0, 100);
    const maxRounds = maxAttackRounds(currentStamina);
    const perRound = units * atk;
    const requiredRounds = perRound > 0 ? Math.ceil(hp / perRound) : null;
    const projectedMinutes = requiredRounds === null ? null : requiredRounds * MINUTES_PER_HIT;
    const neededUnits = maxRounds > 0 ? Math.ceil(hp / (atk * maxRounds)) : null;
    const feasible = requiredRounds !== null && requiredRounds <= maxRounds;
    const damageCapacity = perRound * maxRounds;
    const remaining = Math.max(0, hp - damageCapacity);
    const hitsUsed = feasible ? requiredRounds : maxRounds;
    const actualMinutes = feasible ? requiredRounds * MINUTES_PER_HIT : null;

    return {
      hp, units, atk, currentStamina, maxRounds, perRound, requiredRounds,
      projectedMinutes, actualMinutes, neededUnits, feasible, damageCapacity, remaining, hitsUsed,
      progress: Math.min(1, damageCapacity / hp),
      missingUnits: neededUnits === null ? null : Math.max(0, neededUnits - units),
      extraUnits: neededUnits === null ? null : Math.max(0, units - neededUnits),
      risk: timeRisk(projectedMinutes),
    };
  }

  function simulatePlan({ cities, available, power, stamina }) {
    const rows = cities.map(city => simulateCity({ ...city, power, stamina }));
    const pool = integer(available, 0, 0);
    const allocated = rows.reduce((sum, row) => sum + row.units, 0);
    const minRequired = rows.some(row => row.neededUnits === null)
      ? null : rows.reduce((sum, row) => sum + row.neededUnits, 0);
    const allClear = rows.length > 0 && rows.every(row => row.feasible);
    let status = 'adjust';
    if (allocated > pool) status = 'overallocated';
    else if (allClear) status = 'clear';
    else if (maxAttackRounds(stamina) === 0) status = 'no-stamina';
    else if (minRequired !== null && minRequired > pool) status = 'insufficient-pool';
    return { rows, pool, allocated, unallocated: Math.max(0, pool - allocated), overage: Math.max(0, allocated - pool), minRequired, allClear, status };
  }

  return { DURABILITY, MINUTES_PER_HIT, STAMINA_PER_HIT, MAX_HITS, integer, maxAttackRounds, timeRisk, simulateCity, simulatePlan };
});
