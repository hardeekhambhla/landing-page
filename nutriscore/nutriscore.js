// Nutri-Score 2023 algorithm (EU) + documented adjustments. Pure functions, no DOM.
// Point tables verified against Open Food Facts' official 2023 computation (see README.md).
(function (root) {
    const KJ_PER_KCAL = 4.184;
    const SALT_PER_SODIUM = 2.5;
    const KJ_PER_G_SAT_FAT = 37;

    // points = number of thresholds passed (strictly greater unless noted)
    const pts = (v, th, ge = false) => th.reduce((n, t) => n + ((ge ? v >= t : v > t) ? 1 : 0), 0);

    const T = {
        energy: Array.from({ length: 10 }, (_, i) => 335 * (i + 1)),                    // kJ /100g
        sugars: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],        // g
        satFat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],                                        // g
        salt: Array.from({ length: 20 }, (_, i) => Math.round(0.2 * (i + 1) * 10) / 10), // g
        fiber: [3.0, 4.1, 5.2, 6.3, 7.4],
        protein: [2.4, 4.8, 7.2, 9.6, 12, 14, 17],
        bevEnergy: [30, 90, 150, 210, 240, 270, 300, 330, 360, 390],                    // kJ /100ml
        bevSugars: [0, 2, 3.5, 5, 6, 7, 8, 9, 10, 11],
        bevProtein: [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0],
        fatSatEnergy: Array.from({ length: 10 }, (_, i) => 120 * (i + 1)),              // kJ from sat fat
        fatSatRatio: [10, 16, 22, 28, 34, 40, 46, 52, 58, 64]                           // % of total fat, >=
    };
    const fvlPts = p => (p > 80 ? 5 : p > 60 ? 2 : p > 40 ? 1 : 0);
    const bevFvlPts = p => (p > 80 ? 6 : p > 60 ? 4 : p > 40 ? 2 : 0);

    const MODES = {
        general: 'General food',
        beverage: 'Beverage',
        water: 'Water',
        cheese: 'Cheese',
        red_meat: 'Red meat',
        fat_oil_nut_seed: 'Fats, oils, nuts & seeds'
    };

    // Grade from official points
    function gradeOf(points, mode) {
        if (mode === 'water') return 'a';
        if (mode === 'beverage') return points <= 2 ? 'b' : points <= 6 ? 'c' : points <= 9 ? 'd' : 'e';
        if (mode === 'fat_oil_nut_seed' && points <= -6) return 'a';
        if (mode !== 'fat_oil_nut_seed' && points <= 0) return 'a';
        return points <= 2 ? 'b' : points <= 10 ? 'c' : points <= 18 ? 'd' : 'e';
    }

    // Official points. x: per-100g { kj, sugar, satFat, fat, salt(g), fiber, protein, fvl(%), sweeteners(bool) }
    function officialPoints(x, mode) {
        if (mode === 'water') return { points: 0, negative: {}, positive: {} };
        let neg, pos;
        if (mode === 'beverage') {
            neg = { energy: pts(x.kj, T.bevEnergy), sugars: pts(x.sugar, T.bevSugars), satFat: pts(x.satFat, T.satFat),
                    salt: pts(x.salt, T.salt), sweeteners: x.sweeteners ? 4 : 0 };
            pos = { fiber: pts(x.fiber, T.fiber), fvl: bevFvlPts(x.fvl), protein: pts(x.protein, T.bevProtein) };
        } else {
            if (mode === 'fat_oil_nut_seed') {
                const ratio = x.fat > 0 ? (100 * x.satFat) / x.fat : 0;
                neg = { satEnergy: pts(x.satFat * KJ_PER_G_SAT_FAT, T.fatSatEnergy), satRatio: pts(ratio, T.fatSatRatio, true),
                        sugars: pts(x.sugar, T.sugars), salt: pts(x.salt, T.salt) };
            } else {
                neg = { energy: pts(x.kj, T.energy), sugars: pts(x.sugar, T.sugars), satFat: pts(x.satFat, T.satFat), salt: pts(x.salt, T.salt) };
            }
            pos = { fiber: pts(x.fiber, T.fiber), fvl: fvlPts(x.fvl) };
            let protein = pts(x.protein, T.protein);
            if (mode === 'red_meat') protein = Math.min(protein, 2);
            const n = Object.values(neg).reduce((a, b) => a + b, 0);
            // protein is only credited when the food isn't already heavy on negatives (cheese: always)
            if (mode === 'cheese' || n < (mode === 'fat_oil_nut_seed' ? 7 : 11)) pos.protein = protein;
        }
        const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
        return { points: sum(neg) - sum(pos), negative: neg, positive: pos };
    }

    // Deliberate deviations from Nutri-Score, in official-points units (see README.md for rationale)
    const ADJUSTMENTS = { ultraProcessed: 3, deepFried: 2 };

    // Piecewise-linear map from (adjusted) points to 1-10; knots sit on grade boundaries so grade bands stay intact
    const KNOTS = {
        general: [[-15, 10], [0.5, 8], [2.5, 6.5], [10.5, 4.5], [18.5, 2.5], [40, 1]],
        fat_oil_nut_seed: [[-16, 10], [-5.5, 8], [2.5, 6.5], [10.5, 4.5], [18.5, 2.5], [40, 1]],
        beverage: [[-8, 8], [2.5, 6.5], [6.5, 4.5], [9.5, 2.5], [30, 1]]
    };
    KNOTS.cheese = KNOTS.red_meat = KNOTS.general;

    function toScore10(points, mode) {
        if (mode === 'water') return 10;
        const k = KNOTS[mode] || KNOTS.general;
        if (points <= k[0][0]) return k[0][1];
        for (let i = 1; i < k.length; i++) {
            if (points <= k[i][0]) {
                const [x0, y0] = k[i - 1], [x1, y1] = k[i];
                return y0 + ((y1 - y0) * (points - x0)) / (x1 - x0);
            }
        }
        return k[k.length - 1][1];
    }

    const n0 = v => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(0, Number(v)) : 0);

    // n: per-100g { calories(kcal) or kj, sugar, satFat, fat, sodium(mg), fiber, protein }
    // ctx: { mode, fvl(%), sweeteners, ultraProcessed, deepFried }
    function compute(n, ctx) {
        const mode = MODES[ctx.mode] ? ctx.mode : 'general';
        const x = {
            kj: n.kj != null ? n0(n.kj) : n0(n.calories) * KJ_PER_KCAL, sugar: n0(n.sugar), satFat: n0(n.satFat), fat: n0(n.fat),
            salt: (n0(n.sodium) / 1000) * SALT_PER_SODIUM, fiber: n0(n.fiber), protein: n0(n.protein),
            fvl: Math.min(100, n0(ctx.fvl)), sweeteners: !!ctx.sweeteners
        };
        const off = officialPoints(x, mode);
        const adjustments = [];
        if (mode !== 'water') {
            if (ctx.ultraProcessed) adjustments.push({ id: 'ultraProcessed', label: 'Ultra-processed', points: ADJUSTMENTS.ultraProcessed });
            if (ctx.deepFried) adjustments.push({ id: 'deepFried', label: 'Deep fried', points: ADJUSTMENTS.deepFried });
        }
        const adjusted = off.points + adjustments.reduce((a, b) => a + b.points, 0);
        return {
            mode, points: off.points, grade: gradeOf(off.points, mode), negative: off.negative, positive: off.positive,
            adjustments, adjustedPoints: adjusted, score: Math.round(toScore10(adjusted, mode) * 10) / 10
        };
    }

    // ---- Open Food Facts mapping ----
    const SWEETENER_ADDITIVES = /^en:e(950|951|952|954|955|957|959|960[a-d]?|961|962|969)$/;
    const has = (tags, re) => tags.some(t => re.test(t));
    const NOT_SIMPLE_FOOD = /^en:(meals|pizzas|pizzas-pies-and-quiches|sandwiches|soups|dishes|prepared-meats-dishes|ready-meals|burgers|salads)$/;

    // Mode from OFF category tags. Legumes stay general (OFF's own tag rule wrongly files them under seeds).
    function classify(tags, additives) {
        tags = tags || [];
        if (has(tags, /^en:(spring-waters|mineral-waters|natural-mineral-waters|waters)$/) && !has(tags, /flavou?red|[:-]sweetened|sodas|juices/)) return 'water';
        if (has(tags, /^en:(beverages|milks|dairy-drinks|fermented-milk-drinks|fermented-drinks|plant-based-milks|drinkable-yogurts)$/) &&
            !has(tags, /^en:beverage-preparations$/)) return 'beverage';
        if (has(tags, /^en:cheeses$/) && !has(tags, NOT_SIMPLE_FOOD) && !has(tags, /dairy-desserts/)) return 'cheese';
        if (has(tags, /^en:(fats|vegetable-oils|oils|butters|margarines|creams|nuts|seeds|nut-butters|oilseeds)$/) &&
            !has(tags, /^en:(legume-seeds|pulses|legumes|legumes-and-their-products|meals|sauces|snacks|breads|chocolates|biscuits)$/)) return 'fat_oil_nut_seed';
        if (has(tags, /^en:(beef|pork|lamb|veal|horse-meat|goat-meat|red-meats|mutton|ground-beef)$/) && !has(tags, NOT_SIMPLE_FOOD)) return 'red_meat';
        return 'general';
    }

    // No ingredient-based estimate: plain fruit / veg / legume / 100% juice products count as ~100%
    function inferFvl(tags) {
        const processed = /jam|compote|spread|dessert|snack|^en:(fruit-)?nectars$|sauce|chips|crisps|pickle|candied|[:-]sweetened|syrup|canned-.*-in-|ready-meals|meals/;
        if (has(tags, processed)) return 0;
        if (has(tags, /^en:(fruits|vegetables|fresh-fruits|dried-fruits|frozen-fruits|fresh-vegetables|frozen-vegetables|dried-vegetables|legumes|pulses|nuts|fruit-juices|vegetable-juices)$/)) return 100;
        return 0;
    }

    // p: Open Food Facts product object (nutriments, categories_tags, additives_tags, nova_group, ...)
    function fromOpenFoodFacts(p) {
        const m = p.nutriments || {};
        const tags = p.categories_tags || [];
        const kcal = m['energy-kcal_100g'] ?? (m['energy-kj_100g'] != null ? m['energy-kj_100g'] / KJ_PER_KCAL : null);
        const sodiumMg = m.sodium_100g != null ? m.sodium_100g * 1000 : (m.salt_100g != null ? (m.salt_100g / SALT_PER_SODIUM) * 1000 : 0);
        const per100 = {
            kj: m['energy-kj_100g'] != null ? n0(m['energy-kj_100g']) : undefined,
            calories: n0(kcal), protein: n0(m.proteins_100g), fat: n0(m.fat_100g), carbs: n0(m.carbohydrates_100g),
            sugar: n0(m.sugars_100g ?? m['added-sugars_100g']), fiber: n0(m.fiber_100g), satFat: n0(m['saturated-fat_100g']), sodium: n0(sodiumMg)
        };
        const fvl = m['fruits-vegetables-legumes-estimate-from-ingredients_100g'] ?? m['fruits-vegetables-nuts-estimate-from-ingredients_100g'] ?? inferFvl(tags);
        const nova = Number(p.nova_group);
        const missing = ['sugars_100g', 'saturated-fat_100g', 'proteins_100g', 'fiber_100g']
            .filter(k => m[k] == null).concat(m.sodium_100g == null && m.salt_100g == null ? ['salt'] : []);
        return {
            per100, missing,
            ctx: {
                mode: classify(tags, p.additives_tags), fvl: n0(fvl),
                sweeteners: (p.additives_tags || []).some(a => SWEETENER_ADDITIVES.test(a)),
                ultraProcessed: nova === 4,
                deepFried: has(tags, /^en:(chips-and-fries|crisps|french-fries|fried-.*|deep-fried-.*)$/)
            }
        };
    }

    // Share of EU reference intakes (label values) one portion delivers
    const REFERENCE_INTAKE = { calories: 2000, sugar: 90, satFat: 20, salt: 6 };
    function portionImpact(per100, weightG) {
        const k = n0(weightG) / 100;
        return {
            calories: (per100.calories * k) / REFERENCE_INTAKE.calories,
            sugar: (per100.sugar * k) / REFERENCE_INTAKE.sugar,
            satFat: (per100.satFat * k) / REFERENCE_INTAKE.satFat,
            salt: (((per100.sodium * k) / 1000) * SALT_PER_SODIUM) / REFERENCE_INTAKE.salt
        };
    }

    const api = { MODES, compute, officialPoints, gradeOf, toScore10, classify, fromOpenFoodFacts, portionImpact, ADJUSTMENTS, KJ_PER_KCAL };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NutriScore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
