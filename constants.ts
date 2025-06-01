import { Sex, ActivityLevel, IFProtocolType, MacroNutrients, FastingPhase, TimerStatus, IFProtocol, FastingTimerState } from './types';

export const MIFFLIN_ST_JEOR_COEFFICIENTS = {
  [Sex.MALE]: { weight: 10, height: 6.25, age: 5, constant: 5 },
  [Sex.FEMALE]: { weight: 10, height: 6.25, age: 5, constant: -161 },
};

export const ACTIVITY_LEVEL_MULTIPLIERS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHT]: 1.375,
  [ActivityLevel.MODERATE]: 1.55,
  [ActivityLevel.ACTIVE]: 1.725,
  [ActivityLevel.EXTRA_ACTIVE]: 1.9,
};

export const DEFAULT_IF_PROTOCOLS: Record<IFProtocolType, IFProtocol> = {
  [IFProtocolType.SIXTEEN_EIGHT]: { type: IFProtocolType.SIXTEEN_EIGHT, fastingHours: 16, eatingHours: 8 },
  [IFProtocolType.EIGHTEEN_SIX]: { type: IFProtocolType.EIGHTEEN_SIX, fastingHours: 18, eatingHours: 6 },
  [IFProtocolType.CUSTOM]: { type: IFProtocolType.CUSTOM, fastingHours: 12, eatingHours: 12 }, // Default custom
};

export const DEFAULT_MACRO_SPLIT_GENERAL = { proteinRatio: 0.3, carbRatio: 0.4, fatRatio: 0.3 }; // General balanced
export const DEFAULT_MACRO_SPLIT_MUSCLE_GAIN = { proteinRatio: 0.35, carbRatio: 0.45, fatRatio: 0.2 };
export const DEFAULT_MACRO_SPLIT_WEIGHT_LOSS = { proteinRatio: 0.4, carbRatio: 0.3, fatRatio: 0.3 };
export const DEFAULT_MACRO_SPLIT_KETO = { proteinRatio: 0.25, carbRatio: 0.05, fatRatio: 0.7 };


export const PROTEIN_KCAL_PER_GRAM = 4;
export const CARBS_KCAL_PER_GRAM = 4;
export const FAT_KCAL_PER_GRAM = 9;

export const DEFAULT_USER_PROFILE_GOALS = {
  targetWeightKg: 70,
  targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days from now
  planDescription: "General fitness and health improvement."
};

export const DEFAULT_INITIAL_MACROS: MacroNutrients = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 67
};


export const INITIAL_FASTING_TIMER_STATE: (protocol: IFProtocol) => FastingTimerState = (protocol) => ({
  status: TimerStatus.NOT_ACTIVE,
  currentPhase: FastingPhase.FASTING,
  pausedDurationMs: 0,
  protocol: protocol || DEFAULT_IF_PROTOCOLS[IFProtocolType.SIXTEEN_EIGHT],
});