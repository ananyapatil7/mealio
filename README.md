# Mealio 🍳

A kitchen inventory and meal planner for people cooking for themselves.
**Know what's at home → decide what to cook → know what to buy.**

Mobile-first PWA built with React, Vite, TypeScript and Tailwind. There is no backend and no login: all data lives in `localStorage` on the device.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest unit tests
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

## Deploy

### Vercel
1. Push this folder to a GitHub repo.
2. On vercel.com: **Add New → Project → Import** the repo. Vercel detects Vite, and `vercel.json` sets the build command (`npm run build`) and output directory (`dist`).
3. Click **Deploy**.

Or from the CLI: `npm i -g vercel && vercel --prod`.

### Netlify
1. Push to GitHub. On app.netlify.com: **Add new site → Import an existing project** and pick the repo.
2. `netlify.toml` already sets the build command `npm run build` and the publish directory `dist`. Click **Deploy**.

Or from the CLI: `npm i -g netlify-cli && netlify deploy --build --prod`.

Both configs send `sw.js` with `no-cache` (so app updates reach users) and hashed assets as immutable. HTTPS, which both hosts provide, is required for the service worker and for "Add to Home Screen".

## Screens

| Tab | Purpose | Main action |
|---|---|---|
| **Kitchen** | Inventory (running-low items first) and staples as have / don't-have chips | **Add groceries**: type casually or paste a receipt, then check and save |
| **Cook** | Meal type, servings, Veg / ≤20 min / kcal filters, free text ("no paneer"). Ranked recipe cards | Open a recipe, then **I cooked this** or **Plan this week** |
| **Shop** | Generated list (low stock + planned shortfalls + missing staples) plus manual items | Tick items off, then **Add ticked to kitchen** |
| **Track** | Today's calories, meals, a 7-day bar chart (tap a day) | — |

Empty states offer a first step, and **Kitchen → ⋯ → Load sample data** (or "Try with a sample kitchen") fills in a realistic kitchen, a planned meal and a week of meals.

## Data model (`src/lib/types.ts`)

```ts
InventoryItem { id, name /* canonical key, e.g. "onion" */, qty, unit: 'pcs'|'g'|'ml', lowAt?, updatedAt }
Staple        { name, have }                       // have / don't have only
Recipe        { id, name, cuisine, mealTypes[], baseServings, cookTimeMin, tags (veg|non-veg|quick),
                caloriesPerServing, ingredients: {name, qty, unit}[], steps[] }
MealLog       { id, recipeId, recipeName, servings, calories /* total */, date /* local YYYY-MM-DD */, cookedAt }
PlannedMeal   { id, recipeId, servings }
ManualShoppingItem { id, name, qty?, unit? }
AppState      { version, inventory, staples, mealLogs, planned, shoppingManual,
                shoppingChecked, shoppingDismissed, settings }   // one localStorage key: "mealio:v1"
```

The shopping list is **worked out from state** (`buildShoppingList`) rather than stored, so it can never go stale.

## Code map

```
src/lib/        pure, tested logic (no React)
  names.ts      name normalisation: plurals, aliases, "Amul toned milk" → milk
  units.ts      kg/l/dozen/tbsp → g/ml/pcs, pcs↔g via piece weights, scaling, formatting
  parser.ts     casual text + receipt parsing → items for the confirm screen
  inventory.ts  merge/add/deduct (never below zero)
  ranking.ts    ingredient coverage, filters, free-text query, sorting
  cooking.ts    cook plan (scaled needs, shortages, editable deductions), apply, meal log
  shopping.ts   shopping list generation
  calories.ts   per-meal, daily and 7-day totals
  storage.ts    localStorage load/save with safe fallback
src/data/       ingredient catalog (aliases, units, piece weights, pack sizes), 45 recipes, sample data
src/state/      reducer (all state changes) + React context store
src/screens/    Kitchen, AddGroceries, Cook, RecipeSheet, Shop, Track
```

To extend it later (OCR, sync, expiry), add a new source that produces `IncomingItem[]` or a new action in `reducer.ts`. The logic modules don't depend on React or storage.

## Rules and assumptions

- **Units**: countable things (eggs, onions, garlic cloves, bread slices) are `pcs`; everything else is `g` or `ml`. The unit you type is kept: "1kg onions" is stored as 1000 g, "6 onions" as 6 pcs. Recipes and stock in different units are compared using an average piece weight from the catalog (onion 150 g, egg 50 g, …). When no conversion is known, the item counts as **missing**. It is never assumed to be available.
- **No quantity given** ("milk"): the usual pack size is used (milk 1 l) and the confirm screen marks it "Guessed amount: check it".
- **Receipts**: prices (`45.00`, `₹35`, `@ 56.00`), totals, tax, dates and shop-name headers are ignored. A small number after a weight is read as the line quantity (`BUTTER 100G 2` → 200 g).
- **Names**: lower-case, singular, aliases (aloo → potato, dahi → curd, capsicum/bell pepper). Brand and variety words are dropped ("basmati rice" → rice), but different products are never collapsed ("tomato ketchup" stays ketchup). Unknown items are kept as typed. The parser never adds items that weren't in the text.
- **Staples** are tracked as have / don't have. Recipes need them to be "have". Cooking doesn't deduct them. A missing staple goes on the shopping list.
- **Low stock**: an item goes on the list when it is below its threshold (set per item, "Remind me when below") or has run out. The suggested amount tops it up to **2× the threshold**, or one usual pack if no threshold is set.
- **Planned meals**: needs are scaled to the planned servings, summed across all planned meals, then stock is subtracted once. Cooking a planned recipe removes it from the plan.
- **Shopping list** rows appear only when what you have is less than what you need, so it never lists something you have enough of. If you add an item manually that you already have, it stays (you asked for it) but shows "You already have X at home".
- **Cooking with too little stock**: the app warns and lists the shortfall. "Cook anyway" uses what's there, and each amount can be adjusted. Stock is clamped at zero.
- **Veg** follows the Indian convention: recipes with egg are non-veg.
- Calories are approximate per-serving estimates in the recipe data. A logged meal stores `caloriesPerServing × servings`. Deleting a log entry doesn't restore stock.
- "Quick" means 20 minutes or less, worked out from cook time.
- Days are local calendar days, so a late dinner counts for the right day.
