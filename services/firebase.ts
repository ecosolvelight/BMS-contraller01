
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import { BMSData, Device } from '../types';

const firebaseConfig = {
  apiKey: process.env.API_KEY, 
  authDomain: "bms-contrall-application.firebaseapp.com",
  databaseURL: "https://bms-contrall-application-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "bms-contrall-application",
  storageBucket: "bms-contrall-application.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
const db = app.database();

export const dbRegister = async (username: string, pass: string) => {
  const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const userRef = db.ref(`users/${cleanUser}`);
  const snapshot = await userRef.get();
  if (snapshot.exists()) throw new Error("Username already taken.");
  const userData = { username: username.trim(), password: pass.trim(), createdAt: Date.now() };
  await userRef.set(userData);
  return { uid: cleanUser, username: username.trim() };
};

export const dbLogin = async (username: string, pass: string) => {
  const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const userRef = db.ref(`users/${cleanUser}`);
  const snapshot = await userRef.get();
  if (!snapshot.exists()) throw new Error("User not found.");
  const data = snapshot.val();
  if (data.password !== pass.trim()) throw new Error("Incorrect password.");
  return { uid: cleanUser, username: data.username };
};

export const saveUserDevice = async (uid: string, deviceId: string, name: string) => {
  const cleanId = deviceId.replace(/:/g, '').toUpperCase();
  await db.ref(`users/${uid}/devices/${cleanId}`).set({ id: cleanId, name });
};

export const deleteUserDevice = async (uid: string, deviceId: string) => {
  const cleanId = deviceId.replace(/:/g, '').toUpperCase();
  await db.ref(`users/${uid}/devices/${cleanId}`).remove();
};

export const subscribeToUserDevices = (uid: string, callback: (devices: Device[]) => void) => {
  const devicesRef = db.ref(`users/${uid}/devices`);
  const handler = (snapshot: firebase.database.DataSnapshot) => {
    const data = snapshot.val();
    callback(data ? Object.values(data) as Device[] : []);
  };
  devicesRef.on('value', handler);
  return () => devicesRef.off('value', handler);
};

export const subscribeToDeviceData = (deviceId: string, callback: (data: BMSData | null) => void) => {
  const cleanId = deviceId.replace(/:/g, '').toUpperCase();
  const deviceRef = db.ref(`devices/${cleanId}/live_data`);
  
  const handler = (snapshot: firebase.database.DataSnapshot) => {
    const data = snapshot.val();
    if (data) {
      // Process cell_voltages object (cell_1, cell_2...) into sorted array
      const cells: number[] = [];
      if (data.cell_voltages) {
        Object.keys(data.cell_voltages).forEach(key => {
          const index = parseInt(key.replace('cell_', '')) - 1;
          if (!isNaN(index)) {
            cells[index] = data.cell_voltages[key] / 1000.0; // Convert mV to V
          }
        });
      }

      callback({
        voltage: parseFloat(data.voltage) || 0,
        current: parseFloat(data.current) || 0,
        soc: parseInt(data.soc) || 0,
        uptime: parseInt(data.uptime) || 0,
        cycles: parseInt(data.cycles) || 0,
        temp_battery: parseFloat(data.temp_battery) || 0,
        temp_power: parseFloat(data.temp_power) || 0,
        temp_box: parseFloat(data.temp_box) || 0,
        capacity_total: parseFloat(data.capacity_total) || 0,
        capacity_remain: (data.soc / 100) * (data.capacity_total || 0),
        cell_count: parseInt(data.cell_count) || 0,
        cells: cells,
        warning_text: data.warning_text || 'None',
        warning_flags: data.warning_flags,
        status_flags: data.status_flags,
        last_seen: data.last_seen 
      });
    } else {
      callback(null);
    }
  };

  deviceRef.on('value', handler);
  return () => deviceRef.off('value', handler);
};
