const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../calculator.js');

test('レベル6・兵器39・攻城値290・体力90なら9回45分で成立', () => {
  const x = calc.simulateCity({ durability: 100000, troops: 39, power: 290, stamina: 90 });
  assert.equal(x.perRound, 11310);
  assert.equal(x.requiredRounds, 9);
  assert.equal(x.actualMinutes, 45);
  assert.equal(x.neededUnits, 39);
  assert.equal(x.feasible, true);
  assert.equal(x.remaining, 0);
});
test('35部隊は体力100なら10回50分で成立、体力90なら不成立', () => {
  const a = calc.simulateCity({durability:100000,troops:35,power:290,stamina:100});
  const b = calc.simulateCity({durability:100000,troops:35,power:290,stamina:90});
  assert.equal(a.requiredRounds, 10); assert.equal(a.actualMinutes, 50); assert.equal(a.feasible, true);
  assert.equal(b.requiredRounds, 10); assert.equal(b.actualMinutes, null); assert.equal(b.neededUnits, 39); assert.equal(b.missingUnits, 4);
});
test('レベル別耐久と必要部隊数（攻城値290）', () => {
  const expected9 = {4:6,5:20,6:39,7:77};
  const expected10 = {4:6,5:18,6:35,7:69};
  for (const level of [4,5,6,7]) {
    assert.equal(calc.simulateCity({durability:calc.DURABILITY[level],troops:0,power:290,stamina:90}).neededUnits, expected9[level]);
    assert.equal(calc.simulateCity({durability:calc.DURABILITY[level],troops:0,power:290,stamina:100}).neededUnits, expected10[level]);
  }
});
test('体力0 / 部隊0のときゼロ除算せず不成立', () => {
  const a = calc.simulateCity({durability:50000,troops:20,power:290,stamina:0});
  assert.equal(a.neededUnits, null); assert.equal(a.feasible, false); assert.equal(a.progress, 0);
  const b = calc.simulateCity({durability:50000,troops:0,power:290,stamina:100});
  assert.equal(b.requiredRounds, null); assert.equal(b.neededUnits, 18); assert.equal(b.feasible, false);
});
test('3城で持ち数を超えると超過、不足があれば不可', () => {
  const cities=[{durability:15000,troops:6},{durability:50000,troops:20},{durability:100000,troops:39}];
  const low=calc.simulatePlan({cities,available:60,power:290,stamina:90});
  assert.equal(low.minRequired,65); assert.equal(low.allocated,65); assert.equal(low.status,'overallocated');
  const enough=calc.simulatePlan({cities,available:70,power:290,stamina:90});
  assert.equal(enough.status,'clear'); assert.equal(enough.unallocated,5);
});
test('総数は足りていても配分ミスがあれば要調整', () => {
  const x=calc.simulatePlan({cities:[{durability:15000,troops:1},{durability:50000,troops:30}],available:40,power:290,stamina:90});
  assert.equal(x.minRequired,26); assert.equal(x.status,'adjust');
});
test('55分、60分、60分超の時間リスク境界', () => {
  assert.equal(calc.timeRisk(50),'safe'); assert.equal(calc.timeRisk(55),'tight');
  assert.equal(calc.timeRisk(60),'danger'); assert.equal(calc.timeRisk(65),'over');
});
test('大きな整数と0体力では無限大等が出ない', () => {
  const x=calc.simulateCity({durability:1_000_000_000,troops:1,power:1,stamina:10});
  assert.equal(x.feasible,false); assert.equal(x.requiredRounds,1_000_000_000);
  assert.equal(x.neededUnits,1_000_000_000);
});
