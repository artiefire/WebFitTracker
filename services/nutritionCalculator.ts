import { PersonalDetails, Sex, ActivityLevel, CalculatedNutrition, MacroNutrients, UserGoals, FoodEntry } from '../types';
import { MIFFLIN_ST_JEOR_COEFFICIENTS, ACTIVITY_LEVEL_MULTIPLIERS, PROTEIN_KCAL_PER_GRAM, CARBS_KCAL_PER_GRAM, FAT_KCAL_PER_GRAM, DEFAULT_MACRO_SPLIT_GENERAL, DEFAULT_MACRO_SPLIT_MUSCLE_GAIN, DEFAULT_MACRO_SPLIT_WEIGHT_LOSS, DEFAULT_MACRO_SPLIT_KETO } from '../constants';

export const calculateBMR = (details: PersonalDetails): number => {
  const { age, sex, heightCm, currentWeightKg } = details;
  const coeffs = MIFFLIN_ST_JEOR_COEFFICIENTS[sex];
  
  if (!coeffs) throw new Error("Invalid sex provided for BMR calculation.");

  const bmr = (coeffs.weight * currentWeightKg) + 
              (coeffs.height * heightCm) - 
              (coeffs.age * age) + 
              coeffs.constant;
  return Math.round(bmr);
};

export const calculateTDEE = (bmr: number, activityLevel: ActivityLevel): number => {
  const multiplier = ACTIVITY_LEVEL_MULTIPLIERS[activityLevel];
  if (!multiplier) throw new Error("Invalid activity level provided for TDEE calculation.");
  return Math.round(bmr * multiplier);
};

export const suggestMacros = (tdee: number, goals: UserGoals, currentWeightKg: number): MacroNutrients => {
  let calories = tdee; // Maintenance calories
  const weightDiff = goals.targetWeightKg - currentWeightKg;

  if (weightDiff < -1) { 
    calories -= 500; 
  } else if (weightDiff > 1) { 
    calories += 300; 
  }
  
  calories = Math.max(1200, calories); 

  let split = DEFAULT_MACRO_SPLIT_GENERAL;
  const planDesc = goals.planDescription.toLowerCase();

  if (planDesc.includes("muscle") || planDesc.includes("gain")) {
    split = DEFAULT_MACRO_SPLIT_MUSCLE_GAIN;
  } else if (planDesc.includes("keto") || planDesc.includes("low carb")) {
    split = DEFAULT_MACRO_SPLIT_KETO;
  } else if (planDesc.includes("lose weight") || planDesc.includes("fat loss") || planDesc.includes("cut")) {
    split = DEFAULT_MACRO_SPLIT_WEIGHT_LOSS;
  }
  
  const proteinGrams = Math.round((calories * split.proteinRatio) / PROTEIN_KCAL_PER_GRAM);
  const carbsGrams = Math.round((calories * split.carbRatio) / CARBS_KCAL_PER_GRAM);
  const fatGrams = Math.round((calories * split.fatRatio) / FAT_KCAL_PER_GRAM);

  const calculatedCalories = (proteinGrams * PROTEIN_KCAL_PER_GRAM) + 
                             (carbsGrams * CARBS_KCAL_PER_GRAM) + 
                             (fatGrams * FAT_KCAL_PER_GRAM);

  return {
    calories: Math.round(calculatedCalories),
    protein: proteinGrams,
    carbs: carbsGrams,
    fat: fatGrams,
  };
};

export const sumFoodEntryMacros = (entries: FoodEntry[]): MacroNutrients => {
  return entries.reduce((acc, entry) => {
    const quantity = entry.quantity || 1;
    acc.calories += (entry.calories || 0) * quantity;
    acc.protein += (entry.protein || 0) * quantity;
    acc.carbs += (entry.carbs || 0) * quantity;
    acc.fat += (entry.fat || 0) * quantity;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
};

export const convertWeight = (value: number, fromUnit: 'kg' | 'lbs', toUnit: 'kg' | 'lbs'): number => {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'lbs' && toUnit === 'kg') return value * 0.453592;
  if (fromUnit === 'kg' && toUnit === 'lbs') return value / 0.453592;
  return value;
};

export const convertHeight = (valueCm: number, toUnit: 'cm' | 'ft_in'): number | {feet: number, inches: number} => {
  if (toUnit === 'cm') return valueCm;
  const totalInches = valueCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};