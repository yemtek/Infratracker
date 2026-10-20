export type DeviceType = 
  | 'SWITCH' 
  | 'SERVER' 
  | 'PATCH_PANEL' 
  | 'BLADE_CHASSIS' 
  | 'CABLE_ORGANIZER' 
  | 'FIREWALL' 
  | 'PDU';

export type DeviceStatus = 
  | 'ONLINE' 
  | 'WARNING' 
  | 'CRITICAL' 
  | 'MAINTENANCE' 
  | 'PROVISIONING';

export type PortType = 
  | 'CAT6' 
  | 'SINGLE_MODE_FIBER' 
  | 'MULTI_MODE_FIBER' 
  | 'QSFP28' 
  | 'SFP28';

export interface Site {
  id: string;
  name: string;
  location: string;
  address: string;
  created_at?: string;
  rack_count?: number;
  device_count?: number;
}

export interface Rack {
  id: string;
  name: string;
  height: number;
  site_id: string;
  site_name?: string;
  site_location?: string;
  device_count?: number;
  used_u?: number;
  total_power_watts?: number;
  devices?: Device[];
}

export interface Port {
  id: string;
  port_number: number;
  port_name?: string;
  port_type: PortType | string;
  speed_mbps: number;
  status: 'UP' | 'DOWN' | 'DISABLED';
  device_id: string;
  connected_port_id?: string | null;
  vlan_id?: string | null;

  // Joined fields
  device_name?: string;
  device_model?: string;
  device_type?: DeviceType;
  rack_id?: string;
  rack_name?: string;
  vlan_number?: number;
  vlan_name?: string;
  vlan_color?: string;
  dest_port_number?: number;
  dest_port_name?: string;
  dest_device_id?: string;
  dest_device_name?: string;
  dest_device_model?: string;
  dest_rack_id?: string;
  dest_rack_name?: string;
}

export interface Device {
  id: string;
  name: string;
  model: string;
  device_type: DeviceType;
  serial_number: string;
  mac_address?: string | null;
  ip_address?: string | null;
  start_u: number;
  unit_height: number;
  status: DeviceStatus;
  power_watts: number;
  rack_id: string;
  rack_name?: string;
  site_name?: string;
  port_count?: number;
  connected_port_count?: number;
  created_at?: string;
  ports?: Port[];
}

export interface VLAN {
  id: string;
  vlan_number: number;
  name: string;
  description?: string;
  color_hex: string;
  subnet?: string;
  port_count?: number;
}

export interface DatabaseStatus {
  status: 'connected' | 'error' | 'connecting';
  provider: string;
  latencyMs?: number;
  database?: string;
  user?: string;
  version?: string;
  serverTime?: string;
  message?: string;
}

export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'ADMIN'
  | 'NETWORK_ENGINEER' 
  | 'DC_TECH' 
  | 'READ_ONLY_AUDITOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  permissions: string[];
  department?: string;
  created_at?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  category: 'INVENTORY' | 'CABLING' | 'INFRASTRUCTURE' | 'AUTH' | 'SYSTEM';
  details: string;
  user_email: string;
  created_at: string;
}

export interface SystemStats {
  counts: {
    sites: number;
    racks: number;
    devices: number;
    ports: number;
    vlans: number;
    users: number;
    auditLogs: number;
  };
  postgresPool: {
    activeQueries: number;
    maxPoolSize: number;
  };
}
