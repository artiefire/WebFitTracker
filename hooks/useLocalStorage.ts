import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

function useAsyncStorage<T,>(key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [storedValue, setStoredValue] = useState<T>(() => initialValue instanceof Function ? initialValue() : initialValue);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const loadStoredValue = async () => {
      setLoading(true);
      try {
        const item = await AsyncStorage.getItem(key);
        if (isMounted) {
            if (item !== null) {
                setStoredValue(JSON.parse(item));
            } else {
                const initVal = initialValue instanceof Function ? initialValue() : initialValue;
                setStoredValue(initVal);
                // Persist initial value if it wasn't found
                await AsyncStorage.setItem(key, JSON.stringify(initVal));
            }
        }
      } catch (error) {
        console.error(`Error reading AsyncStorage key "${key}":`, error);
        if (isMounted) {
            setStoredValue(initialValue instanceof Function ? initialValue() : initialValue);
        }
      } finally {
        if (isMounted) {
            setLoading(false);
        }
      }
    };
    loadStoredValue();
    return () => {
        isMounted = false;
    };
  }, [key]); // Only run on mount and if key changes

  useEffect(() => {
    // This effect handles saving the value whenever it changes, but only if not loading.
    // This prevents saving the initial computed value immediately after loading if it differs from a pre-existing stored value.
    if (!loading) {
        const saveValue = async () => {
            try {
                await AsyncStorage.setItem(key, JSON.stringify(storedValue));
            } catch (error) {
                console.error(`Error setting AsyncStorage key "${key}":`, error);
            }
        };
        saveValue();
    }
  }, [key, storedValue, loading]);

  return [storedValue, setStoredValue, loading];
}

export default useAsyncStorage;