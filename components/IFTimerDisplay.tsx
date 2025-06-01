
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { FastingTimerState, TimerStatus, FastingPhase, IFProtocol, UserProfile, IFProtocolType as ActualIFProtocolType } from '../types';
import { Button, Card, Select, Input, Pill } from './uiElements';
import { DEFAULT_IF_PROTOCOLS, INITIAL_FASTING_TIMER_STATE } from '../constants';

interface IFTimerDisplayProps {
  timerState: FastingTimerState;
  setTimerState: React.Dispatch<React.SetStateAction<FastingTimerState>>;
  userProfile: UserProfile | null;
}

const IFTimerDisplay: React.FC<IFTimerDisplayProps> = ({ timerState, setTimerState, userProfile }) => {
  const [remainingTime, setRemainingTime] = useState<string>("00:00:00");
  const [customFastingHours, setCustomFastingHours] = useState<number>(timerState.protocol.fastingHours || 16);
  const [customEatingHours, setCustomEatingHours] = useState<number>(timerState.protocol.eatingHours || 8);

  const calculateRemainingTime = useCallback(() => {
    if (timerState.status !== TimerStatus.ACTIVE || !timerState.endTime) {
      return "00:00:00";
    }
    const now = new Date().getTime();
    const end = new Date(timerState.endTime).getTime();
    let diff = end - now;

    if (diff <= 0) {
      setTimerState(prev => {
        const newPhase = prev.currentPhase === FastingPhase.FASTING ? FastingPhase.EATING : FastingPhase.FASTING;
        const phaseDurationHours = newPhase === FastingPhase.FASTING ? (prev.protocol.fastingHours || 0) : (prev.protocol.eatingHours || 0);
        const phaseDurationMs = phaseDurationHours * 60 * 60 * 1000;
        const newStartTime = new Date().toISOString();
        const newEndTime = new Date(Date.now() + phaseDurationMs).toISOString();
        
        return {
          ...prev,
          currentPhase: newPhase,
          startTime: newStartTime,
          endTime: newEndTime,
          phaseStartTime: newStartTime,
          pausedDurationMs: 0,
        };
      });
      return "00:00:00";
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    diff -= hours * (1000 * 60 * 60);
    const minutes = Math.floor(diff / (1000 * 60));
    diff -= minutes * (1000 * 60);
    const seconds = Math.floor(diff / 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [timerState.status, timerState.endTime, timerState.currentPhase, timerState.protocol, setTimerState]);


  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined; // Use NodeJS.Timeout for cross-platform compatibility
    if (timerState.status === TimerStatus.ACTIVE) {
      setRemainingTime(calculateRemainingTime());
      intervalId = setInterval(() => { // Use setInterval for React Native
        setRemainingTime(calculateRemainingTime());
      }, 1000);
    } else if (timerState.status === TimerStatus.PAUSED && timerState.endTime && timerState.lastPauseTime && timerState.phaseStartTime) {
        const phaseStartTimeMs = new Date(timerState.phaseStartTime).getTime();
        const originalDurationMs = (timerState.currentPhase === FastingPhase.FASTING ? timerState.protocol.fastingHours! : timerState.protocol.eatingHours!) * 60 * 60 * 1000;
        const intendedEndTimeWithoutPauses = phaseStartTimeMs + originalDurationMs;
        const currentTime = new Date(timerState.lastPauseTime).getTime();

        let diff = (intendedEndTimeWithoutPauses + timerState.pausedDurationMs) - currentTime;
        if (diff < 0) diff = 0;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        diff -= hours * (1000 * 60 * 60);
        const minutes = Math.floor(diff / (1000 * 60));
        diff -= minutes * (1000 * 60);
        const seconds = Math.floor(diff / 1000);
        setRemainingTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    } else {
      setRemainingTime("00:00:00");
    }
    return () => clearInterval(intervalId);
  }, [timerState.status, timerState.endTime, timerState.lastPauseTime, calculateRemainingTime, timerState.phaseStartTime, timerState.pausedDurationMs, timerState.protocol, timerState.currentPhase]);

  useEffect(() => {
    if(timerState.protocol.type === ActualIFProtocolType.CUSTOM && userProfile?.dietaryPreferences.ifProtocol.type === ActualIFProtocolType.CUSTOM) { 
        setCustomFastingHours(timerState.protocol.fastingHours || 16);
        setCustomEatingHours(timerState.protocol.eatingHours || 8);
    }
  }, [timerState.protocol, userProfile]);


  const handleStartFast = () => {
    if (!userProfile) return;
    const protocol = timerState.protocol;
    const fastingDurationMs = (protocol.fastingHours || 0) * 60 * 60 * 1000;
    const now = new Date();
    setTimerState({
      status: TimerStatus.ACTIVE,
      currentPhase: FastingPhase.FASTING,
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + fastingDurationMs).toISOString(),
      phaseStartTime: now.toISOString(),
      pausedDurationMs: 0,
      protocol: protocol,
    });
  };

  const handlePauseResumeFast = () => {
    if (timerState.status === TimerStatus.ACTIVE) {
      setTimerState(prev => ({
        ...prev,
        status: TimerStatus.PAUSED,
        lastPauseTime: new Date().toISOString(),
      }));
    } else if (timerState.status === TimerStatus.PAUSED) {
      setTimerState(prev => {
        if (!prev.lastPauseTime || !prev.endTime || !prev.phaseStartTime) return prev; 
        const pauseMsThisSegment = new Date().getTime() - new Date(prev.lastPauseTime).getTime();
        const newPausedDurationMsTotal = prev.pausedDurationMs + pauseMsThisSegment;
        const newEndTime = new Date(new Date(prev.endTime).getTime() + pauseMsThisSegment).toISOString();

        return {
          ...prev,
          status: TimerStatus.ACTIVE,
          endTime: newEndTime,
          pausedDurationMs: newPausedDurationMsTotal,
          lastPauseTime: undefined,
        };
      });
    }
  };

  const handleEndFast = () => {
    if (!userProfile) return;
    setTimerState(INITIAL_FASTING_TIMER_STATE(userProfile.dietaryPreferences.ifProtocol));
  };

  const handleProtocolChange = (value: string | number) => {
    const type = value as ActualIFProtocolType;
    let newProtocol: IFProtocol;
    if (type === ActualIFProtocolType.CUSTOM) { 
        newProtocol = { ...DEFAULT_IF_PROTOCOLS[type], type };
        newProtocol.fastingHours = customFastingHours;
        newProtocol.eatingHours = customEatingHours;
    } else {
        newProtocol = DEFAULT_IF_PROTOCOLS[type as Exclude<ActualIFProtocolType, ActualIFProtocolType.CUSTOM>];
    }
    setTimerState(prev => ({ ...prev, protocol: newProtocol }));
  };
  
  const handleCustomHoursChange = (name: 'customFastingHours' | 'customEatingHours', value: string) => {
    const hours = parseInt(value) || 0;
    if (name === 'customFastingHours') setCustomFastingHours(hours);
    if (name === 'customEatingHours') setCustomEatingHours(hours);
    
    setTimerState(prev => ({
        ...prev,
        protocol: {
            ...prev.protocol,
            type: ActualIFProtocolType.CUSTOM, 
            fastingHours: name === 'customFastingHours' ? hours : (prev.protocol.fastingHours || 0),
            eatingHours: name === 'customEatingHours' ? hours : (prev.protocol.eatingHours || 0),
        }
    }));
  };

  if (!userProfile || !userProfile.dietaryPreferences.interestedInIF) {
    return (
      <Card title="Intermittent Fasting Timer">
        <Text style={styles.infoText}>Intermittent fasting is not enabled in your profile. You can enable it in your dietary preferences.</Text>
      </Card>
    );
  }
  
  const protocolOptions: { value: string | number; label: string }[] = Object.values(ActualIFProtocolType).map(p => ({ value: p, label: p }));
  const isTimerControlsDisabled = timerState.status === TimerStatus.ACTIVE || timerState.status === TimerStatus.PAUSED;

  return (
    <Card title="Intermittent Fasting Timer" style={styles.card}>
      <View style={styles.statusContainer}>
        <Pill 
          color={timerState.status === TimerStatus.ACTIVE ? (timerState.currentPhase === FastingPhase.FASTING ? '#FECACA' : '#D1FAE5') : '#F3F4F6'} 
          textColor={timerState.status === TimerStatus.ACTIVE ? (timerState.currentPhase === FastingPhase.FASTING ? '#B91C1C' : '#065F46') : '#374151'}
          style={styles.statusPill}
        >
          <Text style={[styles.statusPillText, {color: timerState.status === TimerStatus.ACTIVE ? (timerState.currentPhase === FastingPhase.FASTING ? '#B91C1C' : '#065F46') : '#374151'}]}>
            {timerState.status === TimerStatus.ACTIVE ? timerState.currentPhase : timerState.status}
          </Text>
        </Pill>
      </View>
      
      <Text style={styles.timerText}>{remainingTime}</Text>

      <View style={styles.protocolSection}>
        <Select 
            label="IF Protocol" 
            selectedValue={timerState.protocol.type} 
            onValueChange={handleProtocolChange} 
            options={protocolOptions}
            enabled={!isTimerControlsDisabled}
        />
        {timerState.protocol.type === ActualIFProtocolType.CUSTOM && ( 
            <View style={styles.customHoursContainer}>
                <Input label="Fasting Hours" keyboardType="numeric" value={customFastingHours.toString()} onChangeText={(val) => handleCustomHoursChange('customFastingHours', val)} style={styles.customInput} enabled={!isTimerControlsDisabled}/>
                <Input label="Eating Hours" keyboardType="numeric" value={customEatingHours.toString()} onChangeText={(val) => handleCustomHoursChange('customEatingHours', val)} style={styles.customInput} enabled={!isTimerControlsDisabled}/>
            </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        {timerState.status === TimerStatus.NOT_ACTIVE && (
          <Button title="Start Fast" onPress={handleStartFast} variant="primary" size="lg" />
        )}
        {(timerState.status === TimerStatus.ACTIVE || timerState.status === TimerStatus.PAUSED) && (
          <>
            <Button 
              title={timerState.status === TimerStatus.ACTIVE ? 'Pause' : 'Resume'} 
              onPress={handlePauseResumeFast} 
              variant="secondary" 
              size="lg" 
              style={styles.controlButton} 
            />
            <Button 
              title="End Fast" 
              onPress={handleEndFast} 
              variant="danger" 
              size="lg" 
              style={styles.controlButton} 
            />
          </>
        )}
      </View>
      
      {timerState.phaseStartTime && (
        <View style={styles.detailsSection}>
            <Text style={styles.detailText}>Current Phase Started: {new Date(timerState.phaseStartTime).toLocaleString()}</Text>
            {timerState.endTime && <Text style={styles.detailText}>Scheduled End: {new Date(timerState.endTime).toLocaleString()}</Text>}
            {timerState.pausedDurationMs > 0 && <Text style={styles.detailText}>Total Paused Time: {Math.floor(timerState.pausedDurationMs / 60000)} min {Math.floor((timerState.pausedDurationMs % 60000) / 1000)} sec</Text>}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center', // Center content like timer text and status pill
  },
  infoText: {
    color: '#4B5563',
    textAlign: 'center',
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 18,
    fontWeight: '600',
  },
  timerText: {
    fontSize: Platform.OS === 'ios' ? 60 : 48, // Larger on iOS
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', // Monospaced font
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center', // Ensure it's centered
  },
  protocolSection: {
    width: '100%', // Make select and inputs take full width of card
    maxWidth: 350, // Max width for better appearance on large screens
    marginBottom: 20,
    alignSelf: 'center', // Center the section
  },
  customHoursContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  customInput: {
    width: '48%', // For two inputs side-by-side
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center', // Center buttons
    alignItems: 'center',
    width: '100%', // Ensure it takes full width for centering
  },
  controlButton: {
    marginHorizontal: 8,
    minWidth: 120, // Give buttons some minimum width
  },
  detailsSection: {
    marginTop: 20,
    alignItems: 'center', // Center details text
  },
  detailText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 3,
  },
});

export default IFTimerDisplay;
