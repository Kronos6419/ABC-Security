import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyBYeviLmBeVBvCWHjR8vvgQnpL2TatJkP8",
    authDomain: "abc-security-hub.firebaseapp.com",
    projectId: "abc-security-hub",
    storageBucket: "abc-security-hub.firebasestorage.app",
    messagingSenderId: "669642515812",
    appId: "1:669642515812:web:92c742e45e13d63b6ec671"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app); 