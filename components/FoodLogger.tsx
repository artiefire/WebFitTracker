import React, { useState, ChangeEvent, FormEvent, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert as RNAlert, Image, ScrollView, Platform } from 'react-native';
import { DailyLog, FoodEntry, MacroNutrients, UserProfile } from '../types';
import { Button, Input, Modal, Card, DatePicker, Toggle, ProgressBar, Pill, Textarea, Select, Alert as UIAlert } from './uiElements';
import { sumFoodEntryMacros } from '../services/nutritionCalculator';
import { DEFAULT_INITIAL_MACROS } from '../constants';
import { getNutritionFromText, getNutritionFromImageAndText, fileToBase64 } from '../services/aiNutritionService';
import { launchCamera, launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';


interface FoodLoggerProps {
  userProfile: UserProfile | null;
  dailyLogs: DailyLog[];
  setDailyLogs: React.Dispatch<React.SetStateAction<DailyLog[]>>;
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
}

type EntryMode = "manual" | "aiText" | "aiImage";

const initialFoodEntryData: Omit<FoodEntry, 'id' | 'loggedAt'> = {
  name: '',
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  servingSize: '1 serving',
  quantity: 1,
  mealTime: new Date().toISOString(),
  notes: '',
  photoIdentifier: '', // This could store a local URI in React Native
  apiSource: '',
  aiAssisted: false,
};


const FoodLogger: React.FC<FoodLoggerProps> = ({ userProfile, dailyLogs, setDailyLogs, selectedDate, setSelectedDate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentFoodEntry, setCurrentFoodEntry] = useState<Omit<FoodEntry, 'id' | 'loggedAt'>>(initialFoodEntryData);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [entryMode, setEntryMode] = useState<EntryMode>("manual");
  const [aiTextQuery, setAiTextQuery] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<{ uri: string; base64?: string; type?: string } | null>(null); // Store image URI and base64
  const [aiImageTextRefinement, setAiImageTextRefinement] = useState<string>("");
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState<boolean>(false);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

  const [selectedMealTime, setSelectedMealTime] = useState(new Date()); // For DateTimePicker

  const determineEffectiveGoals = useCallback((isRefeed: boolean): MacroNutrients => {
    if (!userProfile) return DEFAULT_INITIAL_MACROS;
    if (isRefeed && userProfile.dietaryPreferences.interestedInRefeedDays) {
      const refeedCalories = Math.round(userProfile.calculatedNutrition.tdee * 1.15);
      const calorieRatio = userProfile.targetMacros.calories > 0 ? refeedCalories / userProfile.targetMacros.calories : 1;
      return {
        calories: refeedCalories,
        protein: Math.round(userProfile.targetMacros.protein * calorieRatio),
        carbs: Math.round(userProfile.targetMacros.carbs * calorieRatio),
        fat: Math.round(userProfile.targetMacros.fat * calorieRatio),
      };
    }
    return userProfile.targetMacros;
  }, [userProfile]);

  const updateDailyLog = useCallback((date: string, updates: Partial<DailyLog>) => {
    setDailyLogs(prevLogs => {
      const existingLogIndex = prevLogs.findIndex(log => log.date === date);
      if (existingLogIndex > -1) {
        const updatedLog = { ...prevLogs[existingLogIndex], ...updates };
        if (updates.foodEntries || updates.totals !== undefined) { // Check if totals is explicitly passed
            updatedLog.totals = sumFoodEntryMacros(updatedLog.foodEntries || prevLogs[existingLogIndex].foodEntries);
        }
        return prevLogs.map((log, index) => index === existingLogIndex ? updatedLog : log);
      } else if (userProfile) { 
        const baseGoals = determineEffectiveGoals(updates.isRefeedDay || false);
        const newLog: DailyLog = {
          date,
          foodEntries: [],
          isRefeedDay: false,
          effectiveCaloriesGoal: baseGoals.calories,
          effectiveMacrosGoal: baseGoals,
          totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          ...updates,
        };
        if (newLog.foodEntries && newLog.foodEntries.length > 0) { // foodEntries might be part of updates
            newLog.totals = sumFoodEntryMacros(newLog.foodEntries);
        }
        if (updates.isRefeedDay !== undefined) {
            const recheckGoals = determineEffectiveGoals(updates.isRefeedDay);
            newLog.effectiveCaloriesGoal = recheckGoals.calories;
            newLog.effectiveMacrosGoal = recheckGoals;
        }
        return [...prevLogs, newLog];
      }
      return prevLogs;
    });
  }, [userProfile, setDailyLogs, determineEffectiveGoals]);


  useEffect(() => {
    if (!userProfile) return;
    const logForSelectedDate = dailyLogs.find(log => log.date === selectedDate);
    let modifications: Partial<DailyLog> = {};
    let createNewLog = !logForSelectedDate;

    if (createNewLog) {
        const effectiveGoals = determineEffectiveGoals(false);
        modifications = {
            foodEntries: [], isRefeedDay: false,
            effectiveCaloriesGoal: effectiveGoals.calories, effectiveMacrosGoal: effectiveGoals,
            totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        };
    } else if (logForSelectedDate) {
        const expectedEffectiveGoals = determineEffectiveGoals(logForSelectedDate.isRefeedDay);
        if (logForSelectedDate.effectiveCaloriesGoal !== expectedEffectiveGoals.calories ||
            JSON.stringify(logForSelectedDate.effectiveMacrosGoal) !== JSON.stringify(expectedEffectiveGoals)) {
            modifications.effectiveCaloriesGoal = expectedEffectiveGoals.calories;
            modifications.effectiveMacrosGoal = expectedEffectiveGoals;
        }
        const calculatedTotals = sumFoodEntryMacros(logForSelectedDate.foodEntries);
        if (JSON.stringify(logForSelectedDate.totals) !== JSON.stringify(calculatedTotals)) {
            modifications.totals = calculatedTotals;
        }
    }

    if (createNewLog || Object.keys(modifications).length > 0) {
        updateDailyLog(selectedDate, modifications);
    }
  }, [selectedDate, userProfile, dailyLogs, updateDailyLog, determineEffectiveGoals]);


  const handleFoodEntryChange = (name: keyof Omit<FoodEntry, 'id' | 'loggedAt'>, value: string | number | boolean) => {
    setCurrentFoodEntry(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  const handleNumericFoodEntryChange = (name: 'calories' | 'protein' | 'carbs' | 'fat' | 'quantity', value: string) => {
    handleFoodEntryChange(name, parseFloat(value) || 0);
  };


  const handleImagePickerResponse = (response: ImagePickerResponse) => {
    if (response.didCancel) {
        console.log('User cancelled image picker');
        setAiAnalysisError('Image selection was cancelled.');
    } else if (response.errorCode) {
        console.log('ImagePicker Error: ', response.errorMessage);
        setAiAnalysisError(response.errorMessage || 'Failed to load image.');
    } else if (response.assets && response.assets.length > 0) {
        const asset: Asset = response.assets[0];
        if (asset.uri && asset.base64 && asset.type) {
            setSelectedImage({ uri: asset.uri, base64: asset.base64, type: asset.type });
            setAiAnalysisError(null);
        } else {
            setAiAnalysisError('Selected image is missing URI, Base64 data, or type.');
        }
    } else {
        setAiAnalysisError('No image selected or an unexpected error occurred.');
    }
  };

  const pickImageFromLibrary = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        maxHeight: 1024,
        maxWidth: 1024,
        quality: 0.8,
      });
      handleImagePickerResponse(response);
    } catch (error) {
      console.error("Error launching image library: ", error);
      setAiAnalysisError("Failed to open image library.");
    }
  };

  const captureImageWithCamera = async () => {
    try {
      const response = await launchCamera({
        mediaType: 'photo',
        includeBase64: true,
        maxHeight: 1024,
        maxWidth: 1024,
        quality: 0.8,
        saveToPhotos: false, // Optionally save to photos, be mindful of permissions
      });
      handleImagePickerResponse(response);
    } catch (error) {
      console.error("Error launching camera: ", error);
      setAiAnalysisError("Failed to open camera.");
    }
  };

  const showImagePickerOptions = () => {
    RNAlert.alert(
      "Select Food Image",
      "Choose an image source:",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo...", onPress: captureImageWithCamera },
        { text: "Choose from Library...", onPress: pickImageFromLibrary },
      ]
    );
  };


  const handleAiAnalyze = async () => {
    setAiAnalysisLoading(true);
    setAiAnalysisError(null);
    try {
        let nutritionData: Partial<FoodEntry> | null = null;
        if (entryMode === "aiText" && aiTextQuery) {
            nutritionData = await getNutritionFromText(aiTextQuery);
        } else if (entryMode === "aiImage" && selectedImage?.base64 && selectedImage?.type) {
            nutritionData = await getNutritionFromImageAndText(selectedImage.base64, selectedImage.type, aiImageTextRefinement);
        } else {
            setAiAnalysisError("No query or image provided for AI analysis.");
            setAiAnalysisLoading(false);
            return;
        }

        if (nutritionData) {
            setCurrentFoodEntry(prev => ({
                ...prev,
                name: nutritionData.name || prev.name || '',
                calories: nutritionData.calories || 0,
                protein: nutritionData.protein || 0,
                carbs: nutritionData.carbs || 0,
                fat: nutritionData.fat || 0,
                servingSize: nutritionData.servingSize || prev.servingSize || '1 serving',
                aiAssisted: true,
                photoIdentifier: entryMode === "aiImage" ? selectedImage?.uri : prev.photoIdentifier, // Store local URI if it's an image
            }));
        } else {
            setAiAnalysisError("AI analysis did not return valid data. Please try rephrasing or enter manually.");
        }
    } catch (error: any) {
        console.error("AI Analysis Error:", error);
        setAiAnalysisError(error.message || "An unknown error occurred during AI analysis.");
    }
    setAiAnalysisLoading(false);
  };

  const handleAddOrUpdateFoodEntry = () => { // FormEvent removed
    if (!userProfile) return;

    const logForDay = dailyLogs.find(l => l.date === selectedDate);
    let newFoodEntries: FoodEntry[];

    const entryDataToSave = {
        ...currentFoodEntry,
        mealTime: selectedMealTime.toISOString(), // Use date from DateTimePicker
    };

    if (editingEntryId) {
        newFoodEntries = (logForDay?.foodEntries || []).map(entry => 
            entry.id === editingEntryId 
            ? { ...entry, ...entryDataToSave, loggedAt: entry.loggedAt } // Keep original loggedAt
            : entry
        );
    } else {
        const newEntry: FoodEntry = {
            ...entryDataToSave,
            id: crypto.randomUUID(), // crypto.randomUUID might need a polyfill or alternative in older RN versions
            loggedAt: new Date().toISOString(),
        };
        newFoodEntries = [...(logForDay?.foodEntries || []), newEntry];
    }
    
    updateDailyLog(selectedDate, { foodEntries: newFoodEntries });
    resetModalState();
  };

  const handleEditFoodEntry = (entry: FoodEntry) => {
    const { id, loggedAt, ...editablePart } = entry;
    setCurrentFoodEntry({
        ...initialFoodEntryData,
        ...editablePart,
    });
    setSelectedMealTime(new Date(editablePart.mealTime || new Date().toISOString()));
    setEditingEntryId(id);
    if (editablePart.photoIdentifier) {
        setSelectedImage({ uri: editablePart.photoIdentifier }); // Assume photoIdentifier stores local URI
    }
    setEntryMode("manual");
    setIsModalOpen(true);
  };

  const handleDeleteFoodEntry = (entryId: string) => {
    RNAlert.alert("Delete Entry", "Are you sure you want to delete this food entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => {
          const log = dailyLogs.find(l => l.date === selectedDate);
          if (!log) return;
          const updatedEntries = log.foodEntries.filter(entry => entry.id !== entryId);
          updateDailyLog(selectedDate, { foodEntries: updatedEntries });
        },
      },
    ]);
  };
  
  const toggleRefeedDay = () => {
    if (!userProfile || !userProfile.dietaryPreferences.interestedInRefeedDays) return;
    const log = dailyLogs.find(l => l.date === selectedDate);
    const newIsRefeedDay = !(log?.isRefeedDay || false);
    const newEffectiveGoals = determineEffectiveGoals(newIsRefeedDay);
    updateDailyLog(selectedDate, { 
        isRefeedDay: newIsRefeedDay,
        effectiveCaloriesGoal: newEffectiveGoals.calories,
        effectiveMacrosGoal: newEffectiveGoals
    });
  };

  const resetModalState = () => {
    setIsModalOpen(false);
    setCurrentFoodEntry(initialFoodEntryData);
    setEditingEntryId(null);
    setEntryMode("manual");
    setAiTextQuery("");
    setSelectedImage(null);
    setAiImageTextRefinement("");
    setAiAnalysisLoading(false);
    setAiAnalysisError(null);
    setSelectedMealTime(new Date());
  };

  const todaysLog = dailyLogs.find(log => log.date === selectedDate);
  const effectiveGoals = todaysLog 
    ? { calories: todaysLog.effectiveCaloriesGoal, ...todaysLog.effectiveMacrosGoal } 
    : (userProfile ? determineEffectiveGoals(false) : DEFAULT_INITIAL_MACROS);
  const dailyTotals = todaysLog ? todaysLog.totals : { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const calculateProgress = (consumed: number, goal: number) => goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;

  if (!userProfile) {
    return <Card title="Food Log"><Text>Please complete your profile to start logging food.</Text></Card>;
  }

  const entryModeOptions = [
    { value: "manual", label: "Manual Entry" },
    { value: "aiText", label: "AI Text Analysis" },
    { value: "aiImage", label: "AI Image Analysis" },
  ];
  
  const renderFoodEntryItem = ({ item }: { item: FoodEntry }) => (
    <View style={styles.entryItem}>
      <View style={styles.entryDetails}>
        <Text style={styles.entryName}>{item.name} </Text>
        <View style={styles.pillsContainer}>
            <Pill style={styles.entryPill}>{item.quantity} x {item.servingSize}</Pill>
            {item.aiAssisted && <Pill color="#E9D5FF" textColor="#5B21B6" style={styles.entryPill}>AI</Pill>}
        </View>
        <Text style={styles.entryMacros}>{item.calories * item.quantity} kcal | P: {item.protein * item.quantity}g | C: {item.carbs * item.quantity}g | F: {item.fat * item.quantity}g</Text>
        {item.notes && <Text style={styles.entryNotes}>Notes: {item.notes}</Text>}
        <Text style={styles.entryMealTime}>Meal Time: {new Date(item.mealTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      <View style={styles.entryActions}>
        <Button onPress={() => handleEditFoodEntry(item)} variant="ghost" size="sm" style={styles.actionButton} title="Edit" />
        <Button onPress={() => handleDeleteFoodEntry(item.id)} variant="danger" size="sm" style={styles.actionButton} title="Del" />
      </View>
    </View>
  );


  return (
    <View style={styles.container}>
      <Card 
        title={`Nutrition Log for ${new Date(selectedDate + 'T00:00:00Z').toLocaleDateString()}`} // Ensure UTC for date consistency
        actions={
          <View style={styles.headerActions}>
             <DatePicker 
                selectedDate={new Date(selectedDate + 'T00:00:00Z')} 
                onDateChange={(event: DateTimePickerEvent, date?: Date) => {
                    if(date && event.type === 'set') setSelectedDate(date.toISOString().split('T')[0]);
                }} 
                style={styles.datePickerAction}
             />
             <Button 
                onPress={() => { resetModalState(); setIsModalOpen(true);}} 
                variant="primary" 
                size="sm" 
                title="Log Food"
                leftIcon={<Text style={{color: 'white', fontSize: 18}}>+</Text>} // Placeholder for icon
             />
          </View>
        }
      >
        {userProfile.dietaryPreferences.interestedInRefeedDays && (
          <View style={styles.refeedToggleContainer}>
            <Toggle label="Refeed Day" enabled={todaysLog?.isRefeedDay || false} setEnabled={toggleRefeedDay}
              description={todaysLog?.isRefeedDay ? `Goals adjusted for refeed (${effectiveGoals.calories.toFixed(0)} kcal)` : "Standard goals apply"}/>
          </View>
        )}

        <View style={styles.macrosGrid}>
          <Card style={styles.macroCard}><Text style={styles.macroLabel}>Calories</Text><Text style={styles.macroValue}>{dailyTotals.calories.toFixed(0)} / {effectiveGoals.calories.toFixed(0)} kcal</Text><ProgressBar value={calculateProgress(dailyTotals.calories, effectiveGoals.calories)} color="#3B82F6" /></Card>
          <Card style={styles.macroCard}><Text style={styles.macroLabel}>Protein</Text><Text style={styles.macroValue}>{dailyTotals.protein.toFixed(0)} / {effectiveGoals.protein.toFixed(0)} g</Text><ProgressBar value={calculateProgress(dailyTotals.protein, effectiveGoals.protein)} color="#10B981" /></Card>
          <Card style={styles.macroCard}><Text style={styles.macroLabel}>Carbs</Text><Text style={styles.macroValue}>{dailyTotals.carbs.toFixed(0)} / {effectiveGoals.carbs.toFixed(0)} g</Text><ProgressBar value={calculateProgress(dailyTotals.carbs, effectiveGoals.carbs)} color="#F59E0B" /></Card>
          <Card style={styles.macroCard}><Text style={styles.macroLabel}>Fat</Text><Text style={styles.macroValue}>{dailyTotals.fat.toFixed(0)} / {effectiveGoals.fat.toFixed(0)} g</Text><ProgressBar value={calculateProgress(dailyTotals.fat, effectiveGoals.fat)} color="#EF4444" /></Card>
        </View>

        {todaysLog && todaysLog.foodEntries.length > 0 ? (
          <FlatList
            data={todaysLog.foodEntries}
            renderItem={renderFoodEntryItem}
            keyExtractor={item => item.id}
            style={styles.entriesList}
          />
        ) : (
          <Text style={styles.noEntriesText}>No food logged for this day yet. Click "Log Food" to start!</Text>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={resetModalState} title={editingEntryId ? "Edit Food Entry" : "Log New Food Item"} size="lg">
        <ScrollView>
          <Select label="Entry Mode" options={entryModeOptions} selectedValue={entryMode} onValueChange={(val) => setEntryMode(val as EntryMode)} enabled={!editingEntryId}/>
          
          {aiAnalysisError && <UIAlert type="error" message={aiAnalysisError} onClose={() => setAiAnalysisError(null)} />}

          {entryMode === "aiText" && !editingEntryId && (
            <View style={styles.aiSection}>
              <Textarea label="Describe your meal for AI Analysis" value={aiTextQuery} onChangeText={setAiTextQuery} placeholder="e.g., A bowl of chicken soup..." />
              <Button title={aiAnalysisLoading ? 'Analyzing...' : 'Analyze with AI (Text)'} onPress={handleAiAnalyze} disabled={aiAnalysisLoading || !aiTextQuery} style={{marginTop: 10}} />
            </View>
          )}

          {entryMode === "aiImage" && !editingEntryId && (
            <View style={styles.aiSection}>
              <Button title="Upload Food Image" onPress={showImagePickerOptions} style={{marginBottom:10}} />
              {selectedImage?.uri && <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />}
              <Textarea label="Additional details for AI (optional)" value={aiImageTextRefinement} onChangeText={setAiImageTextRefinement} placeholder="e.g., This is from the lunch menu..."/>
              <Button title={aiAnalysisLoading ? 'Analyzing...' : 'Analyze with AI (Image)'} onPress={handleAiAnalyze} disabled={aiAnalysisLoading || !selectedImage} style={{marginTop:10}} />
            </View>
          )}
          
          <Text style={styles.detailsHeader}>{currentFoodEntry.aiAssisted ? "Food Details (AI Assisted - Review & Adjust)" : "Food Details"}</Text>
          <Input label="Food Name" value={currentFoodEntry.name} onChangeText={(val) => handleFoodEntryChange('name', val)} />
          <View style={styles.formGrid}>
            <Input label="Calories (per serving)" keyboardType="numeric" value={currentFoodEntry.calories.toString()} onChangeText={(val) => handleNumericFoodEntryChange('calories', val)} style={styles.gridItem}/>
            <Input label="Protein (g)" keyboardType="numeric" value={currentFoodEntry.protein.toString()} onChangeText={(val) => handleNumericFoodEntryChange('protein', val)} style={styles.gridItem}/>
            <Input label="Carbs (g)" keyboardType="numeric" value={currentFoodEntry.carbs.toString()} onChangeText={(val) => handleNumericFoodEntryChange('carbs', val)} style={styles.gridItem}/>
            <Input label="Fat (g)" keyboardType="numeric" value={currentFoodEntry.fat.toString()} onChangeText={(val) => handleNumericFoodEntryChange('fat', val)} style={styles.gridItem}/>
          </View>
          <View style={styles.formGrid}>
            <Input label="Serving Size" value={currentFoodEntry.servingSize} onChangeText={(val) => handleFoodEntryChange('servingSize', val)} style={styles.gridItem}/>
            <Input label="Quantity" keyboardType="numeric" value={currentFoodEntry.quantity.toString()} onChangeText={(val) => handleNumericFoodEntryChange('quantity', val)} style={styles.gridItem}/>
          </View>
          <DatePicker
            label="Meal Time"
            selectedDate={selectedMealTime}
            onDateChange={(event: DateTimePickerEvent, date?: Date) => {
                if(date && event.type === 'set') setSelectedMealTime(date);
            }}
            mode="datetime"
          />
          <Textarea label="Notes (optional)" value={currentFoodEntry.notes || ''} onChangeText={(val) => handleFoodEntryChange('notes', val)} />
          
          <Toggle label="AI Assisted Entry" enabled={currentFoodEntry.aiAssisted || false} setEnabled={(val) => handleFoodEntryChange('aiAssisted', val)} />
          
          <View style={styles.modalActions}>
            <Button title="Cancel" variant="secondary" onPress={resetModalState} />
            <Button title={editingEntryId ? "Update Entry" : "Add Entry"} onPress={handleAddOrUpdateFoodEntry} disabled={aiAnalysisLoading} />
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Platform.OS === 'ios' ? 0 : 8, // Add padding for Android where Card might not have enough space from screen edges
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  datePickerAction: {
    flex: 1, // Allow date picker to take some space
    marginRight: 8,
  },
  refeedToggleContainer: {
    marginVertical: 10,
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  macroCard: {
    width: '48%', // For 2 cards per row
    marginBottom: 10,
    padding: 10,
     // backgroundColor: '#F9FAFB', // Example for individual card background
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '500',
    // color based on progress bar or fixed
  },
  macroValue: {
    fontSize: Platform.OS === 'ios' ? 18: 16,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  entriesList: {
    maxHeight: 300, // Or use flex: 1 if parent has fixed height
  },
  entryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    backgroundColor: '#FFF',
    borderRadius: 6,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  entryDetails: {
    flex: 1,
    marginRight: 8,
  },
  entryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  entryPill: {
    marginRight: 4,
    marginBottom: 4, // if pills wrap
  },
  entryMacros: {
    fontSize: 13,
    color: '#555',
    marginTop: 3,
  },
  entryNotes: {
    fontSize: 12,
    color: '#777',
    fontStyle: 'italic',
    marginTop: 2,
  },
  entryMealTime: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  entryActions: {
    flexDirection: 'column',
    alignItems: 'flex-end', // Align buttons to the right if stacked vertically
    justifyContent: 'space-around',
  },
  actionButton: {
    paddingHorizontal: 8, // Smaller padding for compact buttons
    paddingVertical: 4,
    minWidth: 60, // Ensure some minimum width for tapability
    marginVertical: 2,
  },
  noEntriesText: {
    textAlign: 'center',
    color: '#6B7280',
    paddingVertical: 30,
    fontSize: 16,
  },
  // Modal Form Styles
  aiSection: {
    marginVertical: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    borderRadius: 6,
    marginVertical: 10,
    alignSelf: 'center',
  },
  detailsHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  formGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '48%', // For two items per row
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

export default FoodLogger;