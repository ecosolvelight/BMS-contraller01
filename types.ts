export interface BMSData {
  voltage: number;
  current: number;
  soc: number;
  uptime: number;
  cycles: number;
  temp_battery: number;
  temp_mos: number;
  temp_box: number;
}

export interface Device {
  id: string; // MAC Address
  name: string;
  lastConnected?: number;
}

export type AppView = 'splash' | 'home' | 'device-list' | 'add-device' | 'dashboard';
