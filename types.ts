
export interface BMSData {
  voltage: number;
  current: number;
  soc: number;
  uptime: number;
  cycles: number;
  temp_battery: number;
  temp_power: number;
  temp_box: number;
  last_seen?: number;
  capacity_total?: number;
  capacity_remain?: number;
  cell_count?: number;
  cells: number[]; // Transformed from cell_voltages object
  warning_text?: string;
  warning_flags?: number;
  status_flags?: number;
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
