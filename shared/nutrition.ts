import type { NutritionPlan, Profile } from "./types";

export function ageFrom(birthDate: string, now = new Date()): number {
  const b = new Date(birthDate);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function bmi(p: Pick<Profile, "heightCm" | "weightKg">): number {
  const h = p.heightCm / 100;
  return p.weightKg / (h * h);
}

/** Mifflin–St Jeor BMR × activity factor, adjusted by goal; macros by g/kg. */
export function computePlan(p: Profile): NutritionPlan {
  const age = ageFrom(p.birthDate);
  const sexOffset = p.gender === "male" ? 5 : p.gender === "female" ? -161 : -78;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + sexOffset;
  const activity =
    p.workoutsPerWeek <= 1 ? 1.3 : p.workoutsPerWeek <= 3 ? 1.45 : p.workoutsPerWeek <= 5 ? 1.6 : 1.75;
  const tdee = bmr * activity;

  // 1 kg of body mass ≈ 7700 kcal
  const dailyDelta = (p.weeklyRateKg * 7700) / 7;
  let calories =
    p.goal === "lose" ? tdee - dailyDelta : p.goal === "gain" ? tdee + dailyDelta * 0.6 : tdee;
  const floor = p.gender === "male" ? 1500 : 1200;
  calories = Math.max(floor, Math.round(calories / 10) * 10);

  const proteinPerKg = p.goal === "maintain" ? 1.6 : p.goal === "gain" ? 1.9 : 2.0;
  const protein = Math.round(p.weightKg * proteinPerKg);
  const fat = Math.round((calories * (p.goal === "lose" ? 0.28 : 0.27)) / 9);
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));

  const waterMl = Math.round((p.weightKg * 33 + p.workoutsPerWeek * 120) / 50) * 50;

  const diff = Math.abs(p.targetWeightKg - p.weightKg);
  const weeks = p.goal === "maintain" || p.weeklyRateKg === 0 ? 0 : diff / p.weeklyRateKg;
  const target = new Date();
  target.setDate(target.getDate() + Math.round(weeks * 7));

  const b = bmi(p);
  let healthScore = 7;
  if (b >= 18.5 && b < 25) healthScore += 1;
  if (p.workoutsPerWeek >= 3) healthScore += 1;
  if (p.weeklyRateKg > 0.9) healthScore -= 1;
  if (p.diet !== "classic") healthScore += 0.5;
  healthScore = Math.max(1, Math.min(10, Math.round(healthScore)));

  return {
    calories,
    protein,
    carbs,
    fat,
    waterMl,
    healthScore,
    targetDate: target.toISOString().slice(0, 10),
  };
}
