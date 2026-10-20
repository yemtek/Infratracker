import { Pool } from 'pg';
import crypto from 'crypto';

const connectionString = process.env.DATABASE_URL || 
  "postgresql://neondb_owner:npg_rwnJj9DeWGH6@ep-flat-frost-b493075b-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function initDatabase() {
  console.log('[Neon PostgreSQL] Initializing database tables...');
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS racks (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        height INT DEFAULT 42,
        site_id VARCHAR(64) NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        model VARCHAR(255) NOT NULL,
        device_type VARCHAR(64) DEFAULT 'SERVER',
        serial_number VARCHAR(128) UNIQUE NOT NULL,
        mac_address VARCHAR(64),
        ip_address VARCHAR(64),
        start_u INT NOT NULL,
        unit_height INT DEFAULT 1,
        status VARCHAR(32) DEFAULT 'ONLINE',
        power_watts INT DEFAULT 350,
        rack_id VARCHAR(64) NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS vlans (
        id VARCHAR(64) PRIMARY KEY,
        vlan_number INT UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color_hex VARCHAR(32) DEFAULT '#10b981',
        subnet VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ports (
        id VARCHAR(64) PRIMARY KEY,
        port_number INT NOT NULL,
        port_name VARCHAR(64),
        port_type VARCHAR(64) DEFAULT 'CAT6',
        speed_mbps INT DEFAULT 1000,
        status VARCHAR(32) DEFAULT 'UP',
        device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        connected_port_id VARCHAR(64) UNIQUE,
        vlan_id VARCHAR(64) REFERENCES vlans(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(64) NOT NULL DEFAULT 'DC_TECH',
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        permissions TEXT[] DEFAULT ARRAY[]::text[],
        department VARCHAR(128) DEFAULT 'Datacenter Operations',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        action VARCHAR(128) NOT NULL,
        category VARCHAR(64) NOT NULL,
        details TEXT NOT NULL,
        user_email VARCHAR(255) NOT NULL DEFAULT 'admin@infratrack.io',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO system_config (key, value)
      VALUES ('super_admin_secret_password', 'Emzee@SuperAdmin2026!')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Seed default users if empty
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO users (id, name, email, role, status, permissions, department) VALUES
        ('usr-super-admin', 'EMZEE (Lead Admin)', 'bossyemzee@gmail.com', 'SUPER_ADMIN', 'ACTIVE', ARRAY['ALL', 'MANAGE_USERS', 'WIPE_DATA', 'INTAKE_HARDWARE', 'PATCH_CABLING', 'PROVISION_RACKS'], 'Cloud Infrastructure & Engineering'),
        ('usr-net-eng', 'Sarah Chen', 'sarah.chen@infraops.internal', 'NETWORK_ENGINEER', 'ACTIVE', ARRAY['PATCH_CABLING', 'MANAGE_VLANS', 'INSPECT_ASSETS'], 'Network Operations Center (NOC)'),
        ('usr-dc-tech', 'Marcus Vance', 'marcus.vance@infraops.internal', 'DC_TECH', 'ACTIVE', ARRAY['INTAKE_HARDWARE', 'PROVISION_RACKS', 'INSPECT_ASSETS'], 'Datacenter Field Operations'),
        ('usr-auditor', 'Elena Rostova', 'auditor.compliance@finops.internal', 'READ_ONLY_AUDITOR', 'ACTIVE', ARRAY['READ_ONLY', 'EXPORT_INVENTORY', 'INSPECT_ASSETS'], 'Security & ISO-27001 Compliance');

        INSERT INTO audit_logs (id, action, category, details, user_email) VALUES
        ('log-01', 'SYSTEM_INITIALIZATION', 'SYSTEM', 'Production Neon PostgreSQL database schema mounted and verified', 'system@infratrack.io'),
        ('log-02', 'FACILITY_PROVISIONED', 'INFRASTRUCTURE', 'Ashburn DC-1 (Alpha) and Silicon Valley Edge facilities configured', 'bossyemzee@gmail.com'),
        ('log-03', 'RACK_ELEVATION_LOADED', 'INFRASTRUCTURE', '42U standard EIA-310 enclosures deployed with Cisco & Dell nodes', 'bossyemzee@gmail.com');
      `);
    }

    // Ensure all compatibility columns exist on existing tables
    await client.query(`
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(64);
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS category VARCHAR(64);
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS power_watts INT DEFAULT 350;
      
      -- Backfill device_type from category if empty
      UPDATE devices SET device_type = COALESCE(device_type, category, 'SERVER') WHERE device_type IS NULL;
      UPDATE devices SET category = COALESCE(category, device_type, 'SERVER') WHERE category IS NULL;

      ALTER TABLE ports ADD COLUMN IF NOT EXISTS port_name VARCHAR(64);
      ALTER TABLE ports ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'UP';
      ALTER TABLE ports ADD COLUMN IF NOT EXISTS speed_mbps INT DEFAULT 1000;
      ALTER TABLE ports ADD COLUMN IF NOT EXISTS cable_type VARCHAR(64) DEFAULT 'CAT6';
      
      -- Backfill port_name if empty
      UPDATE ports SET port_name = COALESCE(port_name, 'Port ' || port_number) WHERE port_name IS NULL;

      ALTER TABLE vlans ADD COLUMN IF NOT EXISTS subnet VARCHAR(64);
      ALTER TABLE vlans ADD COLUMN IF NOT EXISTS color_hex VARCHAR(32) DEFAULT '#10b981';
    `);

    // Check if demo seed data exists, if not seed it!
    const res = await client.query('SELECT COUNT(*) as count FROM sites');
    if (parseInt(res.rows[0].count) === 0) {
      console.log('[Neon PostgreSQL] Database is empty. Seeding enterprise infrastructure data...');
      await seedDatabase(client);
    } else {
      console.log(`[Neon PostgreSQL] Database ready. Existing sites: ${res.rows[0].count}`);
    }
  } catch (err) {
    console.error('[Neon PostgreSQL] Initialization error:', err);
  } finally {
    client.release();
  }
}

export async function seedDatabase(client?: any) {
  const db = client || (await pool.connect());
  const shouldRelease = !client;

  try {
    await db.query('BEGIN');

    // Clean existing data for clean re-seed
    await db.query('DELETE FROM ports');
    await db.query('DELETE FROM devices');
    await db.query('DELETE FROM racks');
    await db.query('DELETE FROM sites');
    await db.query('DELETE FROM vlans');

    // 1. Create Sites
    const site1Id = 'site-us-east-dc1';
    const site2Id = 'site-us-west-edge';

    await db.query(`
      INSERT INTO sites (id, name, location, address) VALUES
      ($1, 'Ashburn DC-1 (Alpha)', 'Ashburn, VA', '21635 Red Rum Dr, Ashburn, VA 20147'),
      ($2, 'Silicon Valley Edge-2', 'San Jose, CA', '11 Great Oaks Blvd, San Jose, CA 95119')
    `, [site1Id, site2Id]);

    // 2. Create Racks
    const rackA1 = 'rack-a1';
    const rackA2 = 'rack-a2';
    const rackB1 = 'rack-b1';

    await db.query(`
      INSERT INTO racks (id, name, height, site_id) VALUES
      ($1, 'Rack A-01 [Core & Compute]', 42, $4),
      ($2, 'Rack A-02 [Storage & Blade]', 42, $4),
      ($3, 'Rack B-01 [Edge & Gateway]', 42, $5)
    `, [rackA1, rackA2, rackB1, site1Id, site2Id]);

    // 3. Create VLANs
    const vlanMgmt = 'vlan-10';
    const vlanProd = 'vlan-20';
    const vlanStorage = 'vlan-30';
    const vlanDMZ = 'vlan-99';

    await db.query(`
      INSERT INTO vlans (id, vlan_number, name, description, color_hex, subnet) VALUES
      ($1, 10, 'Out-of-Band Management (OOBM)', 'iDRAC, iLO, Console & Switch IPMI', '#38bdf8', '10.100.10.0/24'),
      ($2, 20, 'Production Workloads', 'Kubernetes node data fabric & VMs', '#10b981', '10.100.20.0/24'),
      ($3, 30, 'NVMe-oF / Storage SAN', 'Jumbo frame 9000 MTU storage interconnect', '#f59e0b', '10.100.30.0/24'),
      ($4, 99, 'DMZ / Public Ingress', 'Border firewalls & edge load balancers', '#f43f5e', '172.16.99.0/24')
    `, [vlanMgmt, vlanProd, vlanStorage, vlanDMZ]);

    // 4. Create Devices in Rack A-01
    // Equipment:
    // U42: Panduit 1U Brush Cable Manager
    // U41: Cisco Catalyst 9500-24Y4C (1U Core Switch)
    // U40: Systimax GigaSPEED 24-Port Patch Panel (1U)
    // U38-39: Panduit 2U D-Ring Horizontal Wire Manager (2U)
    // U37: Cisco Catalyst 9300-48P (1U PoE+ Access Switch)
    // U36: Fortinet FortiGate 100F (1U Next-Gen Firewall)
    // U30-31: Dell PowerEdge R750 (2U Server - Node 01)
    // U28-29: Dell PowerEdge R750 (2U Server - Node 02)
    // U25: Dell PowerEdge R650 (1U Server - API Gateway)
    // U23-24: HPE ProLiant DL380 Gen10 (2U Virtualization Host)
    // U14-17: Dell PowerEdge MX7000 (4U Blade Chassis - 8 Compute Nodes)
    // U4: APC Metered Rack PDU (1U)
    // U1-2: APC Smart-UPS RT 3000VA (2U Battery Backup)

    const devCoreSwitch = 'dev-c9500-core';
    const devAccessSwitch = 'dev-c9300-acc';
    const devFirewall = 'dev-fg-100f';
    const devPatchPanel = 'dev-patch-01';
    const devBrushManager = 'dev-brush-42';
    const devWireManager = 'dev-wire-38';
    const devDellR750_1 = 'dev-r750-01';
    const devDellR750_2 = 'dev-r750-02';
    const devDellR650 = 'dev-r650-01';
    const devHpeDL380 = 'dev-dl380-01';
    const devBladeChassis = 'dev-mx7000-01';
    const devPDU = 'dev-pdu-01';
    const devUPS = 'dev-ups-01';

    await db.query(`
      INSERT INTO devices (id, name, model, device_type, serial_number, mac_address, ip_address, start_u, unit_height, status, power_watts, rack_id) VALUES
      ($1, 'CORE-SW-01', 'Cisco Catalyst 9500-24Y4C', 'SWITCH', 'FCW2348A09B', '00:40:96:11:22:33', '10.100.1.1', 41, 1, 'ONLINE', 450, $14),
      ($2, 'ACCESS-SW-01', 'Cisco Catalyst 9300-48P', 'SWITCH', 'FCW2409B11C', '00:40:96:44:55:66', '10.100.1.2', 37, 1, 'ONLINE', 600, $14),
      ($3, 'EDGE-FW-01', 'Fortinet FortiGate 100F', 'FIREWALL', 'FG100FTK21004921', '00:09:0F:77:88:99', '10.100.0.1', 36, 1, 'ONLINE', 120, $14),
      ($4, 'PP-CAT6-A01', 'Systimax GigaSPEED XL 24P', 'PATCH_PANEL', 'PP-SYS-24P-001', NULL, NULL, 40, 1, 'ONLINE', 0, $14),
      ($5, 'BRUSH-MGMT-42', 'Panduit 1U Brush Manager', 'CABLE_ORGANIZER', 'PAN-BRUSH-042', NULL, NULL, 42, 1, 'ONLINE', 0, $14),
      ($6, 'WIRE-DUCT-38', 'Panduit 2U D-Ring Horizontal', 'CABLE_ORGANIZER', 'PAN-DRING-038', NULL, NULL, 38, 2, 'ONLINE', 0, $14),
      ($7, 'PROD-K8S-NODE-01', 'Dell PowerEdge R750', 'SERVER', '8GQ2MN3', 'B0:4F:13:AA:BB:01', '10.100.20.11', 30, 2, 'ONLINE', 750, $14),
      ($8, 'PROD-K8S-NODE-02', 'Dell PowerEdge R750', 'SERVER', '8GQ2MN4', 'B0:4F:13:AA:BB:02', '10.100.20.12', 28, 2, 'ONLINE', 750, $14),
      ($9, 'EDGE-API-GW-01', 'Dell PowerEdge R650', 'SERVER', '5DF9PK2', 'B0:4F:13:CC:DD:01', '10.100.20.15', 25, 1, 'WARNING', 420, $14),
      ($10, 'VM-ESXI-HOST-01', 'HPE ProLiant DL380 Gen10', 'SERVER', 'CZ28490B55', 'D4:F5:27:EE:FF:01', '10.100.20.20', 23, 2, 'ONLINE', 680, $14),
      ($11, 'BLADE-CHASSIS-01', 'Dell PowerEdge MX7000', 'BLADE_CHASSIS', 'MX7000-US-001', 'A4:BA:DB:12:34:56', '10.100.3.1', 14, 4, 'ONLINE', 2400, $14),
      ($12, 'RACK-PDU-A01', 'APC Metered Rack PDU AP7800B', 'PDU', 'PDU-APC-00192', '00:C0:B7:65:43:21', '10.100.99.10', 4, 1, 'ONLINE', 35, $14),
      ($13, 'RACK-UPS-3000', 'APC Smart-UPS RT 3000VA', 'PDU', 'UPS-APC-3KVA-01', '00:C0:B7:99:88:77', '10.100.99.11', 1, 2, 'ONLINE', 90, $14)
    `, [
      devCoreSwitch, devAccessSwitch, devFirewall, devPatchPanel, devBrushManager,
      devWireManager, devDellR750_1, devDellR750_2, devDellR650, devHpeDL380,
      devBladeChassis, devPDU, devUPS, rackA1
    ]);

    // Also populate Rack A-02 with equipment for comparison view:
    const devUniFiSwitch = 'dev-unifi-pro';
    const devStorageSAN = 'dev-dell-me4024';
    const devDellR750_3 = 'dev-r750-03';

    await db.query(`
      INSERT INTO devices (id, name, model, device_type, serial_number, mac_address, ip_address, start_u, unit_height, status, power_watts, rack_id) VALUES
      ($1, 'DIST-SW-A02', 'Ubiquiti UniFi Switch Pro 48 PoE', 'SWITCH', 'UBNT-PRO48-9921', '74:83:C2:55:12:34', '10.100.1.5', 41, 1, 'ONLINE', 450, $4),
      ($2, 'SAN-ARRAY-01', 'Dell PowerVault ME4024', 'SERVER', 'PV-ME4024-8841', '00:60:16:33:44:55', '10.100.30.5', 20, 2, 'ONLINE', 850, $4),
      ($3, 'BACKUP-NODE-01', 'Dell PowerEdge R750', 'SERVER', '9KJ4PT1', 'B0:4F:13:AA:BB:03', '10.100.20.13', 25, 2, 'CRITICAL', 780, $4)
    `, [devUniFiSwitch, devStorageSAN, devDellR750_3, rackA2]);

    // 5. Create Ports for devices
    // Core Switch Ports:
    // Port 1-4: 100G QSFP28 Uplinks
    // Port 5-28: 25G SFP28 Fiber
    const pCore1 = 'port-core-01';
    const pCore2 = 'port-core-02';
    const pCore5 = 'port-core-05';
    const pCore6 = 'port-core-06';
    const pCore7 = 'port-core-07';
    const pCore8 = 'port-core-08';

    // Access Switch Ports:
    // Port 1-48: 1G RJ45 Cat6 PoE
    // Port 49-52: 10G SFP+
    const pAccUplink1 = 'port-acc-49';
    const pAccUplink2 = 'port-acc-50';
    const pAccPort1 = 'port-acc-01';
    const pAccPort2 = 'port-acc-02';
    const pAccPort3 = 'port-acc-03';
    const pAccPort4 = 'port-acc-04';

    // Firewall Ports:
    const pFwWan = 'port-fw-wan1';
    const pFwLan1 = 'port-fw-lan1';

    // Server Ports:
    const pR750_1_Eth1 = 'port-r750-1-eth1';
    const pR750_1_Eth2 = 'port-r750-1-eth2';
    const pR750_2_Eth1 = 'port-r750-2-eth1';
    const pR650_Eth1 = 'port-r650-eth1';
    const pBladeFabricA = 'port-blade-fab-a';
    const pBladeFabricB = 'port-blade-fab-b';

    await db.query(`
      INSERT INTO ports (id, port_number, port_name, port_type, speed_mbps, status, device_id, vlan_id) VALUES
      -- Core Switch Ports
      ('${pCore1}', 1, 'HundredGigE1/0/1', 'QSFP28', 100000, 'UP', '${devCoreSwitch}', '${vlanProd}'),
      ('${pCore2}', 2, 'HundredGigE1/0/2', 'QSFP28', 100000, 'UP', '${devCoreSwitch}', '${vlanProd}'),
      ('${pCore5}', 5, 'TwentyFiveGigE1/0/5', 'SINGLE_MODE_FIBER', 25000, 'UP', '${devCoreSwitch}', '${vlanProd}'),
      ('${pCore6}', 6, 'TwentyFiveGigE1/0/6', 'SINGLE_MODE_FIBER', 25000, 'UP', '${devCoreSwitch}', '${vlanProd}'),
      ('${pCore7}', 7, 'TwentyFiveGigE1/0/7', 'MULTI_MODE_FIBER', 25000, 'UP', '${devCoreSwitch}', '${vlanStorage}'),
      ('${pCore8}', 8, 'TwentyFiveGigE1/0/8', 'MULTI_MODE_FIBER', 25000, 'UP', '${devCoreSwitch}', '${vlanStorage}'),

      -- Access Switch Ports
      ('${pAccUplink1}', 49, 'TenGigE1/1/1', 'SINGLE_MODE_FIBER', 10000, 'UP', '${devAccessSwitch}', '${vlanProd}'),
      ('${pAccUplink2}', 50, 'TenGigE1/1/2', 'SINGLE_MODE_FIBER', 10000, 'UP', '${devAccessSwitch}', '${vlanProd}'),
      ('${pAccPort1}', 1, 'GigabitEthernet1/0/1', 'CAT6', 1000, 'UP', '${devAccessSwitch}', '${vlanProd}'),
      ('${pAccPort2}', 2, 'GigabitEthernet1/0/2', 'CAT6', 1000, 'UP', '${devAccessSwitch}', '${vlanProd}'),
      ('${pAccPort3}', 3, 'GigabitEthernet1/0/3', 'CAT6', 1000, 'UP', '${devAccessSwitch}', '${vlanMgmt}'),
      ('${pAccPort4}', 4, 'GigabitEthernet1/0/4', 'CAT6', 1000, 'UP', '${devAccessSwitch}', '${vlanProd}'),

      -- Firewall Ports
      ('${pFwWan}', 1, 'port1 (WAN)', 'CAT6', 1000, 'UP', '${devFirewall}', '${vlanDMZ}'),
      ('${pFwLan1}', 2, 'port2 (Internal)', 'CAT6', 1000, 'UP', '${devFirewall}', '${vlanProd}'),

      -- Server Ports
      ('${pR750_1_Eth1}', 1, 'NIC1 Embedded (Port 1)', 'CAT6', 10000, 'UP', '${devDellR750_1}', '${vlanProd}'),
      ('${pR750_1_Eth2}', 2, 'iDRAC Dedicated', 'CAT6', 1000, 'UP', '${devDellR750_1}', '${vlanMgmt}'),
      ('${pR750_2_Eth1}', 1, 'NIC1 Embedded (Port 1)', 'CAT6', 10000, 'UP', '${devDellR750_2}', '${vlanProd}'),
      ('${pR650_Eth1}', 1, 'NIC1 Embedded (Port 1)', 'CAT6', 1000, 'UP', '${devDellR650}', '${vlanProd}'),
      ('${pBladeFabricA}', 1, 'Fabric A1 25G Uplink', 'MULTI_MODE_FIBER', 25000, 'UP', '${devBladeChassis}', '${vlanStorage}'),
      ('${pBladeFabricB}', 2, 'Fabric B1 25G Uplink', 'MULTI_MODE_FIBER', 25000, 'UP', '${devBladeChassis}', '${vlanStorage}')
    `);

    // 6. Connect Cables between ports (Port-to-Port Tracing Matrix)
    // - Core SW Port 5 <-> Access SW Uplink 49 (Single-Mode Fiber, Yellow)
    // - Access SW Port 1 <-> Dell R750-1 NIC 1 (Cat6, Blue)
    // - Access SW Port 2 <-> Dell R750-2 NIC 1 (Cat6, Blue)
    // - Access SW Port 3 <-> Dell R750-1 iDRAC (Cat6, Blue)
    // - Core SW Port 7 <-> Blade Chassis Fabric A1 (Multi-Mode Fiber, Aqua)
    // - Firewall LAN1 <-> Access SW Port 4 (Cat6, Blue)
    await db.query(`
      UPDATE ports SET connected_port_id = '${pAccUplink1}' WHERE id = '${pCore5}';
      UPDATE ports SET connected_port_id = '${pCore5}' WHERE id = '${pAccUplink1}';

      UPDATE ports SET connected_port_id = '${pR750_1_Eth1}' WHERE id = '${pAccPort1}';
      UPDATE ports SET connected_port_id = '${pAccPort1}' WHERE id = '${pR750_1_Eth1}';

      UPDATE ports SET connected_port_id = '${pR750_2_Eth1}' WHERE id = '${pAccPort2}';
      UPDATE ports SET connected_port_id = '${pAccPort2}' WHERE id = '${pR750_2_Eth1}';

      UPDATE ports SET connected_port_id = '${pR750_1_Eth2}' WHERE id = '${pAccPort3}';
      UPDATE ports SET connected_port_id = '${pAccPort3}' WHERE id = '${pR750_1_Eth2}';

      UPDATE ports SET connected_port_id = '${pBladeFabricA}' WHERE id = '${pCore7}';
      UPDATE ports SET connected_port_id = '${pCore7}' WHERE id = '${pBladeFabricA}';

      UPDATE ports SET connected_port_id = '${pFwLan1}' WHERE id = '${pAccPort4}';
      UPDATE ports SET connected_port_id = '${pAccPort4}' WHERE id = '${pFwLan1}';
    `);

    await db.query('COMMIT');
    console.log('[Neon PostgreSQL] Enterprise infrastructure seed completed successfully!');
  } catch (e) {
    await db.query('ROLLBACK');
    console.error('[Neon PostgreSQL] Seed error:', e);
    throw e;
  } finally {
    if (shouldRelease) db.release();
  }
}
