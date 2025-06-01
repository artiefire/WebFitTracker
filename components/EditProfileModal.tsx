import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Alert as RNAlert } from 'react-native';
import { UserProfile, PersonalDetails, Sex, ActivityLevel, UserGoals, DietaryPreferences, IFProtocolType, IFProtocol, CalculatedNutrition, MacroNutrients, UnitSystem } from '../types';
import { Button, Input, Select, Textarea, Card, Toggle, Modal, DatePicker } from './uiElements';
import { calculateBMR, calculateTDEE, suggestMacros, convertWeight, convertHeight } from '../services/nutritionCalculator';
import { DEFAULT_IF_PROTOCOLS, DEFAULT_USER_PROFILE_GOALS, PROTEIN_KCAL_PER_GRAM, CARBS_KCAL_PER_GRAM, FAT_KCAL_PER_GRAM } from '../constants';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile;
  onSave: (updatedProfile: UserProfile) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, currentUserProfile, onSave }) => {
  const [profileData, setProfileData] = useState<UserProfile>(currentUserProfile);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  
  const getImperialHeight = (cm: number) => cm ? convertHeight(cm, 'ft_in') as {feet: number, inches: number} : {feet: 5, inches: 9};
  const initialImperialHeight = getImperialHeight(currentUserProfile.personalDetails.heightCm);

  const [heightInput, setHeightInput] = useState<{feet: string, inches: string}>({
    feet: initialImperialHeight.feet.toString(), 
    inches: initialImperialHeight.inches.toString()
  });
  
  const [currentWeightInput, setCurrentWeightInput] = useState<string>(
    unitSystem === 'imperial' 
    ? convertWeight(currentUserProfile.personalDetails.currentWeightKg, 'kg', 'lbs').toFixed(1) 
    : currentUserProfile.personalDetails.currentWeightKg.toString()
  );
  const [targetWeightInput, setTargetWeightInput] = useState<string>(
    unitSystem === 'imperial' 
    ? convertWeight(currentUserProfile.goals.targetWeightKg, 'kg', 'lbs').toFixed(1) 
    : currentUserProfile.goals.targetWeightKg.toString()
  );


  useEffect(() => {
    setProfileData(currentUserProfile);
    const newImperialHeight = getImperialHeight(currentUserProfile.personalDetails.heightCm);
    setHeightInput({feet: newImperialHeight.feet.toString(), inches: newImperialHeight.inches.toString()});
    
    setCurrentWeightInput(unitSystem === 'imperial' ? convertWeight(currentUserProfile.personalDetails.currentWeightKg, 'kg', 'lbs').toFixed(1) : currentUserProfile.personalDetails.currentWeightKg.toString());
    setTargetWeightInput(unitSystem === 'imperial' ? convertWeight(currentUserProfile.goals.targetWeightKg, 'kg', 'lbs').toFixed(1) : currentUserProfile.goals.targetWeightKg.toString());

  }, [currentUserProfile, unitSystem, isOpen]); // isOpen ensures reset when modal reopens


  const handlePersonalDetailsChange = (name: string, value: string) => {
    let newPersonalDetails = { ...profileData.personalDetails };

    if (name === "heightFeet" || name === "heightInches") {
        const newHeightInputState = {...heightInput, [name === "heightFeet" ? "feet" : "inches"]: value};
        setHeightInput(newHeightInputState);
        const feet = parseFloat(newHeightInputState.feet) || 0;
        const inches = parseFloat(newHeightInputState.inches) || 0;
        newPersonalDetails.heightCm = Math.round((feet * 12 + inches) * 2.54);
    } else if (name === "currentWeightInput") {
        setCurrentWeightInput(value); // Update the display input state
        const weightVal = parseFloat(value) || 0;
        newPersonalDetails.currentWeightKg = unitSystem === 'imperial' ? convertWeight(weightVal, 'lbs', 'kg') : weightVal;
    } else if (name === 'age') {
        newPersonalDetails.age = parseInt(value) || 0;
    } else if (name === 'sex') {
        newPersonalDetails.sex = value as Sex;
    } else if (name === 'heightCm') {
        newPersonalDetails.heightCm = parseFloat(value) || 0;
    }
    setProfileData(prev => ({ ...prev, personalDetails: newPersonalDetails }));
  };

  const handleUnitSystemToggle = (/*field: 'height' | 'weight' | 'targetWeight'*/) => { // Field param might not be needed due to useEffect
    const newUnitSystem = unitSystem === 'metric' ? 'imperial' : 'metric';
    setUnitSystem(newUnitSystem);
    // useEffect will handle updating input display values based on new unitSystem
  };
  
  const handleGoalsChange = (name: string, value: string) => {
    let newGoals = { ...profileData.goals };

    if (name === "targetWeightInput") {
        setTargetWeightInput(value); // Update display input state
        const weightVal = parseFloat(value) || 0;
        newGoals.targetWeightKg = unitSystem === 'imperial' ? convertWeight(weightVal, 'lbs', 'kg') : weightVal;
    } else if (name === 'targetDate') {
        newGoals.targetDate = value; // Assuming value is ISO string from DatePicker
    } else if (name === 'planDescription') {
        newGoals.planDescription = value;
    }
    setProfileData(prev => ({ ...prev, goals: newGoals }));
  };

  const handleActivityLevelChange = (value: string | number) => {
    setProfileData(prev => ({ ...prev, activityLevel: value as ActivityLevel }));
  };

  const handleDietaryPreferencesChange = (name: string, value: string | number | boolean) => {
    let newDietaryPrefs = { ...profileData.dietaryPreferences };

    if (name === "interestedInIF" || name === "interestedInRefeedDays") {
      newDietaryPrefs = { ...newDietaryPrefs, [name]: value as boolean };
    } else if (name === "ifProtocolType") {
      const protocolType = value as IFProtocolType;
      newDietaryPrefs.ifProtocol = { ...DEFAULT_IF_PROTOCOLS[protocolType], type: protocolType };
    } else if (name === "customFastingHours" || name === "customEatingHours") {
      newDietaryPrefs.ifProtocol = {
        ...newDietaryPrefs.ifProtocol,
        type: IFProtocolType.CUSTOM,
        [name === "customFastingHours" ? "fastingHours" : "eatingHours"]: parseInt(value as string) || 0,
      };
    }
    setProfileData(prev => ({ ...prev, dietaryPreferences: newDietaryPrefs }));
  };
  
  const handleRecalculateAndSuggestMacros = () => {
    const bmr = calculateBMR(profileData.personalDetails);
    const tdee = calculateTDEE(bmr, profileData.activityLevel);
    const suggested = suggestMacros(tdee, profileData.goals, profileData.personalDetails.currentWeightKg);
    setProfileData(prev => ({
      ...prev,
      calculatedNutrition: { bmr, tdee },
      targetMacros: suggested,
    }));
  };

  const handleMacroChange = (name: keyof MacroNutrients, value: string) => {
    const numValue = parseFloat(value) || 0;
    setProfileData(prev => {
        const newMacros = {...prev.targetMacros, [name]: numValue};
        if (name === 'protein' || name === 'carbs' || name === 'fat') {
            newMacros.calories = Math.round((newMacros.protein * PROTEIN_KCAL_PER_GRAM) + 
                                 (newMacros.carbs * CARBS_KCAL_PER_GRAM) + 
                                 (newMacros.fat * FAT_KCAL_PER_GRAM));
        }
        return {...prev, targetMacros: newMacros};
    });
  };

  const handleSubmit = () => { // FormEvent removed
    onSave(profileData);
    onClose();
  };

  const renderHeightInput = () => {
    if (unitSystem === 'metric') {
        return <Input label="Height (cm)" keyboardType="numeric" value={profileData.personalDetails.heightCm.toString()} onChangeText={(val) => handlePersonalDetailsChange('heightCm', val)} />;
    }
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


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Your Profile" size="xl">
      <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalContentContainer}>
        {/* Personal Details */}
        <Card title="Personal Details" style={styles.cardStyle}>
            <View style={styles.detailRow}>
                {renderHeightInput()}
                <Button title={`Use ${unitSystem === 'metric' ? 'Imperial' : 'Metric'}`} onPress={handleUnitSystemToggle} variant="ghost" size="sm" style={styles.unitToggleBtn} />
            </View>
             <View style={styles.detailRow}>
                <Input label={`Current Weight (${unitSystem === 'metric' ? 'kg' : 'lbs'})`} keyboardType="numeric" value={currentWeightInput} onChangeText={(val) => handlePersonalDetailsChange('currentWeightInput', val)} />
                <Button title={`Use ${unitSystem === 'metric' ? 'Imperial' : 'Metric'}`} onPress={handleUnitSystemToggle} variant="ghost" size="sm" style={styles.unitToggleBtn} />
            </View>
            <View style={styles.formGrid}>
                <Input label="Age" keyboardType="numeric" value={profileData.personalDetails.age.toString()} onChangeText={(val) => handlePersonalDetailsChange('age', val)} style={styles.gridItem}/>
                <Select label="Sex" selectedValue={profileData.personalDetails.sex} onValueChange={(val) => handlePersonalDetailsChange('sex', val as string)} options={Object.values(Sex).map(s => ({ value: s, label: s }))} style={styles.gridItem}/>
            </View>
        </Card>

        <Card title="Activity Level" style={styles.cardStyle}>
            <Select label="Describe your typical activity level" selectedValue={profileData.activityLevel} onValueChange={handleActivityLevelChange} options={Object.values(ActivityLevel).map(al => ({ value: al, label: al }))} />
        </Card>

        <Card title="Your Goals" style={styles.cardStyle}>
            <View style={styles.detailRow}>
                <Input label={`Target Weight (${unitSystem === 'metric' ? 'kg' : 'lbs'})`} keyboardType="numeric" value={targetWeightInput} onChangeText={(val) => handleGoalsChange('targetWeightInput', val)} />
                <Button title={`Use ${unitSystem === 'metric' ? 'Imperial' : 'Metric'}`} onPress={handleUnitSystemToggle} variant="ghost" size="sm" style={styles.unitToggleBtn} />
            </View>
             <DatePicker
                label="Target Date"
                selectedDate={new Date(profileData.goals.targetDate + 'T00:00:00Z')} // Ensure UTC for date picker consistency
                onDateChange={(event: DateTimePickerEvent, date?: Date) => {
                    if(date && event.type === 'set') handleGoalsChange('targetDate', date.toISOString().split('T')[0]);
                }}
            />
            <Textarea label="Briefly describe your fitness plan/goals" value={profileData.goals.planDescription} onChangeText={(val) => handleGoalsChange('planDescription', val)} placeholder="e.g., Lose weight, build muscle" />
        </Card>
        
        <Card title="Dietary Preferences" style={styles.cardStyle}>
            <Toggle label="Interested in Intermittent Fasting?" name="interestedInIF" enabled={profileData.dietaryPreferences.interestedInIF} setEnabled={(val) => handleDietaryPreferencesChange("interestedInIF", val)} />
            {profileData.dietaryPreferences.interestedInIF && (
            <View style={styles.indentedSection}>
                <Select label="IF Protocol" selectedValue={profileData.dietaryPreferences.ifProtocol.type} onValueChange={(val) => handleDietaryPreferencesChange("ifProtocolType", val as string)} options={Object.values(IFProtocolType).map(p => ({ value: p, label: p }))} />
                {profileData.dietaryPreferences.ifProtocol.type === IFProtocolType.CUSTOM && (
                <View style={styles.horizontalInputContainer}>
                    <Input label="Fasting Hours" keyboardType="numeric" style={styles.splitInput} value={profileData.dietaryPreferences.ifProtocol.fastingHours?.toString() || ''} onChangeText={(val) => handleDietaryPreferencesChange("customFastingHours", val)} placeholder="e.g., 16" />
                    <Input label="Eating Hours" keyboardType="numeric" style={styles.splitInput} value={profileData.dietaryPreferences.ifProtocol.eatingHours?.toString() || ''} onChangeText={(val) => handleDietaryPreferencesChange("customEatingHours", val)} placeholder="e.g., 8" />
                </View>
                )}
            </View>
            )}
            <Toggle style={{marginTop:10}} label="Interested in Refeed Days?" name="interestedInRefeedDays" enabled={profileData.dietaryPreferences.interestedInRefeedDays} setEnabled={(val) => handleDietaryPreferencesChange("interestedInRefeedDays", val)} description="Occasional higher calorie days."/>
        </Card>

        <Card title="Nutrition Targets" style={styles.cardStyle}>
            <View style={styles.recalculateButtonContainer}>
                <Button title="Recalculate & Suggest Macros" variant="outline" size="sm" onPress={handleRecalculateAndSuggestMacros} />
            </View>
            <Text style={styles.infoText}>BMR: {profileData.calculatedNutrition.bmr.toLocaleString()} kcal, TDEE: {profileData.calculatedNutrition.tdee.toLocaleString()} kcal</Text>
            <View style={styles.formGrid}>
                <Input label="Target Calories (kcal)" keyboardType="numeric" value={profileData.targetMacros.calories.toString()} onChangeText={(val) => handleMacroChange('calories', val)} style={styles.gridItem} />
                <Input label="Target Protein (g)" keyboardType="numeric" value={profileData.targetMacros.protein.toString()} onChangeText={(val) => handleMacroChange('protein', val)} style={styles.gridItem} />
                <Input label="Target Carbohydrates (g)" keyboardType="numeric" value={profileData.targetMacros.carbs.toString()} onChangeText={(val) => handleMacroChange('carbs', val)} style={styles.gridItem} />
                <Input label="Target Fat (g)" keyboardType="numeric" value={profileData.targetMacros.fat.toString()} onChangeText={(val) => handleMacroChange('fat', val)} style={styles.gridItem} />
            </View>
        </Card>

        <View style={styles.modalActions}>
          <Button title="Cancel" variant="secondary" onPress={onClose} />
          <Button title="Save Changes" onPress={handleSubmit} />
        </View>
      </ScrollView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalScrollView: {
    // Max height is handled by Modal component's inner structure
  },
  modalContentContainer: {
    paddingBottom: 20, // Ensure space for the final buttons
  },
  cardStyle: {
    marginBottom: 16,
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
    width: '48%',
  },
  detailRow: {
    marginBottom: 10, // Spacing between rows of inputs like height/weight and their toggles
  },
  unitToggleBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  formGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap', // Allow wrapping on smaller screens if needed
  },
  gridItem: {
    width: '48%', // For two items per row in the grid
    marginBottom: 10, // Space between grid rows
  },
  indentedSection: {
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#AED6F1',
    marginTop: 10,
    paddingTop: 5,
  },
  recalculateButtonContainer: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});

export default EditProfileModal;