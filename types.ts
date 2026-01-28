
export interface BMSData {
  voltage: number;
  current: number;
  soc: number;
  uptime: number;
  cycles: number;
  temp_battery: number;
  temp_mos: number;
  temp_box: number;
  last_seen?: number;
  capacity_total?: number;
  capacity_remain?: number;
  cells?: number[];
}

export interface Device {
  id: string; // MAC Address
  name: string;
  lastConnected?: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
}

export type AppView = 'splash' | 'auth' | 'home' | 'device-list' | 'add-device' | 'dashboard';
