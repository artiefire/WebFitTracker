import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, StackNavigationOptions } from '@react-navigation/stack';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert, Platform, ActivityIndicator } from 'react-native';

import useAsyncStorage from './hooks/useAsyncStorage'; // Changed from useLocalStorage
import { UserProfile, DailyLog, FastingTimerState, IFProtocolType, TimerStatus } from './types';
import OnboardingQuiz from './components/OnboardingQuiz';
import Dashboard from './components/Dashboard';
import { DEFAULT_IF_PROTOCOLS, INITIAL_FASTING_TIMER_STATE } from './constants';

const Stack = createStackNavigator();

const App: React.FC = () => {
  const [userProfile, setUserProfile, profileLoading] = useAsyncStorage<UserProfile | null>('userProfile', null);
  const [dailyLogs, setDailyLogs, logsLoading] = useAsyncStorage<DailyLog[]>('dailyLogs', []);
  
  const [fastingTimerState, setFastingTimerState, timerStateLoading] = useAsyncStorage<FastingTimerState>(
    'fastingTimerState', 
    () => INITIAL_FASTING_TIMER_STATE(userProfile?.dietaryPreferences.ifProtocol || DEFAULT_IF_PROTOCOLS[IFProtocolType.SIXTEEN_EIGHT])
  );
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profileLoading && !logsLoading && !timerStateLoading) {
      setIsLoading(false);
    }
  }, [profileLoading, logsLoading, timerStateLoading]);


  useEffect(() => {
    if (userProfile && userProfile.dietaryPreferences.interestedInIF) {
      if (fastingTimerState.status === TimerStatus.NOT_ACTIVE && 
          JSON.stringify(fastingTimerState.protocol) !== JSON.stringify(userProfile.dietaryPreferences.ifProtocol)) {
        setFastingTimerState(INITIAL_FASTING_TIMER_STATE(userProfile.dietaryPreferences.ifProtocol));
      }
    } else if (userProfile && !userProfile.dietaryPreferences.interestedInIF && fastingTimerState.status !== TimerStatus.NOT_ACTIVE) {
      setFastingTimerState(INITIAL_FASTING_TIMER_STATE(DEFAULT_IF_PROTOCOLS[IFProtocolType.SIXTEEN_EIGHT]));
    }
  }, [userProfile, fastingTimerState.status, fastingTimerState.protocol, setFastingTimerState]);

  const handleQuizComplete = (profile: UserProfile) => {
    setUserProfile(profile);
    setFastingTimerState(INITIAL_FASTING_TIMER_STATE(profile.dietaryPreferences.ifProtocol));
    // Navigation will automatically switch due to userProfile update
  };
  
  const handleLogout = (navigation: any) => {
    Alert.alert(
      "Reset Data",
      "Are you sure you want to reset all data and return to onboarding? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Reset", 
          style: "destructive",
          onPress: () => {
            setUserProfile(null); // This will trigger re-render and navigator change
            setDailyLogs([]);
            setFastingTimerState(INITIAL_FASTING_TIMER_STATE(DEFAULT_IF_PROTOCOLS[IFProtocolType.SIXTEEN_EIGHT]));
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading Your Fitness Data...</Text>
      </View>
    );
  }

  const commonScreenOptions: StackNavigationOptions = {
    headerStyle: {
      backgroundColor: '#FFFFFF', // Example header color
    },
    headerTintColor: '#1F2937', // Example header text color
    headerTitleStyle: {
      fontWeight: 'bold',
    },
  };

  return (
    <NavigationContainer>
      <StatusBar barStyle={Platform.OS === 'ios' ? "dark-content" : "dark-content"} backgroundColor="#FFFFFF" />
      <Stack.Navigator screenOptions={commonScreenOptions}>
        {userProfile && userProfile.quizCompleted ? (
          <Stack.Screen 
            name="Dashboard" 
            options={({ navigation }) => ({ 
              title: 'WebFit Dashboard',
              headerRight: () => (
                <TouchableOpacity onPress={() => handleLogout(navigation)} style={styles.logoutButton}>
                  <Text style={styles.logoutButtonText}>Reset</Text>
                </TouchableOpacity>
              )
            })}
          >
            {props => (
              <Dashboard
                {...props}
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                dailyLogs={dailyLogs}
                setDailyLogs={setDailyLogs}
                fastingTimerState={fastingTimerState}
                setFastingTimerState={setFastingTimerState}
              />
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen 
            name="Onboarding"
            options={{ title: 'Setup Your Profile', headerShown: false }}
          >
            {props => <OnboardingQuiz {...props} onQuizComplete={handleQuizComplete} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
      <View style={styles.footer}>
        <Text style={styles.footerText}>WebFit Tracker &copy; {new Date().getFullYear()}.</Text>
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#374151',
  },
  logoutButton: {
    marginRight: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  logoutButtonText: {
    color: Platform.OS === 'ios' ? '#007AFF' : '#2563EB', // iOS blue, primary color for Android
    fontSize: 16,
  },
  footer: {
    backgroundColor: '#1F2937', // Darker footer
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  footerText: {
    color: '#D1D5DB', // Lighter text for dark footer
    fontSize: 12,
  }
});

export default App;