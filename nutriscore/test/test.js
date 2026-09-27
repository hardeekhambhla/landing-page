// Run: node test/test.js
const assert = require('assert');
const NS = require('../nutriscore.js');
const fixtures = require('./fixtures.json');

// 1. Engine reproduces Open Food Facts' official 2023 Nutri-Score (points and grade) on real products
let ok = 0; const bad = [];
for (const f of fixtures) {
    const r = NS.compute(f.per100, { mode: f.mode, fvl: f.fvl, sweeteners: f.sweeteners });
    if (r.points === f.expected.points && r.grade === f.expected.grade) ok++; else bad.push([f.name, f.mode, r.points, f.expected.points]);
}
console.log(`official-score fixtures: ${ok}/${fixtures.length}`);
assert(ok / fixtures.length >= 0.98, 'engine drifted from official Nutri-Score: ' + JSON.stringify(bad));

// 2. Mode classification from Open Food Facts category tags
const cls = (tags) => NS.classify(tags, []);
assert.strictEqual(cls(['en:beverages', 'en:waters', 'en:spring-waters']), 'water');
assert.strictEqual(cls(['en:beverages', 'en:carbonated-drinks', 'en:sodas']), 'beverage');
assert.strictEqual(cls(['en:dairies', 'en:milks']), 'beverage');
assert.strictEqual(cls(['en:cheeses']), 'cheese');
assert.strictEqual(cls(['en:fromages-blancs', 'en:dairy-desserts', 'en:cheeses']), 'general');
assert.strictEqual(cls(['en:fats', 'en:vegetable-oils']), 'fat_oil_nut_seed');
assert.strictEqual(cls(['en:legumes', 'en:legume-seeds', 'en:seeds']), 'general'); // legumes are not "seeds" for scoring
assert.strictEqual(cls(['en:meats', 'en:beef']), 'red_meat');
assert.strictEqual(cls(['en:meals', 'en:pizzas', 'en:beef']), 'general');

// 3. Sanity ordering and invariants
const P = (n, ctx) => NS.compute(n, ctx).score;
const apple = P({ calories: 52, sugar: 10, satFat: 0, fat: 0.2, sodium: 1, fiber: 2.4, protein: 0.3 }, { mode: 'general', fvl: 100 });
const chips = P({ calories: 554, sugar: 2.6, satFat: 14, fat: 35, sodium: 204, fiber: 0, protein: 7 }, { mode: 'general', fvl: 0, ultraProcessed: true, deepFried: true });
const cola = P({ calories: 42, sugar: 10.6, satFat: 0, fat: 0, sodium: 5, fiber: 0, protein: 0 }, { mode: 'beverage' });
const water = P({ calories: 0 }, { mode: 'water' });
assert(water === 10 && apple > 8 && chips < 3 && cola < 4, JSON.stringify({ water, apple, chips, cola }));
// adjustments only ever lower the score
const base = { calories: 300, sugar: 5, satFat: 3, fat: 12, sodium: 300, fiber: 2, protein: 6 };
assert(P(base, { mode: 'general', ultraProcessed: true }) < P(base, { mode: 'general' }));
// score is monotone in points and stays within 1-10
for (let pts = -20; pts <= 45; pts++) for (const m of Object.keys(NS.MODES)) {
    const s = NS.toScore10(pts, m), s2 = NS.toScore10(pts + 1, m);
    assert(s >= 1 && s <= 10 && s2 <= s + 1e-9, `non-monotone at ${m} ${pts}`);
}
// grade bands line up with the score map for the official (unadjusted) points
for (let pts = -15; pts <= 40; pts++) {
    const g = NS.gradeOf(pts, 'general'), s = NS.toScore10(pts, 'general');
    const [lo, hi] = { a: [8, 10], b: [6.5, 8], c: [4.5, 6.5], d: [2.5, 4.5], e: [1, 2.5] }[g];
    assert(s >= lo - 1e-9 && s <= hi + 1e-9, `score ${s} outside grade ${g} band at ${pts} pts`);
}
// missing/garbage inputs never produce NaN
const r = NS.compute({ calories: 'x', sugar: null }, { mode: 'nonsense', fvl: 'abc' });
assert(Number.isFinite(r.score) && r.mode === 'general');
console.log('all tests passed');
