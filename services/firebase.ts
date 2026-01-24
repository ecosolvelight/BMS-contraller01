import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, off } from 'firebase/database';
import { BMSData } from '../types';

// These should be replaced with your actual Firebase config keys if needed
const firebaseConfig = {
  apiKey: "AIzaSyAs-Placeholder",
  authDomain: "bms-contrall-application.firebaseapp.com",
  databaseURL: "https://bms-contrall-application-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "bms-contrall-application",
  storageBucket: "bms-contrall-application.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const subscribeToDeviceData = (deviceId: string, callback: (data: BMSData | null) => void) => {
  const cleanId = deviceId.replace(/:/g, '').toUpperCase();
  const deviceRef = ref(db, `devices/${cleanId}/live_data`);
  
  onValue(deviceRef, (snapshot) => {
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
        temp_box: parseFloat(data.temp_box) || 0
      });
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Firebase error:", error);
    callback(null);
  });

  return () => off(deviceRef);
};