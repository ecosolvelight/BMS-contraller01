import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import { BMSData, Device } from '../types';

// Firebase configuration using environment variables for the API key as per general security practices
const firebaseConfig = {
  apiKey: process.env.API_KEY, 
  authDomain: "bms-contrall-application.firebaseapp.com",
  databaseURL: "https://bms-contrall-application-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "bms-contrall-application",
  storageBucket: "bms-contrall-application.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Initialize Firebase using the compat SDK to ensure reliable availability of services in the current environment
const app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
const db = app.database();

// --- CUSTOM DB-BASED AUTH ---

// Register user in the Realtime Database
export const dbRegister = async (username: string, pass: string) => {
  const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const userRef = db.ref(`users/${cleanUser}`);
  
  const snapshot = await userRef.get();
  if (snapshot.exists()) {
    throw new Error("Username already taken. Please choose another.");
  }

  const userData = {
    username: username.trim(),
    password: pass.trim(),
    createdAt: Date.now()
  };

  await userRef.set(userData);
  return { uid: cleanUser, username: username.trim() };
};

// Log in user by verifying credentials in the Realtime Database
export const dbLogin = async (username: string, pass: string) => {
  const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const userRef = db.ref(`users/${cleanUser}`);
  
  const snapshot = await userRef.get();
  if (!snapshot.exists()) {
    throw new Error("User not found.");
  }

  const data = snapshot.val();
  if (data.password !== pass.trim()) {
    throw new Error("Incorrect password.");
  }

  return { uid: cleanUser, username: data.username };
};

// --- DEVICE MANAGEMENT ---

// Save a device to the user's list in the database
export const saveUserDevice = async (uid: string, deviceId: string, name: string) => {
  const cleanId = deviceId.replace(/:/g, '').toUpperCase();
  const userDeviceRef = db.ref(`users/${uid}/devices/${cleanId}`);
  await userDeviceRef.set({ id: cleanId, name });
};

// Remove a device from the user's list
export const deleteUserDevice = async (uid: string, deviceId: string) => {
  const cleanId = deviceId.replace(/:/g, '').toUpperCase();
  await db.ref(`users/${uid}/devices/${cleanId}`).remove();
};

// Subscribe to real-time updates for a user's device list
export const subscribeToUserDevices = (uid: string, callback: (devices: Device[]) => void) => {
  const devicesRef = db.ref(`users/${uid}/devices`);
  const handler = (snapshot: firebase.database.DataSnapshot) => {
    const data = snapshot.val();
    const list = data ? Object.values(data) as Device[] : [];
    callback(list);
  };
  devicesRef.on('value', handler);
  return () => devicesRef.off('value', handler);
};

// Subscribe to live telemetry data for a specific BMS device
export const subscribeToDeviceData = (deviceId: string, callback: (data: BMSData | null) => void) => {
  const cleanId = deviceId.replace(/:/g, '').toUpperCase();
  const deviceRef = db.ref(`devices/${cleanId}/live_data`);
  
  const handler = (snapshot: firebase.database.DataSnapshot) => {
    const data = snapshot.val();
    if (data) {
      callback({
        voltage: parseFloat(data.voltage) || 0,
        current: parseFloat(data.current) || 0,
        soc: parseInt(data.soc) || 0,
        uptime: parseInt(data.uptime) || 0,
        cycles: parseInt(data.cycles) || 0,
        temp_battery: parseFloat(data.temp_battery) || 0,
        temp_mos: parseFloat(data.temp_mos) || 0,
        temp_box: parseFloat(data.temp_box) || 0,
        capacity_total: parseFloat(data.capacity_total) || 0,
        capacity_remain: parseFloat(data.capacity_remain) || 0,
        cells: data.cells || [],
        last_seen: data.last_seen 
      });
    } else {
      callback(null);
    }
  };

  deviceRef.on('value', handler);
  return () => deviceRef.off('value', handler);
};