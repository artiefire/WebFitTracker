







import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, ActivityIndicator, Alert as RNAlert, TextStyle } from 'react-native';
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
  HealthInputOptions,
  // SleepSample, // Removed, will rely on type inference or ensure correct type path if needed
  // SleepSampleValues, // Removed, will use AppleHealthKit.Constants
  // PermissionStatus, // Removed, will use AppleHealthKit.Constants
  HealthPermission, 
  // Constants will be accessed via AppleHealthKit.Constants
} from 'react-native-health';
import { UserProfile, DailyLog, FastingTimerState, UnitSystem, IFProtocolType, TimerStatus, HealthData, MacroNutrients } from '../types';
import FoodLogger from './FoodLogger'; 
import IFTimerDisplay from './IFTimerDisplay';
import EditProfileModal from './EditProfileModal';
import { Card, Button, Pill, Toggle, Alert as UIAlert, ProgressBar } from './uiElements';
import { convertWeight, convertHeight } from '../services/nutritionCalculator';
import { INITIAL_FASTING_TIMER_STATE, DEFAULT_IF_PROTOCOLS, DEFAULT_INITIAL_MACROS } from '../constants';

interface DashboardProps {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  dailyLogs: DailyLog[];
  setDailyLogs: React.Dispatch<React.SetStateAction<DailyLog[]>>;
  fastingTimerState: FastingTimerState;
  setFastingTimerState: React.Dispatch<React.SetStateAction<FastingTimerState>>;
  navigation?: any; // For potential navigation actions from dashboard
}

const healthKitPermissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
    ],
    write: [], // No write permissions requested for now
  },
};

const Dashboard: React.FC<DashboardProps> = ({ userProfile, setUserProfile, dailyLogs, setDailyLogs, fastingTimerState, setFastingTimerState, navigation }) => {
  const [selectedFoodLogDate, setSelectedFoodLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  const [healthKitAuthorized, setHealthKitAuthorized] = useState(false);
  const [healthData, setHealthData] = useState<HealthData>({});
  const [healthKitError, setHealthKitError] = useState<string | null>(null);
  const [healthKitLoading, setHealthKitLoading] = useState<boolean>(false);

  const currentLog = dailyLogs.find(log => log.date === selectedFoodLogDate);
  const todaysMacros = currentLog?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const targetMacros = currentLog?.effectiveMacrosGoal || userProfile?.targetMacros || DEFAULT_INITIAL_MACROS;


  const fetchHealthData = useCallback(() => {
    if (!healthKitAuthorized) {
      setHealthKitError("HealthKit not authorized. Please authorize first.");
      return;
    }
    setHealthKitLoading(true);
    setHealthKitError(null);
    let fetchedData: HealthData = {};
    let errors: string[] = [];

    const todayOptions: HealthInputOptions = {
      date: new Date().toISOString(), 
      includeManuallyAdded: true,
    };
    
    const recentSampleOptions: HealthInputOptions = {
        startDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(), 
        endDate: new Date().toISOString(),
        limit: 1, 
        ascending: false, 
    };

    const sleepOptions: HealthInputOptions = {
      startDate: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(), 
      endDate: new Date().toISOString(),
    };


    const promises = [
      new Promise<void>((resolve) => {
        AppleHealthKit.getStepCount(todayOptions, (err: string, results: HealthValue) => {
          if (err) errors.push(`Steps: ${err}`);
          else if (results) fetchedData.steps = results.value;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        AppleHealthKit.getActiveEnergyBurned(todayOptions, (err: string, results: Array<HealthValue>) => {
          if (err) errors.push(`Active Energy: ${err}`);
          else if (results && results.length > 0) fetchedData.activeEnergy = results.reduce((sum, r) => sum + r.value, 0);
          else fetchedData.activeEnergy = 0;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        AppleHealthKit.getDistanceWalkingRunning(todayOptions, (err: string, results: HealthValue) => {
          if (err) errors.push(`Distance: ${err}`);
          else if (results) fetchedData.distance = results.value / 1000; 
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        AppleHealthKit.getRestingHeartRateSamples(recentSampleOptions, (err: string, results: Array<HealthValue>) => {
          if (err) errors.push(`Resting HR: ${err}`);
          else if (results && results.length > 0) fetchedData.restingHeartRate = results[0].value;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        AppleHealthKit.getHeartRateVariabilitySamples(recentSampleOptions, (err: string, results: Array<HealthValue>) => {
          if (err) errors.push(`HRV: ${err}`);
          else if (results && results.length > 0) fetchedData.hrv = results[0].value;
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        // Rely on TypeScript inference for `results` type from `getSleepSamples`
        AppleHealthKit.getSleepSamples(sleepOptions, (err: string, results) => {
          if (err) {
            errors.push(`Sleep: ${err}`);
          } else if (results && results.length > 0) {
            let totalSleepMilliseconds = 0;
            results.forEach(sample => {
              // Use AppleHealthKit.Constants.SleepAnalysis for sleep sample values
              if (sample.value === AppleHealthKit.Constants.SleepAnalysis.ASLEEP || 
                  sample.value === AppleHealthKit.Constants.SleepAnalysis.CORE || 
                  sample.value === AppleHealthKit.Constants.SleepAnalysis.REM ||
                  sample.value === AppleHealthKit.Constants.SleepAnalysis.DEEP) {
                const startDate = new Date(sample.startDate);
                const endDate = new Date(sample.endDate);
                totalSleepMilliseconds += (endDate.getTime() - startDate.getTime());
              }
            });
            fetchedData.sleepHours = totalSleepMilliseconds / (1000 * 60 * 60);
          }
          resolve();
        });
      }),
    ];

    Promise.all(promises).then(() => {
      setHealthData(prev => ({...prev, ...fetchedData}));
      if (errors.length > 0) {
        setHealthKitError(errors.join('\n'));
        console.warn("Errors fetching some HealthKit data: ", errors.join('\n'));
      } else {
        console.log("HealthKit data fetched successfully: ", fetchedData);
      }
      setHealthKitLoading(false);
    }).catch(error => {
        console.error("Unexpected error during Promise.all for HealthKit data: ", error);
        setHealthKitError("An unexpected error occurred while fetching health data.");
        setHealthKitLoading(false);
    });

  }, [healthKitAuthorized]);


  const authorizeHealthKit = useCallback(() => {
    setHealthKitLoading(true);
    setHealthKitError(null);
    // Corrected callback signature for initHealthKit
    AppleHealthKit.initHealthKit(healthKitPermissions, (error: string, _results: HealthValue) => { 
      setHealthKitLoading(false);
      if (error) {
        console.error("Error initializing HealthKit: ", error);
        RNAlert.alert("HealthKit Error", `Could not initialize HealthKit: ${error}. Please ensure Health app is set up and permissions are granted in Settings.`);
        setHealthKitError(`Error initializing HealthKit: ${error}`);
        setHealthKitAuthorized(false);
        return;
      }
      setHealthKitAuthorized(true); 
      RNAlert.alert("HealthKit Authorized", "Successfully connected to HealthKit. Fetching data...");
      fetchHealthData();
    });
  }, [fetchHealthData]); 
  
  useEffect(() => {
    if (Platform.OS === 'ios') { 
        AppleHealthKit.getAuthStatus(healthKitPermissions, (err, results) => {
            if (err) {
                console.error("Error getting HealthKit auth status:", err);
                setHealthKitAuthorized(false);
                return;
            }
            const readPermissions = healthKitPermissions.permissions?.read || [];
            if (readPermissions.length === 0) { 
                setHealthKitAuthorized(true); 
                return;
            }
            const allReadAuthorized = readPermissions.every(
                (permKey: HealthPermission) => results[permKey] === AppleHealthKit.Constants.AuthStatus.SharingAuthorized // Use AppleHealthKit.Constants.AuthStatus
            );
            
            if (allReadAuthorized) {
                setHealthKitAuthorized(true);
                fetchHealthData(); // Fetch data if already authorized
            } else {
                setHealthKitAuthorized(false);
            }
        });
    }
  }, [fetchHealthData]); // Added fetchHealthData to dependencies


  const displayWeight = (kg: number) => {
    if (unitSystem === 'imperial') {
        return `${convertWeight(kg, 'kg', 'lbs').toFixed(1)} lbs`;
    }
    return `${kg.toFixed(1)} kg`;
  };

  const displayHeight = (cm: number) => {
    if (unitSystem === 'imperial') {
        const {feet, inches} = convertHeight(cm, 'ft_in') as {feet: number, inches: number};
        return `${feet}' ${inches}"`;
    }
    return `${cm} cm`;
  };

  const handleSaveProfile = (updatedProfile: UserProfile) => {
    setUserProfile(updatedProfile);
    if (updatedProfile.dietaryPreferences.interestedInIF) {
        if (fastingTimerState.status === TimerStatus.NOT_ACTIVE &&
            (JSON.stringify(fastingTimerState.protocol) !== JSON.stringify(updatedProfile.dietaryPreferences.ifProtocol) ||
             !userProfile.dietaryPreferences.interestedInIF)) { 
          setFastingTimerState(INITIAL_FASTING_TIMER_STATE(updatedProfile.dietaryPreferences.ifProtocol));
        }
    } else if (userProfile.dietaryPreferences.interestedInIF && !updatedProfile.dietaryPreferences.interestedInIF) {
        setFastingTimerState(INITIAL_FASTING_TIMER_STATE(DEFAULT_IF_PROTOCOLS[IFProtocolType.SIXTEEN_EIGHT])); 
    }
    setIsEditProfileModalOpen(false);
  };
  
  const getRemainingValueStyle = (remaining: number, goal: number): TextStyle => {
    if (goal <= 0) return styles.macroValueNeutral; // Avoid division by zero or if goal is not set
    if (remaining < 0) return styles.macroValueOver;
    if (remaining < goal * 0.15) return styles.macroValueWarning; // If less than 15% remaining
    return styles.macroValueGood;
  };
  
  const remainingCalories = targetMacros.calories - todaysMacros.calories;
  const remainingProtein = targetMacros.protein - todaysMacros.protein;
  const remainingCarbs = targetMacros.carbs - todaysMacros.carbs;
  const remainingFat = targetMacros.fat - todaysMacros.fat;


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Welcome!</Text>
        <Toggle 
          label={`Use ${unitSystem === 'metric' ? 'Imperial' : 'Metric'}`} 
          enabled={unitSystem === 'imperial'} 
          setEnabled={() => setUnitSystem(unitSystem === 'metric' ? 'imperial' : 'metric')} 
        />
      </View>

      <Card title="Your Profile" style={styles.profileCard}>
        <Text style={styles.profileText}>Age: {userProfile.personalDetails.age}</Text>
        <Text style={styles.profileText}>Sex: {userProfile.personalDetails.sex}</Text>
        <Text style={styles.profileText}>Height: {displayHeight(userProfile.personalDetails.heightCm)}</Text>
        <Text style={styles.profileText}>Current Weight: {displayWeight(userProfile.personalDetails.currentWeightKg)}</Text>
        <Text style={styles.profileText}>Target Weight: {displayWeight(userProfile.goals.targetWeightKg)} by {new Date(userProfile.goals.targetDate + 'T00:00:00Z').toLocaleDateString()}</Text>
        <View style={styles.pillContainer}>
            <Text style={styles.profileText}>Activity Level: </Text>
            <Pill>{userProfile.activityLevel}</Pill>
        </View>
        <Text style={styles.profileText}>BMR: {userProfile.calculatedNutrition.bmr.toLocaleString()} kcal</Text>
        <Text style={styles.profileText}>TDEE: {userProfile.calculatedNutrition.tdee.toLocaleString()} kcal</Text>
        <Button 
          title="Edit Profile" 
          onPress={() => setIsEditProfileModalOpen(true)} 
          variant="outline" 
          size="sm" 
          style={styles.editProfileButton}
        />
      </Card>

      <Card title={`Daily Progress - ${new Date(selectedFoodLogDate + 'T00:00:00Z').toLocaleDateString()}`} style={styles.progressCard}>
        <View style={styles.macroRow}>
            <Text style={styles.macroLabel}>Calories:</Text>
            <Text style={styles.macroValue}>{todaysMacros.calories.toFixed(0)} / {targetMacros.calories.toFixed(0)} kcal</Text>
        </View>
        <ProgressBar value={(todaysMacros.calories / (targetMacros.calories || 1)) * 100} color="#F59E0B" style={styles.progressBar}/>
        <Text style={[styles.macroRemaining, getRemainingValueStyle(remainingCalories, targetMacros.calories)]}>
            Remaining: {remainingCalories.toFixed(0)} kcal
        </Text>

        <View style={styles.macroRow}>
            <Text style={styles.macroLabel}>Protein:</Text>
            <Text style={styles.macroValue}>{todaysMacros.protein.toFixed(1)} / {targetMacros.protein.toFixed(1)} g</Text>
        </View>
        <ProgressBar value={(todaysMacros.protein / (targetMacros.protein || 1)) * 100} color="#3B82F6" style={styles.progressBar}/>
        <Text style={[styles.macroRemaining, getRemainingValueStyle(remainingProtein, targetMacros.protein)]}>
            Remaining: {remainingProtein.toFixed(1)} g
        </Text>

        <View style={styles.macroRow}>
            <Text style={styles.macroLabel}>Carbs:</Text>
            <Text style={styles.macroValue}>{todaysMacros.carbs.toFixed(1)} / {targetMacros.carbs.toFixed(1)} g</Text>
        </View>
        <ProgressBar value={(todaysMacros.carbs / (targetMacros.carbs || 1)) * 100} color="#10B981" style={styles.progressBar}/>
         <Text style={[styles.macroRemaining, getRemainingValueStyle(remainingCarbs, targetMacros.carbs)]}>
            Remaining: {remainingCarbs.toFixed(1)} g
        </Text>

        <View style={styles.macroRow}>
            <Text style={styles.macroLabel}>Fat:</Text>
            <Text style={styles.macroValue}>{todaysMacros.fat.toFixed(1)} / {targetMacros.fat.toFixed(1)} g</Text>
        </View>
        <ProgressBar value={(todaysMacros.fat / (targetMacros.fat || 1)) * 100} color="#8B5CF6" style={styles.progressBar}/>
        <Text style={[styles.macroRemaining, getRemainingValueStyle(remainingFat, targetMacros.fat)]}>
            Remaining: {remainingFat.toFixed(1)} g
        </Text>
      </Card>


      {Platform.OS === 'ios' && (
        <Card title="Apple Health Data (Recent)" style={styles.healthKitCard}>
          {!healthKitAuthorized && (
            <Button title="Connect to Health App" onPress={authorizeHealthKit} variant="primary" style={{marginBottom: 10}} />
          )}
          {healthKitAuthorized && (
            <Button title="Refresh Health Data" onPress={fetchHealthData} variant="secondary" style={{marginBottom: 10}} />
          )}
          {healthKitLoading && <ActivityIndicator size="large" color="#2563EB" style={{marginVertical: 10}} />}
          {healthKitError && <UIAlert type="error" message={healthKitError} onClose={() => setHealthKitError(null)} />}
          
          <View style={styles.healthDataGrid}>
            <View style={styles.healthDataItem}>
                <Text style={styles.healthDataLabel}>Steps (Today)</Text>
                <Text style={styles.healthDataValue}>{healthData.steps?.toLocaleString() ?? '--'}</Text>
            </View>
            <View style={styles.healthDataItem}>
                <Text style={styles.healthDataLabel}>Active Energy</Text>
                <Text style={styles.healthDataValue}>{healthData.activeEnergy?.toFixed(0) ?? '--'} kcal</Text>
            </View>
            <View style={styles.healthDataItem}>
                <Text style={styles.healthDataLabel}>Distance</Text>
                <Text style={styles.healthDataValue}>{healthData.distance?.toFixed(2) ?? '--'} km</Text>
            </View>
          </View>
          <View style={[styles.healthDataGrid, { marginTop: 15 }]}>
            <View style={styles.healthDataItem}>
                <Text style={styles.healthDataLabel}>Resting HR</Text>
                <Text style={styles.healthDataValue}>{healthData.restingHeartRate?.toFixed(0) ?? '--'} bpm</Text>
            </View>
            <View style={styles.healthDataItem}>
                <Text style={styles.healthDataLabel}>HRV (SDNN)</Text>
                <Text style={styles.healthDataValue}>{healthData.hrv?.toFixed(1) ?? '--'} ms</Text>
            </View>
            <View style={styles.healthDataItem}>
                <Text style={styles.healthDataLabel}>Sleep</Text>
                <Text style={styles.healthDataValue}>{healthData.sleepHours?.toFixed(1) ?? '--'} hrs</Text>
            </View>
          </View>
        </Card>
      )}

      <Card title="AI Image Generator" style={styles.toolCard}>
        <Text style={styles.toolCardText}>
          Create unique images from text prompts using AI.
        </Text>
        <Button
          title="Open Image Generator"
          onPress={() => navigation?.navigate('ImageGenerator')}
          variant="primary"
          style={styles.toolButton}
        />
      </Card>
      
      {userProfile.dietaryPreferences.interestedInIF && (
         <IFTimerDisplay 
            timerState={fastingTimerState} 
            setTimerState={setFastingTimerState} 
            userProfile={userProfile}
        />
      )}

      <FoodLogger 
        userProfile={userProfile}
        dailyLogs={dailyLogs}
        setDailyLogs={setDailyLogs}
        selectedDate={selectedFoodLogDate}
        setSelectedDate={setSelectedFoodLogDate}
      />

      {isEditProfileModalOpen && userProfile && (
        <EditProfileModal
          isOpen={isEditProfileModalOpen}
          onClose={() => setIsEditProfileModalOpen(false)}
          currentUserProfile={userProfile}
          onSave={handleSaveProfile}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light gray background
  },
  contentContainer: {
    padding: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 30, // Ensure space at the bottom
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937', // Darker gray
  },
  profileCard: {
    marginBottom: 20,
  },
  profileText: {
    fontSize: 16,
    color: '#374151', // Medium gray
    marginBottom: 8,
    lineHeight: 22,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  editProfileButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  progressCard: {
    marginBottom: 20,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  macroLabel: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  macroValue: {
    fontSize: 15,
    color: '#1F2937',
  },
  progressBar: {
    marginTop: 4,
    marginBottom: 2,
  },
  macroRemaining: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'right',
    marginBottom: 8,
  },
  macroValueGood: {
    color: '#059669', // Green
  },
  macroValueWarning: {
    color: '#D97706', // Amber
  },
  macroValueOver: {
    color: '#DC2626', // Red
  },
  macroValueNeutral: {
    color: '#4B5563', // Default gray
  },
  healthKitCard: {
    marginBottom: 20,
  },
  healthDataGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Distribute items evenly
  },
  healthDataItem: {
    alignItems: 'center',
    padding: 8,
    minWidth: 100, // Ensure items have some width
  },
  healthDataLabel: {
    fontSize: 13,
    color: '#6B7280', // Lighter gray for labels
    marginBottom: 4,
  },
  healthDataValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  toolCard: {
    marginBottom: 20,
    alignItems: 'center',
  },
  toolCardText: {
    fontSize: 15,
    color: '#4B5563', // Slate gray
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  toolButton: {
    minWidth: 200, // Make button prominent
  },
});

export default Dashboard;