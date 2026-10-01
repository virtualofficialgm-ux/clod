// Allergen check by ingredient name. Unknown composite products need the user to confirm their composition.
export const ALLERGENS: Record<string, RegExp> = {
  "Глютен": /пшен|мук|хлеб|макарон|паст[аы]?\b|булгур|кускус|ячм|рож|овс|лаваш|сухар|панировк|тортиль|лапш|печень/i,
  "Молочное": /молок|сыр|творог|йогурт|кефир|сливк|сметан|масло сливоч|ряженк|моцарел|пармезан|брынз/i,
  "Яйца": /яйц|яичн|майонез/i,
  "Орехи": /орех|миндал|кешью|фундук|фисташ|пекан|грецк/i,
  "Арахис": /арахис/i,
  "Рыба": /рыб|лосос|тунец|треск|сёмг|семг|форел|скумбр|минтай|горбуш|сельд/i,
  "Морепродукты": /кревет|кальмар|мид|краб|морепрод/i,
  "Соя": /со[яи]\b|соев|тофу|эдамам/i,
  "Кунжут": /кунжут|тахин/i,
};

/** Products whose composition varies by brand: flagged for clarification when the user has allergies. */
const COMPOSITE = /соус|колбас|сосиск|готов|смесь|приправ|бульонн|кетчуп|майонез|полуфабрик|хлопь|мюсли|гранол|батончик|паштет/i;

export function checkIngredients(names: string[], allergies: string[]) {
  const hits: { ingredient: string; allergen: string }[] = [];
  const unknown: string[] = [];
  if (!allergies.length) return { hits, unknown };
  for (const n of names) {
    for (const a of allergies) {
      const re = ALLERGENS[a];
      if (re ? re.test(n) : n.toLowerCase().includes(a.toLowerCase())) hits.push({ ingredient: n, allergen: a });
    }
    if (COMPOSITE.test(n) && !hits.some((h) => h.ingredient === n)) unknown.push(n);
  }
  return { hits, unknown: [...new Set(unknown)] };
}
