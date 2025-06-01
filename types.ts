export enum Sex {
  MALE = "Male",
  FEMALE = "Female",
}

export enum ActivityLevel {
  SEDENTARY = "Sedentary (little or no exercise)",
  LIGHT = "Lightly active (light exercise/sports 1-3 days/week)",
  MODERATE = "Moderately active (moderate exercise/sports 3-5 days/week)",
  ACTIVE = "Very active (hard exercise/sports 6-7 days a week)",
  EXTRA_ACTIVE = "Extra active (very hard exercise/sports & physical job)",
}

export enum IFProtocolType {
  SIXTEEN_EIGHT = "16:8",
  EIGHTEEN_SIX = "18:6",
  CUSTOM = "Custom",
}

export interface IFProtocol {
  type: IFProtocolType;
  fastingHours?: number;
  eatingHours?: number;
}

export interface PersonalDetails {
  age: number;
  sex: Sex;
  heightCm: number;
  currentWeightKg: number;
}

export interface UserGoals {
  targetWeightKg: number;
  targetDate: string; // ISO string
  planDescription: string;
}

export interface DietaryPreferences {
  interestedInIF: boolean;
  ifProtocol: IFProtocol;
  interestedInRefeedDays: boolean;
}

export interface CalculatedNutrition {
  bmr: number;
  tdee: number;
}

export interface MacroNutrients {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface UserProfile {
  personalDetails: PersonalDetails;
  activityLevel: ActivityLevel;
  goals: UserGoals;
  dietaryPreferences: DietaryPreferences;
  calculatedNutrition: CalculatedNutrition;
  targetMacros: MacroNutrients;
  quizCompleted: boolean;
}

export interface FoodEntry {
  id: string; // uuid
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string; // e.g., "1 cup", "100g"
  quantity: number;
  loggedAt: string; // ISO string, timestamp of logging
  mealTime: string; // ISO string, actual mealtime
  photoIdentifier?: string; // URL or identifier (local URI in React Native)
  notes?: string;
  apiSource?: string;
  aiAssisted?: boolean;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  foodEntries: FoodEntry[];
  isRefeedDay: boolean;
  effectiveCaloriesGoal: number;
  effectiveMacrosGoal: MacroNutrients;
  totals: MacroNutrients; // Computed daily totals
}

export enum FastingPhase {
  FASTING = "Fasting",
  EATING = "Eating",
}

export enum TimerStatus {
  NOT_ACTIVE = "Not Active",
  ACTIVE = "Active",
  PAUSED = "Paused",
}

export interface FastingTimerState {
  status: TimerStatus;
  currentPhase: FastingPhase;
  startTime?: string; // ISO string, start of overall timer
  endTime?: string; // ISO string, calculated end of current fast/eat window
  phaseStartTime?: string; // ISO string, actual start of current phase (fasting or eating)
  pausedDurationMs: number; // Total accumulated pause time in milliseconds for current phase
  lastPauseTime?: string; // ISO string, when timer was last paused
  protocol: IFProtocol;
}

export type UnitSystem = "metric" | "imperial";

export interface HealthData {
  steps?: number;
  distance?: number; // in km
  activeEnergy?: number; // in kcal
  restingHeartRate?: number; // in bpm
  hrv?: number; // Heart Rate Variability SDNN in ms
  sleepHours?: number; // Total sleep in hours
}