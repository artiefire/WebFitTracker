import React, { useState, ChangeEvent, FormEvent } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Alert as RNAlert } from 'react-native';
import { UserProfile, PersonalDetails, Sex, ActivityLevel, UserGoals, DietaryPreferences, IFProtocolType, IFProtocol, CalculatedNutrition, MacroNutrients, UnitSystem } from '../types';
import { Button, Input, Select, Textarea, Card, Toggle, DatePicker } from './uiElements';
import { calculateBMR, calculateTDEE, suggestMacros, convertWeight, convertHeight } from '../services/nutritionCalculator';
import { DEFAULT_IF_PROTOCOLS, DEFAULT_USER_PROFILE_GOALS, DEFAULT_INITIAL_MACROS } from '../constants';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface OnboardingQuizProps {
  onQuizComplete: (profile: UserProfile) => void;
  // navigation prop would be passed by React Navigation if this screen is registered
  navigation?: any; 
}

const initialPersonalDetails: PersonalDetails = { age: 30, sex: Sex.MALE, heightCm: 175, currentWeightKg: 70 };
const initialGoals: UserGoals = DEFAULT_USER_PROFILE_GOALS;
const initialDietaryPreferences: DietaryPreferences = {
  interestedInIF: false,
  ifProtocol: DEFAULT_IF_PROTOCOLS[IFProtocolType.SIXTEEN_EIGHT],
  interestedInRefeedDays: false,
};

const OnboardingQuiz: React.FC<OnboardingQuizProps> = ({ onQuizComplete }) => {
  const [step, setStep] = useState(1);
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails>(initialPersonalDetails);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(ActivityLevel.MODERATE);
  const [goals, setGoals] = useState<UserGoals>(initialGoals);
  const [dietaryPreferences, setDietaryPreferences] = useState<DietaryPreferences>(initialDietaryPreferences);
  const [calculatedNutrition, setCalculatedNutrition] = useState<CalculatedNutrition | null>(null);
  const [suggestedMacros, setSuggestedMacros] = useState<MacroNutrients>(DEFAULT_INITIAL_MACROS);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  
  const [heightInput, setHeightInput] = useState<{feet: string, inches: string}>({feet: '5', inches: '9'});
  const [weightInput, setWeightInput] = useState<string>('70');

  // Event handlers need to be adapted for React Native's TextInput `onChangeText`
  const handlePersonalDetailsChange = (name: keyof PersonalDetails | 'heightFeet' | 'heightInches' | 'currentWeight', value: string) => {
    if (name === "heightFeet" || name === "heightInches") {
        const newHeightInput = {...heightInput, [name === "heightFeet" ? "feet" : "inches"]: value};
        setHeightInput(newHeightInput);
        const feet = parseFloat(newHeightInput.feet) || 0;
        const inches = parseFloat(newHeightInput.inches) || 0;
        setPersonalDetails(prev => ({ ...prev, heightCm: Math.round((feet * 12 + inches) * 2.54) }));
    } else if (name === "currentWeight") {
        setWeightInput(value);
        const weightVal = parseFloat(value) || 0;
        setPersonalDetails(prev => ({ ...prev, currentWeightKg: unitSystem === 'imperial' ? convertWeight(weightVal, 'lbs', 'kg') : weightVal }));
    } else if (name === 'age') {
        setPersonalDetails(prev => ({ ...prev, age: parseInt(value) || 0 }));
    } else if (name === 'sex') {
        setPersonalDetails(prev => ({ ...prev, sex: value as Sex }));
    }
    // Removed direct setting for heightCm as it's handled by ft/in or direct cm input
  };
  
  const handleWeightUnitToggle = () => {
    const newUnitSystem = unitSystem === 'metric' ? 'imperial' : 'metric';
    setUnitSystem(newUnitSystem);
    const currentWeightVal = parseFloat(weightInput) || 0;
    
    let newWeightInputVal = '';
    if (newUnitSystem === 'imperial') { // metric to imperial
        newWeightInputVal = convertWeight(personalDetails.currentWeightKg, 'kg', 'lbs').toFixed(1);
    } else { // imperial to metric
        newWeightInputVal = convertWeight(personalDetails.currentWeightKg, 'kg', 'lbs').toFixed(1); // This line had a bug, should use lbs to kg for value from currentWeightKg if it was lbs
                                                                                                     // Let's assume currentWeightKg is always the source of truth in kg
        newWeightInputVal = personalDetails.currentWeightKg.toFixed(1); // When switching TO metric, display the stored kg value
    }
    setWeightInput(newWeightInputVal);
    // personalDetails.currentWeightKg is updated via handlePersonalDetailsChange('currentWeight', ...)
  };

  const handleActivityLevelChange = (value: string | number) => {
    setActivityLevel(value as ActivityLevel);
  };

  const handleGoalsChange = (name: keyof UserGoals | 'targetWeightInput', value: string) => {
    if (name === 'targetWeightInput') {
        const weightVal = parseFloat(value) || 0;
        setGoals(prev => ({ ...prev, targetWeightKg: unitSystem === 'imperial' ? convertWeight(weightVal, 'lbs', 'kg') : weightVal }));
    } else if (name === 'targetDate') {
        setGoals(prev => ({ ...prev, targetDate: value })); // Assuming value is ISO string from DatePicker
    } else if (name === 'planDescription') {
         setGoals(prev => ({ ...prev, planDescription: value }));
    }
  };

  const handleTargetWeightInputChange = (value: string) => {
    // This function updates the input field's display value for target weight
    // The actual goals.targetWeightKg (in kg) is updated in handleGoalsChange
    const currentTargetDisplay = unitSystem === 'imperial' ? convertWeight(goals.targetWeightKg, 'kg', 'lbs').toFixed(1) : goals.targetWeightKg.toString();
    if(value !== currentTargetDisplay) { // Only call if there's an actual input change
        handleGoalsChange('targetWeightInput', value);
    }
  };

  const handleDietaryPreferencesChange = (name: string, value: string | number | boolean) => {
    if (name === "interestedInIF" || name === "interestedInRefeedDays") {
      setDietaryPreferences(prev => ({ ...prev, [name]: value as boolean }));
    } else if (name === "ifProtocolType") {
      const type = value as IFProtocolType;
      const newProtocol = { ...DEFAULT_IF_PROTOCOLS[type], type: type };
      setDietaryPreferences(prev => ({ ...prev, ifProtocol: newProtocol }));
    } else if (name === "customFastingHours" || name === "customEatingHours") {
      setDietaryPreferences(prev => ({
        ...prev,
        ifProtocol: {
          ...prev.ifProtocol,
          type: IFProtocolType.CUSTOM,
          [name === "customFastingHours" ? "fastingHours" : "eatingHours"]: parseInt(value as string) || 0,
        }
      }));
    }
  };

  const handleMacroChange = (name: keyof MacroNutrients, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSuggestedMacros(prev => {
        const newMacros = {...prev, [name]: numValue};
        if (name !== 'calories') { // If protein, carbs, or fat changed, update calories
            newMacros.calories = Math.round((newMacros.protein * 4) + (newMacros.carbs * 4) + (newMacros.fat * 9));
        }
        // If calories changed directly, other macros are not auto-adjusted here. User needs to balance.
        return newMacros;
    });
  };

  const nextStep = () => {
    if (step === 3) {
      const bmr = calculateBMR(personalDetails);
      const tdee = calculateTDEE(bmr, activityLevel);
      setCalculatedNutrition({ bmr, tdee });
      const macros = suggestMacros(tdee, goals, personalDetails.currentWeightKg);
      setSuggestedMacros(macros);
    }
    setStep(s => s + 1);
  };
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = () => { // FormEvent removed
    if (!calculatedNutrition) {
        RNAlert.alert("Error", "Nutrition calculations are not complete. Please review previous steps.");
        return;
    }

    const finalProfile: UserProfile = {
      personalDetails,
      activityLevel,
      goals,
      dietaryPreferences,
      calculatedNutrition,
      targetMacros: suggestedMacros,
      quizCompleted: true,
    };
    onQuizComplete(finalProfile);
  };
  
  const renderHeightInput = () => {
    if (unitSystem === 'metric') {
        return <Input label="Height (cm)" keyboardType="numeric" value={personalDetails.heightCm.toString()} onChangeText={(val) => setPersonalDetails(prev => ({...prev, heightCm: parseFloat(val) || 0}))} />;
    }
    // const {feet, inches} = convertHeight(personalDetails.heightCm, 'ft_in') as {feet: number, inches: number}; // This is for display, input state is heightInput
    return (
        <View>
            <Text style={styles.label}>Height (ft, in)</Text>
            <View style={styles.horizontalInputContainer}>
                <Input placeholder="ft" keyboardType="numeric" style={styles.splitInput} value={heightInput.feet} onChangeText={(val) => handlePersonalDetailsChange('heightFeet', val)} />
                <Input placeholder="in" keyboardType="numeric" style={styles.splitInput} value={heightInput.inches} onChangeText={(val) => handlePersonalDetailsChange('heightInches', val)} maxLength={2} />
            </View>
        </View>
    );
  };

  const targetWeightDisplayValue = unitSystem === 'imperial' ? convertWeight(goals.targetWeightKg, 'kg', 'lbs').toFixed(1) : goals.targetWeightKg.toString();
  const currentWeightDisplayValue = unitSystem === 'imperial' ? convertWeight(personalDetails.currentWeightKg, 'kg', 'lbs').toFixed(1) : personalDetails.currentWeightKg.toString();


  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentContainer}>
      <View style={styles.container}>
        <Card style={styles.card}>
            <Text style={styles.mainTitle}>Welcome! Let's set up your profile.</Text>
            
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${(step / 5) * 100}%` }]} />
            </View>
            <Text style={styles.stepText}>Step {step} of 5</Text>

            {step === 1 && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Personal Details</Text>
                <View style={styles.unitToggleInputContainer}>
                  {renderHeightInput()}
                  <Button title={`Use ${unitSystem === 'metric' ? 'Imperial' : 'Metric'}`} onPress={() => setUnitSystem(unitSystem === 'metric' ? 'imperial' : 'metric')} variant="ghost" size="sm" style={styles.unitToggleButton} />
                </View>
                <View style={styles.unitToggleInputContainer}>
                    <Input 
                        label={`Current Weight (${unitSystem === 'metric' ? 'kg' : 'lbs'})`} 
                        keyboardType="numeric" 
                        value={weightInput} 
                        onChangeText={(val) => handlePersonalDetailsChange('currentWeight', val)}
                    />
                    <Button title={`Use ${unitSystem === 'metric' ? 'Imperial' : 'Metric'}`} onPress={handleWeightUnitToggle} variant="ghost" size="sm" style={styles.unitToggleButton} />
                </View>
                <Input label="Age" keyboardType="numeric" value={personalDetails.age.toString()} onChangeText={(val) => handlePersonalDetailsChange('age', val)} />
                <Select label="Sex" selectedValue={personalDetails.sex} onValueChange={(val) => handlePersonalDetailsChange('sex', val as string)} options={Object.values(Sex).map(s => ({ value: s, label: s }))} />
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Activity Level</Text>
                <Select label="Describe your typical activity level" selectedValue={activityLevel} onValueChange={handleActivityLevelChange} options={Object.values(ActivityLevel).map(al => ({ value: al, label: al }))} />
              </View>
            )}

            {step === 3 && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Your Goals</Text>
                 <View style={styles.unitToggleInputContainer}>
                    <Input 
                        label={`Target Weight (${unitSystem === 'metric' ? 'kg' : 'lbs'})`} 
                        keyboardType="numeric" 
                        value={targetWeightDisplayValue}
                        onChangeText={handleTargetWeightInputChange} 
                    />
                    {/* Unit toggle is implicitly handled by the main unitSystem state for target weight, button could be confusing */}
                </View>
                <DatePicker
                    label="Target Date"
                    selectedDate={new Date(goals.targetDate)}
                    onDateChange={(event: DateTimePickerEvent, date?: Date) => {
                        if (date && event.type === "set") { // Check event.type to avoid acting on 'dismissed'
                            handleGoalsChange('targetDate', date.toISOString().split('T')[0]);
                        }
                    }}
                />
                <Textarea label="Briefly describe your fitness plan/goals" value={goals.planDescription} onChangeText={(val) => handleGoalsChange('planDescription', val)} placeholder="e.g., Lose weight, build muscle" />
              </View>
            )}

            {step === 4 && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Dietary Preferences</Text>
                <Toggle label="Interested in Intermittent Fasting?" enabled={dietaryPreferences.interestedInIF} setEnabled={(val) => handleDietaryPreferencesChange("interestedInIF", val)} />
                {dietaryPreferences.interestedInIF && (
                  <View style={styles.indentedSection}>
                    <Select label="IF Protocol" selectedValue={dietaryPreferences.ifProtocol.type} onValueChange={(val) => handleDietaryPreferencesChange("ifProtocolType", val as string)} options={Object.values(IFProtocolType).map(p => ({ value: p, label: p }))} />
                    {dietaryPreferences.ifProtocol.type === IFProtocolType.CUSTOM && (
                      <View style={styles.horizontalInputContainer}>
                        <Input label="Fasting Hours" keyboardType="numeric" style={styles.splitInput} value={dietaryPreferences.ifProtocol.fastingHours?.toString() || ''} onChangeText={(val) => handleDietaryPreferencesChange("customFastingHours", val)} placeholder="e.g., 16" />
                        <Input label="Eating Hours" keyboardType="numeric" style={styles.splitInput} value={dietaryPreferences.ifProtocol.eatingHours?.toString() || ''} onChangeText={(val) => handleDietaryPreferencesChange("customEatingHours", val)} placeholder="e.g., 8" />
                      </View>
                    )}
                  </View>
                )}
                <Toggle label="Interested in Refeed Days?" enabled={dietaryPreferences.interestedInRefeedDays} setEnabled={(val) => handleDietaryPreferencesChange("interestedInRefeedDays", val)} description="Occasional higher calorie days."/>
              </View>
            )}
            
            {step === 5 && calculatedNutrition && (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Nutrition Targets</Text>
                <Text style={styles.infoText}>Based on your input, here are your estimated daily needs. You can adjust these now or later.</Text>
                <View style={styles.summaryBox}>
                  <Text>Basal Metabolic Rate (BMR): {calculatedNutrition.bmr.toLocaleString()} kcal</Text>
                  <Text>Total Daily Energy Expenditure (TDEE): {calculatedNutrition.tdee.toLocaleString()} kcal</Text>
                </View>
                <Text style={styles.subHeader}>Suggested Daily Goals:</Text>
                <Input label="Calories (kcal)" keyboardType="numeric" value={suggestedMacros.calories.toString()} onChangeText={(val) => handleMacroChange('calories', val)} />
                <Input label="Protein (g)" keyboardType="numeric" value={suggestedMacros.protein.toString()} onChangeText={(val) => handleMacroChange('protein', val)} />
                <Input label="Carbohydrates (g)" keyboardType="numeric" value={suggestedMacros.carbs.toString()} onChangeText={(val) => handleMacroChange('carbs', val)} />
                <Input label="Fat (g)" keyboardType="numeric" value={suggestedMacros.fat.toString()} onChangeText={(val) => handleMacroChange('fat', val)} />
              </View>
            )}

            <View style={styles.navigationButtons}>
              {step > 1 && <Button title="Previous" onPress={prevStep} variant="secondary" />}
              <View style={{flex: 1}} /> {/* Spacer */}
              {step < 5 && <Button title="Next" onPress={nextStep} />}
              {step === 5 && <Button title="Complete Profile" onPress={handleSubmit} />}
            </View>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#4A90E2', // Gradient start color
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10, // For Android
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    marginBottom: 5,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 5,
  },
  stepText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  stepContainer: {
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#444',
    marginBottom: 15,
  },
  label: { // General label style if not part of Input component
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  horizontalInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  splitInput: {
    width: '48%', // Adjust as needed for spacing
  },
  unitToggleInputContainer: {
    marginBottom: 10,
  },
  unitToggleButton: {
    marginTop: 8,
    alignSelf: 'flex-start', // Or 'center' / 'flex-end'
  },
  indentedSection: {
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#AED6F1', // Light blue
    marginTop: 10,
    paddingTop: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
  },
  summaryBox: {
    backgroundColor: '#E9F5FC', // Light blue background
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  subHeader: {
    fontSize: 18,
    fontWeight: '500',
    color: '#444',
    marginTop: 10,
    marginBottom: 5,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE'
  },
});

export default OnboardingQuiz;