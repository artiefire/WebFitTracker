

import React, { ReactNode, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal as ReactNativeModal,
  Switch,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

// Icon placeholder - in a real app, use react-native-vector-icons or similar
const IconPlaceholder = ({ name, size = 20, color = '#000' }: { name: string, size?: number, color?: string }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: color, borderRadius: size/2 }}>
    <Text style={{color, fontSize: size * 0.6}}>{name.substring(0,1).toUpperCase()}</Text>
  </View>
);


interface ButtonProps {
  children?: ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  style?: object;
  textStyle?: object;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  title?: string; // Alternative for children
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  style = {},
  textStyle = {},
  disabled = false,
  leftIcon,
  rightIcon,
  title
}) => {
  const baseButtonStyles = [styles.buttonBase];
  const baseTextStyles = [styles.buttonTextBase];

  baseButtonStyles.push(styles[`button_${variant}`]);
  baseTextStyles.push(styles[`buttonText_${variant}`]);
  baseButtonStyles.push(styles[`buttonSize_${size}`]);
  baseTextStyles.push(styles[`buttonTextSize_${size}`]);

  if (disabled) {
    baseButtonStyles.push(styles.buttonDisabled);
  }

  return (
    <TouchableOpacity
      style={[baseButtonStyles, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {leftIcon && <View style={styles.iconWrapper}>{leftIcon}</View>}
      {children ? <Text style={[baseTextStyles, textStyle]}>{children}</Text> : title ? <Text style={[baseTextStyles, textStyle]}>{title}</Text> : null}
      {rightIcon && <View style={styles.iconWrapper}>{rightIcon}</View>}
    </TouchableOpacity>
  );
};

interface InputProps {
  label?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  error?: string;
  style?: object;
  unit?: string;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  enabled?: boolean; // Added enabled prop
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  error,
  style = {},
  unit,
  multiline,
  numberOfLines,
  maxLength,
  enabled = true, // Default to true
}) => {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputWrapper, 
        error ? styles.inputErrorBorder : styles.inputDefaultBorder,
        !enabled ? styles.inputDisabledBackground : {} // Style for disabled state
      ]}>
        <TextInput
          style={[
            styles.input, 
            unit ? styles.inputWithUnit : {}, 
            multiline ? styles.inputTextarea : {},
            !enabled ? styles.inputDisabledText : {}, // Style for disabled text
            style
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          placeholderTextColor="#9CA3AF"
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines || 3 : 1}
          maxLength={maxLength}
          editable={enabled} // Control editability
        />
        {unit && <Text style={styles.inputUnit}>{unit}</Text>}
      </View>
      {error && <Text style={styles.errorMessage}>{error}</Text>}
    </View>
  );
};


interface SelectProps {
  label?: string;
  selectedValue?: string | number;
  onValueChange?: (itemValue: string | number, itemIndex: number) => void;
  options: { value: string | number; label: string }[];
  error?: string;
  style?: object;
  enabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({ label, selectedValue, onValueChange, options, error, style, enabled = true }) => {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
          styles.pickerWrapper, 
          error ? styles.inputErrorBorder : styles.inputDefaultBorder, 
          !enabled ? styles.inputDisabledBackground : {}
        ]}>
        <Picker
          selectedValue={selectedValue}
          onValueChange={onValueChange}
          style={[styles.picker, !enabled ? styles.inputDisabledText : {}, style]}
          enabled={enabled}
          dropdownIconColor={enabled ? "#6B7280" : "#D1D5DB"}
        >
          {options.map(option => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </View>
      {error && <Text style={styles.errorMessage}>{error}</Text>}
    </View>
  );
};

export const Textarea: React.FC<Omit<InputProps, 'secureTextEntry' | 'keyboardType' | 'unit'>> = (props) => {
  return <Input {...props} multiline={true} />;
};


interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'; // For width percentage
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const sizeStyles = { sm: '70%', md: '80%', lg: '90%', xl: '95%', '2xl': '95%' };
  return (
    <ReactNativeModal
      animationType="fade"
      transparent={true}
      visible={isOpen}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalContainer, { width: sizeStyles[size] }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalContent}>
            {(title || onClose) && (
              <View style={styles.modalHeader}>
                {title && <Text style={styles.modalTitle}>{title}</Text>}
                <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                  <IconPlaceholder name="X" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {children}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </ReactNativeModal>
  );
};


interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  color?: string; // Hex color string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value, label, color = '#3B82F6' }) => {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <View>
      {label && <Text style={styles.label}>{label} ({safeValue.toFixed(0)}%)</Text>}
      <View style={styles.progressBarBackground}>
        <View
          style={[styles.progressBarFill, { width: `${safeValue}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
};

interface CardProps {
  children: ReactNode;
  style?: object;
  title?: string;
  actions?: ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, style, title, actions }) => {
  return (
    <View style={[styles.cardBase, style]}>
      {(title || actions) && (
        <View style={styles.cardHeader}>
          {title && <Text style={styles.cardTitle}>{title}</Text>}
          {actions && <View style={styles.cardActions}>{actions}</View>}
        </View>
      )}
      {children}
    </View>
  );
};


interface DatePickerProps {
  label?: string;
  selectedDate: Date; // Use Date object
  onDateChange: (event: DateTimePickerEvent, date?: Date) => void;
  error?: string;
  style?: object;
  mode?: 'date' | 'time' | 'datetime';
}

export const DatePicker: React.FC<DatePickerProps> = ({ label, selectedDate, onDateChange, error, style, mode = 'date' }) => {
  const [showPicker, setShowPicker] = useState(false);

  const onChangeInternal = (event: DateTimePickerEvent, date?: Date) => {
    setShowPicker(Platform.OS === 'ios'); // Keep open on iOS unless user dismisses
    if (date) {
      onDateChange(event, date);
    }
  };

  const displayValue = mode === 'time' ? selectedDate.toLocaleTimeString() : selectedDate.toLocaleDateString();

  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
       <TouchableOpacity onPress={() => setShowPicker(true)} style={[styles.inputWrapper, styles.inputDefaultBorder, style]}>
          <Text style={styles.datePickerText}>{displayValue}</Text>
       </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeInternal}
        />
      )}
      {error && <Text style={styles.errorMessage}>{error}</Text>}
    </View>
  );
};


interface ToggleProps {
  label: string;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  description?: string;
  name?: string;
  style?: object;
}

export const Toggle: React.FC<ToggleProps> = ({ label, enabled, setEnabled, description, name, style }) => {
  return (
    <View style={[styles.toggleContainer, style]}>
      <View style={styles.toggleLabelContainer}>
        <Text style={styles.label} nativeID={name ? `${name}-label` : undefined}>{label}</Text>
        {description && <Text style={styles.toggleDescription} nativeID={name ? `${name}-description` : undefined}>{description}</Text>}
      </View>
      <Switch
        trackColor={{ false: "#D1D5DB", true: "#2563EB" }}
        thumbColor={enabled ? "#F9FAFB" : "#F9FAFB"}
        ios_backgroundColor="#E5E7EB"
        onValueChange={setEnabled}
        value={enabled}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
      />
    </View>
  );
};

export const Pill: React.FC<{children: ReactNode, color?: string, textColor?: string, style?: object}> = ({children, color = '#DBEAFE', textColor = '#1E40AF', style}) => {
  return (
    <View style={[styles.pillBase, {backgroundColor: color}, style]}>
      <Text style={[styles.pillText, {color: textColor}]}>{children}</Text>
    </View>
  );
};

export const Alert: React.FC<{ type?: 'info' | 'success' | 'warning' | 'error'; message: string; onClose?: () => void; style?: object }> = ({ type = 'info', message, onClose, style }) => {
  const alertStyles = {
    info: { borderColor: '#60A5FA', backgroundColor: '#EFF6FF', textColor: '#1D4ED8' },
    success: { borderColor: '#34D399', backgroundColor: '#F0FDF4', textColor: '#065F46' },
    warning: { borderColor: '#FBBF24', backgroundColor: '#FFFBEB', textColor: '#92400E' },
    error: { borderColor: '#F87171', backgroundColor: '#FEF2F2', textColor: '#B91C1C' },
  };
  const currentStyle = alertStyles[type];

  return (
    <View style={[styles.alertBase, {borderColor: currentStyle.borderColor, backgroundColor: currentStyle.backgroundColor}, style]}>
      <Text style={[styles.alertMessage, {color: currentStyle.textColor}]}>{message}</Text>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.alertCloseButton}>
           <IconPlaceholder name="X" size={20} color={currentStyle.textColor} />
        </TouchableOpacity>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  // Button Styles
  buttonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonTextBase: {
    fontWeight: '600',
    textAlign: 'center',
  },
  iconWrapper: {
    marginHorizontal: 4,
  },
  button_primary: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  buttonText_primary: { color: '#FFFFFF' },
  button_secondary: { backgroundColor: '#E5E7EB', borderColor: '#D1D5DB' },
  buttonText_secondary: { color: '#1F2937' },
  button_danger: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  buttonText_danger: { color: '#FFFFFF' },
  button_ghost: { backgroundColor: 'transparent', borderColor: 'transparent' }, // hover/active state needs to be handled by TouchableOpacity's activeOpacity or custom logic
  buttonText_ghost: { color: '#2563EB' },
  button_outline: { backgroundColor: 'transparent', borderColor: '#2563EB' },
  buttonText_outline: { color: '#2563EB' },

  buttonSize_sm: { paddingHorizontal: 12, paddingVertical: 7 },
  buttonTextSize_sm: { fontSize: 14 },
  buttonSize_md: { paddingHorizontal: 16, paddingVertical: 10 },
  buttonTextSize_md: { fontSize: 16 },
  buttonSize_lg: { paddingHorizontal: 24, paddingVertical: 12 },
  buttonTextSize_lg: { fontSize: 18 },
  buttonDisabled: { opacity: 0.5 },

  // Input Styles
  inputContainer: {
    width: '100%',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    color: '#1F2937',
  },
  inputTextarea: {
    textAlignVertical: 'top', // For Android
    minHeight: 80,
  },
  inputWithUnit: {
    paddingRight: 40, // Make space for unit
  },
  inputUnit: {
    position: 'absolute',
    right: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  inputDefaultBorder: { borderColor: '#D1D5DB' },
  inputErrorBorder: { borderColor: '#EF4444' },
  inputDisabledBackground: { 
    backgroundColor: '#F3F4F6', 
    borderColor: '#E5E7EB',
  },
  inputDisabledText: { 
    color: '#9CA3AF',
  },
  errorMessage: {
    marginTop: 4,
    fontSize: 12,
    color: '#EF4444',
  },

  // Select (Picker) Styles
  pickerWrapper: {
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden', // Ensures border radius is respected by Picker on Android
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? undefined : 50, // iOS height is intrinsic, Android needs explicit height
    color: '#1F2937',
    backgroundColor: 'transparent', // Important for iOS to show wrapper background
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 0, // Padding will be handled by header/body
    maxHeight: '85%',
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalContent: {
    flexDirection: 'column',
    maxHeight: '100%', // Ensure content doesn't overflow modal container
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalCloseButton: {
    padding: 8, // Make touch target larger
  },
  modalBody: {
     // flex: 1, // Allows scrollview to take available space
     // This will be applied to ScrollView contentContainerStyle for inner padding
  },
  modalBodyContent: {
    padding: 16,
  },


  // ProgressBar Styles
  progressBarBackground: {
    width: '100%',
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },

  // Card Styles
  cardBase: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android shadow
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // DatePicker Styles
  datePickerText: {
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: Platform.OS === 'ios' ? 12 : 10, // Align with TextInput
    paddingHorizontal: 12,
  },

  // Toggle (Switch) Styles
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: 10,
  },
  toggleDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  // Pill Styles
  pillBase: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start', // So it doesn't take full width
    margin: 2,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Alert Styles
  alertBase: {
    padding: 12,
    borderLeftWidth: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  alertMessage: {
    flex: 1,
    fontSize: 14,
  },
  alertCloseButton: {
    marginLeft: 12,
    padding: 4,
  },
});