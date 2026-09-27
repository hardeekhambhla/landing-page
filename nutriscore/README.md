# NutriScore Pro

Single-page food scorer. Type a food (Gemini estimates nutrition) or scan a barcode (Open Food Facts).

- `index.html` UI, Gemini + Open Food Facts calls, caching
- `nutriscore.js` scoring engine (pure functions, no DOM)
- `test/test.js` `node test/test.js`

## Scoring

Base is the official **EU Nutri-Score, 2023 algorithm**, per 100g (100ml for drinks):

- Negative points: energy, sugars, saturated fat, salt (+ non-sugar sweeteners for drinks)
- Positive points: fiber, protein, fruit/veg/legumes %
- Protein only counts when negatives are low (<11 points, <7 for fats) or the food is cheese
- Separate rules for drinks (water = A), fats/oils/nuts/seeds (sat-fat energy + sat-fat share), cheese, red meat (protein capped at 2)
- Grade: A <=0, B 1-2, C 3-10, D 11-18, E >=19 (drinks: B <=2, C 3-6, D 7-9, E >=10; fats: A <=-6)

The 1-10 number maps points piecewise-linearly, with knots on the grade boundaries, so it never disagrees with the letter.

### Validation

Tables were derived from and checked against Open Food Facts' own 2023 computation (3,366 products across all modes):

| Check | Result |
|---|---|
| Same inputs as OFF used, engine vs official points + grade | 99.8% (2,348 / 2,353) |
| Raw nutrients -> our pipeline, OFF's mode | 94% exact points, 97% grade |
| Raw nutrients -> our pipeline, our mode classifier | 89% points, 94% grade (differences are intentional, below) |

Remaining misses are mostly OFF data noise (identical products with different ingredient-derived fruit/veg %).
`test/fixtures.json` holds 152 sampled products for regression.

### Deliberate deviations from Nutri-Score

Nutri-Score is per-100g, ignores processing, and ignores portion size. Changes:

1. **Ultra-processed (NOVA 4): +3 points.** Processing is associated with worse outcomes beyond nutrient content; Nutri-Score cannot see it.
2. **Deep fried: +2 points.** Frying adds oxidised fats / acrylamide that the nutrient table does not capture.
   Both magnitudes are judgement calls (about a third to half of a grade band), not derived from data. They are shown as separate lines in "How this score is built"; the letter grade shown is the unadjusted official one.
3. **Legumes are general foods, not "seeds".** OFF's tag rule files pulses under fats/nuts/seeds, which scores them wrongly.
4. **Mixed dishes (pizza with ham) are not red meat; plain bottled water is water; fermented milk drinks are beverages.**
5. **No vitamin index.** It was an AI guess with no reliable source, so it no longer affects the score.
6. **Portion impact.** Each portion is also shown as a share of EU reference intakes (2000 kcal, 90g sugar, 20g sat fat, 6g salt), since harm depends on dose, not just density.

### Known limits

- Typed foods use AI estimates (nutrients, fruit/veg %, mode); scanned products use label data. Scans with missing label fields count them as 0 and say so.
- Fruit/veg/legume % on scans comes from OFF's ingredient estimate, else a category guess.
- No whole-grain, trans-fat or additive-risk signals. Polyol sweeteners (xylitol, erythritol...) are not counted as sweeteners.
- Camera scanning needs HTTPS or localhost.
