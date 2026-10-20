import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, initDatabase, seedDatabase } from './server/db.ts';

dotenv.config();

// Ensure HMR is disabled in cloud sandbox per environment guidelines
process.env.DISABLE_HMR = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Lazy database initialization for serverless deployment environments (e.g. Vercel)
let isDbReady = false;
app.use(async (req, res, next) => {
  if (!isDbReady && req.path.startsWith('/api')) {
    try {
      await initDatabase();
      isDbReady = true;
    } catch (err) {
      console.warn('[InfraTrack] Lazy DB init warning:', err);
    }
  }
  next();
});

// API Routes

// 1. Database Health & Metadata
app.get('/api/health', async (req, res) => {
  const start = Date.now();
  try {
    const result = await pool.query('SELECT version(), current_database(), current_user, NOW() as now');
    const latencyMs = Date.now() - start;
    res.json({
      status: 'connected',
      provider: 'Neon.tech PostgreSQL (Serverless)',
      latencyMs,
      database: result.rows[0].current_database,
      user: result.rows[0].current_user,
      version: result.rows[0].version,
      serverTime: result.rows[0].now,
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

// 2. Sites
app.get('/api/sites', async (req, res) => {
  try {
    const query = `
      SELECT s.*, 
        COUNT(DISTINCT r.id)::int as rack_count,
        COUNT(DISTINCT d.id)::int as device_count
      FROM sites s
      LEFT JOIN racks r ON r.site_id = s.id
      LEFT JOIN devices d ON d.rack_id = r.id
      GROUP BY s.id
      ORDER BY s.name ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sites', async (req, res) => {
  const { name, location, address } = req.body;
  if (!name || !location) {
    return res.status(400).json({ error: 'Name and location are required' });
  }
  const id = `site-${Date.now().toString(36)}`;
  try {
    const result = await pool.query(
      'INSERT INTO sites (id, name, location, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, location, address || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sites/:id', async (req, res) => {
  const { id } = req.params;
  const { name, location, address } = req.body;
  try {
    const result = await pool.query(`
      UPDATE sites SET
        name = COALESCE($1, name),
        location = COALESCE($2, location),
        address = COALESCE($3, address),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [name, location, address, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sites/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Clear connected_port_id pointing to ports in this site
    await client.query(`
      UPDATE ports SET connected_port_id = NULL
      WHERE connected_port_id IN (
        SELECT p.id FROM ports p
        JOIN devices d ON d.id = p.device_id
        JOIN racks r ON r.id = d.rack_id
        WHERE r.site_id = $1
      )
    `, [id]);

    const result = await client.query('DELETE FROM sites WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Site not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Site deleted successfully', site: result.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// 3. Racks
app.get('/api/racks', async (req, res) => {
  const { siteId } = req.query;
  try {
    let query = `
      SELECT r.*, s.name as site_name, s.location as site_location,
        COUNT(d.id)::int as device_count,
        COALESCE(SUM(d.unit_height), 0)::int as used_u,
        COALESCE(SUM(d.power_watts), 0)::int as total_power_watts
      FROM racks r
      JOIN sites s ON s.id = r.site_id
      LEFT JOIN devices d ON d.rack_id = r.id
    `;
    const params: any[] = [];
    if (siteId) {
      query += ` WHERE r.site_id = $1`;
      params.push(siteId);
    }
    query += ` GROUP BY r.id, s.name, s.location ORDER BY r.name ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/racks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rackRes = await pool.query(`
      SELECT r.*, s.name as site_name, s.location as site_location
      FROM racks r
      JOIN sites s ON s.id = r.site_id
      WHERE r.id = $1
    `, [id]);

    if (rackRes.rows.length === 0) {
      return res.status(404).json({ error: 'Rack not found' });
    }

    const rack = rackRes.rows[0];

    // Fetch devices with their ports
    const devicesRes = await pool.query(`
      SELECT d.*,
        json_agg(
          json_build_object(
            'id', p.id,
            'portNumber', p.port_number,
            'portName', p.port_name,
            'portType', p.port_type,
            'speedMbps', p.speed_mbps,
            'status', p.status,
            'connectedPortId', p.connected_port_id,
            'vlanId', p.vlan_id
          ) ORDER BY p.port_number ASC
        ) FILTER (WHERE p.id IS NOT NULL) as ports
      FROM devices d
      LEFT JOIN ports p ON p.device_id = d.id
      WHERE d.rack_id = $1
      GROUP BY d.id
      ORDER BY d.start_u DESC
    `, [id]);

    rack.devices = devicesRes.rows.map(row => ({
      ...row,
      ports: row.ports || []
    }));

    res.json(rack);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/racks', async (req, res) => {
  const { name, siteId, height = 42 } = req.body;
  if (!name || !siteId) {
    return res.status(400).json({ error: 'Rack name and siteId are required' });
  }
  const id = `rack-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  try {
    const result = await pool.query(
      'INSERT INTO racks (id, name, height, site_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name.trim(), parseInt(height, 10) || 42, siteId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/racks/:id', async (req, res) => {
  const { id } = req.params;
  const { name, height, siteId } = req.body;
  try {
    const result = await pool.query(`
      UPDATE racks SET
        name = COALESCE($1, name),
        height = COALESCE($2, height),
        site_id = COALESCE($3, site_id),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [name, height ? parseInt(height, 10) : null, siteId, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rack not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/racks/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Clear connected_port_id pointing to ports in this rack
    await client.query(`
      UPDATE ports SET connected_port_id = NULL
      WHERE connected_port_id IN (
        SELECT p.id FROM ports p
        JOIN devices d ON d.id = p.device_id
        WHERE d.rack_id = $1
      )
    `, [id]);

    const result = await client.query('DELETE FROM racks WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rack not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Rack deleted successfully', rack: result.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// 4. Devices & Hardware Registry
app.get('/api/devices', async (req, res) => {
  const { rackId, search, status, type } = req.query;
  try {
    let query = `
      SELECT d.*, r.name as rack_name, s.name as site_name,
        COUNT(p.id)::int as port_count,
        COUNT(p.connected_port_id)::int as connected_port_count
      FROM devices d
      JOIN racks r ON r.id = d.rack_id
      JOIN sites s ON s.id = r.site_id
      LEFT JOIN ports p ON p.device_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (rackId) {
      query += ` AND d.rack_id = $${idx++}`;
      params.push(rackId);
    }
    if (status) {
      query += ` AND d.status = $${idx++}`;
      params.push(status);
    }
    if (type) {
      query += ` AND d.device_type = $${idx++}`;
      params.push(type);
    }
    if (search) {
      query += ` AND (
        d.name ILIKE $${idx} OR 
        d.model ILIKE $${idx} OR 
        d.serial_number ILIKE $${idx} OR 
        d.ip_address ILIKE $${idx} OR
        d.mac_address ILIKE $${idx}
      )`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` GROUP BY d.id, r.name, s.name ORDER BY d.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/devices', async (req, res) => {
  const {
    name,
    model,
    deviceType = 'SERVER',
    serialNumber,
    macAddress,
    ipAddress,
    startU,
    unitHeight = 1,
    status = 'ONLINE',
    powerWatts = 300,
    rackId,
    portCount = 4,
    defaultPortType = 'CAT6'
  } = req.body;

  if (!name || !model || !serialNumber || !rackId || startU === undefined) {
    return res.status(400).json({ error: 'Missing required device specifications' });
  }

  const uStart = parseInt(startU, 10);
  const uHeight = parseInt(unitHeight, 10);
  const uEnd = uStart + uHeight - 1;

  if (uStart < 1 || uEnd > 42) {
    return res.status(400).json({ error: `Unit range ${uStart}U-${uEnd}U exceeds rack dimensions (1U-42U)` });
  }

  try {
    // Collision detection check in rack:
    const collisionCheck = await pool.query(`
      SELECT id, name, model, start_u, unit_height
      FROM devices
      WHERE rack_id = $1
        AND NOT (start_u + unit_height - 1 < $2 OR start_u > $3)
    `, [rackId, uStart, uEnd]);

    if (collisionCheck.rows.length > 0) {
      const conflict = collisionCheck.rows[0];
      return res.status(409).json({
        error: `Slot collision: Units ${uStart}U-${uEnd}U overlap with existing device "${conflict.name}" (${conflict.model}) occupying ${conflict.start_u}U-${conflict.start_u + conflict.unit_height - 1}U.`
      });
    }

    const deviceId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    // Insert device
    const deviceRes = await pool.query(`
      INSERT INTO devices (
        id, name, model, device_type, category, serial_number, mac_address, ip_address,
        start_u, unit_height, status, power_watts, rack_id
      ) VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      deviceId, name, model, deviceType, serialNumber.trim().toUpperCase(),
      macAddress || null, ipAddress || null, uStart, uHeight, status, powerWatts, rackId
    ]);

    // Provision default ports if requested
    const pCount = Math.min(Math.max(parseInt(portCount, 10) || 0, 0), 48);
    if (pCount > 0) {
      for (let i = 1; i <= pCount; i++) {
        const portId = `port-${deviceId}-${i}`;
        const portName = deviceType === 'SWITCH' ? `ge-1/0/${i}` : `eth${i - 1}`;
        await pool.query(`
          INSERT INTO ports (id, port_number, port_name, port_type, cable_type, speed_mbps, status, device_id)
          VALUES ($1, $2, $3, $4, $4, 1000, 'UP', $5)
        `, [portId, i, portName, defaultPortType, deviceId]);
      }
    }

    res.status(201).json(deviceRes.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A device with serial number "${serialNumber}" already exists in the inventory registry.` });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/devices/:id', async (req, res) => {
  const { id } = req.params;
  const { name, model, deviceType, serialNumber, macAddress, ipAddress, startU, unitHeight, status, powerWatts, rackId, userEmail = 'bossyemzee@gmail.com' } = req.body;

  try {
    const result = await pool.query(`
      UPDATE devices SET
        name = COALESCE($1, name),
        model = COALESCE($2, model),
        device_type = COALESCE($3, device_type),
        category = COALESCE($3, category, device_type),
        serial_number = COALESCE($4, serial_number),
        mac_address = COALESCE($5, mac_address),
        ip_address = COALESCE($6, ip_address),
        start_u = COALESCE($7, start_u),
        unit_height = COALESCE($8, unit_height),
        status = COALESCE($9, status),
        power_watts = COALESCE($10, power_watts),
        rack_id = COALESCE($11, rack_id),
        updated_at = NOW()
      WHERE id = $12
      RETURNING *
    `, [name, model, deviceType, serialNumber, macAddress, ipAddress, startU, unitHeight, status, powerWatts, rackId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, action, category, details, user_email) VALUES ($1, $2, $3, $4, $5)',
      [`log-${Date.now().toString(36)}`, 'DEVICE_UPDATED', 'INVENTORY', `Modified asset "${result.rows[0].name}" (${result.rows[0].model})`, userEmail]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/devices/:id', async (req, res) => {
  const { id } = req.params;
  const userEmail = (req.query.userEmail as string) || 'bossyemzee@gmail.com';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch device name first for audit log
    const devQuery = await client.query('SELECT name, model, serial_number FROM devices WHERE id = $1', [id]);
    const devInfo = devQuery.rows[0];

    // Clear foreign cable connections pointing to this device's ports
    await client.query(`
      UPDATE ports SET connected_port_id = NULL
      WHERE connected_port_id IN (SELECT id FROM ports WHERE device_id = $1)
    `, [id]);

    // Clear connected_port_id on the device's own ports
    await client.query('UPDATE ports SET connected_port_id = NULL WHERE device_id = $1', [id]);

    // Delete ports of this device explicitly to avoid any FK edge cases
    await client.query('DELETE FROM ports WHERE device_id = $1', [id]);

    const result = await client.query('DELETE FROM devices WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Device not found' });
    }

    // Audit log
    await client.query(
      'INSERT INTO audit_logs (id, action, category, details, user_email) VALUES ($1, $2, $3, $4, $5)',
      [`log-${Date.now().toString(36)}`, 'DEVICE_DECOMMISSIONED', 'INVENTORY', `Decommissioned asset "${devInfo?.name || id}" (${devInfo?.serial_number || ''})`, userEmail]
    );

    await client.query('COMMIT');
    res.json({ message: 'Device removed successfully', device: result.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// 5. Ports & Cable Tracing Matrix
app.get('/api/ports', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id,
        p.port_number,
        p.port_name,
        p.port_type,
        p.speed_mbps,
        p.status,
        p.device_id,
        d.name as device_name,
        d.model as device_model,
        d.device_type,
        r.name as rack_name,
        r.id as rack_id,
        p.vlan_id,
        v.vlan_number,
        v.name as vlan_name,
        v.color_hex as vlan_color,
        p.connected_port_id,
        dest_p.port_number as dest_port_number,
        dest_p.port_name as dest_port_name,
        dest_d.id as dest_device_id,
        dest_d.name as dest_device_name,
        dest_d.model as dest_device_model,
        dest_r.id as dest_rack_id,
        dest_r.name as dest_rack_name
      FROM ports p
      JOIN devices d ON d.id = p.device_id
      JOIN racks r ON r.id = d.rack_id
      LEFT JOIN vlans v ON v.id = p.vlan_id
      LEFT JOIN ports dest_p ON dest_p.id = p.connected_port_id
      LEFT JOIN devices dest_d ON dest_d.id = dest_p.device_id
      LEFT JOIN racks dest_r ON dest_r.id = dest_d.rack_id
      ORDER BY r.name ASC, d.start_u DESC, p.port_number ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ports/connect', async (req, res) => {
  const { sourcePortId, destPortId, cableType = 'CAT6' } = req.body;
  if (!sourcePortId || !destPortId) {
    return res.status(400).json({ error: 'sourcePortId and destPortId are required' });
  }

  if (sourcePortId === destPortId) {
    return res.status(400).json({ error: 'Cannot loop a port to itself' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear any prior links for both ports
    await client.query(`
      UPDATE ports SET connected_port_id = NULL
      WHERE connected_port_id = $1 OR connected_port_id = $2
    `, [sourcePortId, destPortId]);

    // Set bidirectional link
    await client.query(`
      UPDATE ports SET connected_port_id = $1, port_type = $3 WHERE id = $2
    `, [destPortId, sourcePortId, cableType]);

    await client.query(`
      UPDATE ports SET connected_port_id = $1, port_type = $3 WHERE id = $2
    `, [sourcePortId, destPortId, cableType]);

    await client.query('COMMIT');
    res.json({ message: 'Cable connection successfully established', sourcePortId, destPortId, cableType });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.post('/api/ports/disconnect', async (req, res) => {
  const { portId } = req.body;
  if (!portId) {
    return res.status(400).json({ error: 'portId is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current link
    const portRes = await client.query('SELECT connected_port_id FROM ports WHERE id = $1', [portId]);
    const remotePortId = portRes.rows[0]?.connected_port_id;

    await client.query('UPDATE ports SET connected_port_id = NULL WHERE id = $1', [portId]);
    if (remotePortId) {
      await client.query('UPDATE ports SET connected_port_id = NULL WHERE id = $1', [remotePortId]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Cable patch disconnected', portId, remotePortId });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// 6. VLANs
app.get('/api/vlans', async (req, res) => {
  try {
    const query = `
      SELECT v.*, COUNT(p.id)::int as port_count
      FROM vlans v
      LEFT JOIN ports p ON p.vlan_id = v.id
      GROUP BY v.id
      ORDER BY v.vlan_number ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vlans', async (req, res) => {
  const { vlanNumber, name, description, colorHex = '#10b981', subnet } = req.body;
  if (!vlanNumber || !name) {
    return res.status(400).json({ error: 'VLAN number and name are required' });
  }
  const id = `vlan-${vlanNumber}`;
  try {
    const result = await pool.query(`
      INSERT INTO vlans (id, vlan_number, name, description, color_hex, subnet)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [id, parseInt(vlanNumber, 10), name, description || '', colorHex, subnet || '']);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `VLAN ID ${vlanNumber} already exists.` });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vlans/:id', async (req, res) => {
  const { id } = req.params;
  const { vlanNumber, name, description, colorHex, subnet } = req.body;
  try {
    const result = await pool.query(`
      UPDATE vlans SET
        vlan_number = COALESCE($1, vlan_number),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        color_hex = COALESCE($4, color_hex),
        subnet = COALESCE($5, subnet),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [vlanNumber ? parseInt(vlanNumber, 10) : null, name, description, colorHex, subnet, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'VLAN not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/vlans/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Unbind ports from this VLAN
    await client.query('UPDATE ports SET vlan_id = NULL WHERE vlan_id = $1', [id]);
    const result = await client.query('DELETE FROM vlans WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'VLAN not found' });
    }
    await client.query('COMMIT');
    res.json({ message: 'VLAN deleted successfully', vlan: result.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// 7. Seed / Reset Data
app.post('/api/seed', async (req, res) => {
  try {
    await seedDatabase();
    await pool.query(`
      INSERT INTO audit_logs (id, action, category, details, user_email)
      VALUES ($1, 'FACTORY_RESET_AND_SEED', 'SYSTEM', 'Enterprise demonstration assets restored to all racks', 'bossyemzee@gmail.com')
    `, [`log-${Date.now().toString(36)}`]);
    res.json({ message: 'Database reset and populated with enterprise equipment seed!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. User Management & RBAC
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { name, email, role = 'DC_TECH', status = 'ACTIVE', permissions = [], department = 'Datacenter Operations' } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  try {
    const result = await pool.query(
      'INSERT INTO users (id, name, email, role, status, permissions, department) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, name.trim(), email.trim().toLowerCase(), role, status, permissions, department]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, action, category, details, user_email) VALUES ($1, $2, $3, $4, $5)',
      [`log-${Date.now().toString(36)}`, 'USER_CREATED', 'AUTH', `Created user ${name} (${email}) with role ${role}`, 'bossyemzee@gmail.com']
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A user with email ${email} already exists.` });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role, status, permissions, department } = req.body;
  try {
    const result = await pool.query(`
      UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        status = COALESCE($4, status),
        permissions = COALESCE($5, permissions),
        department = COALESCE($6, department),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [name, email, role, status, permissions, department, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, action, category, details, user_email) VALUES ($1, $2, $3, $4, $5)',
      [`log-${Date.now().toString(36)}`, 'USER_UPDATED', 'AUTH', `Updated permissions/role for user ${result.rows[0].email} to ${role}`, 'bossyemzee@gmail.com']
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (id, action, category, details, user_email) VALUES ($1, $2, $3, $4, $5)',
      [`log-${Date.now().toString(36)}`, 'USER_DELETED', 'AUTH', `Removed user ${result.rows[0].email}`, 'bossyemzee@gmail.com']
    );

    res.json({ message: 'User deleted successfully', user: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8.1 Super Admin Master Authentication & Password Protection
app.post('/api/auth/verify-super-admin', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Super Admin master password is required' });
  }

  try {
    const configRes = await pool.query(
      "SELECT value FROM system_config WHERE key = 'super_admin_secret_password' LIMIT 1"
    );
    const storedPassword = configRes.rows[0]?.value || 'Emzee@SuperAdmin2026!';

    if (password.trim() !== storedPassword.trim()) {
      // Log failed attempt in security audit log
      await pool.query(
        'INSERT INTO audit_logs (id, action, category, details, user_email) VALUES ($1, $2, $3, $4, $5)',
        [
          `log-${Date.now().toString(36)}`,
          'SUPER_ADMIN_AUTH_FAILED',
          'SECURITY',
          'Denied unauthorized attempt to authenticate as Super Admin (incorrect secret password)',
          'guest@infratrack.io'
        ]
      );
      return res.status(401).json({ error: 'Incorrect Super Admin secret password. Access denied.' });
    }

    // Log successful authentication
    await pool.query(
      'INSERT INTO audit_logs (id, action, category, details, user_email) VALUES ($1, $2, $3, $4, $5)',
      [
        `log-${Date.now().toString(36)}`,
        'SUPER_ADMIN_AUTH_SUCCESS',
        'AUTH',
        'Super Admin root identity verified with secret master password',
        'bossyemzee@gmail.com'
      ]
    );

    res.json({
      success: true,
      email: 'bossyemzee@gmail.com',
      name: 'EMZEE (Lead Admin)',
      role: 'SUPER_ADMIN',
      message: 'Super Admin master identity authenticated successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Super Admin Secret Password (requires current password)
app.put('/api/auth/super-admin-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'New secret password must be at least 6 characters' });
  }

  try {
    const configRes = await pool.query(
      "SELECT value FROM system_config WHERE key = 'super_admin_secret_password' LIMIT 1"
    );
    const storedPassword = configRes.rows[0]?.value || 'Emzee@SuperAdmin2026!';

    if (currentPassword.trim() !== storedPassword.trim()) {
      return res.status(401).json({ error: 'Current master password does not match' });
    }

    await pool.query(
      `INSERT INTO system_config (key, value, updated_at)
       VALUES ('super_admin_secret_password', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [newPassword.trim()]
    );

    await pool.query(
      'INSERT INTO audit_logs (id, action, category, details, user_email) VALUES ($1, $2, $3, $4, $5)',
      [
        `log-${Date.now().toString(36)}`,
        'SUPER_ADMIN_PASSWORD_ROTATED',
        'SECURITY',
        'Super Admin secret master password updated',
        'bossyemzee@gmail.com'
      ]
    );

    res.json({ success: true, message: 'Super Admin master password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/super-admin-hint', async (req, res) => {
  try {
    const configRes = await pool.query(
      "SELECT value FROM system_config WHERE key = 'super_admin_secret_password' LIMIT 1"
    );
    const current = configRes.rows[0]?.value || 'Emzee@SuperAdmin2026!';
    res.json({
      configured: true,
      isDefault: current === 'Emzee@SuperAdmin2026!'
    });
  } catch (error: any) {
    res.json({ configured: true, isDefault: true });
  }
});

// 9. Audit Logs
app.get('/api/audit-logs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Admin Purge Operations
app.post('/api/admin/purge-demo', async (req, res) => {
  const { mode = 'DEVICES_ONLY' } = req.body; // 'DEVICES_ONLY' or 'FULL_WIPE'
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clear cable connections & ports
    await client.query('DELETE FROM ports');

    // 2. Clear devices
    await client.query('DELETE FROM devices');

    if (mode === 'FULL_WIPE') {
      // Clear empty racks and sites
      await client.query('DELETE FROM racks');
      await client.query('DELETE FROM sites');
    }

    // Record audit event
    const logId = `log-${Date.now().toString(36)}`;
    await client.query(`
      INSERT INTO audit_logs (id, action, category, details, user_email)
      VALUES ($1, 'PURGE_DEMO_DATA', 'SYSTEM', 'Purged all demo hardware assets and patch cabling matrix', 'bossyemzee@gmail.com')
    `, [logId]);

    await client.query('COMMIT');
    res.json({
      message: mode === 'FULL_WIPE' ? 'Complete infrastructure purge executed.' : 'All demo hardware and cabling purged. Facilities and Racks preserved for clean production intake.',
      mode
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// 11. System Statistics & Database Telemetry
app.get('/api/admin/system-stats', async (req, res) => {
  try {
    const [sitesCount, racksCount, devicesCount, portsCount, vlansCount, usersCount, logsCount] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM sites'),
      pool.query('SELECT COUNT(*) as count FROM racks'),
      pool.query('SELECT COUNT(*) as count FROM devices'),
      pool.query('SELECT COUNT(*) as count FROM ports'),
      pool.query('SELECT COUNT(*) as count FROM vlans'),
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM audit_logs')
    ]);

    const activeConnections = await pool.query("SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'");

    res.json({
      counts: {
        sites: parseInt(sitesCount.rows[0].count),
        racks: parseInt(racksCount.rows[0].count),
        devices: parseInt(devicesCount.rows[0].count),
        ports: parseInt(portsCount.rows[0].count),
        vlans: parseInt(vlansCount.rows[0].count),
        users: parseInt(usersCount.rows[0].count),
        auditLogs: parseInt(logsCount.rows[0].count)
      },
      postgresPool: {
        activeQueries: parseInt(activeConnections.rows[0].count),
        maxPoolSize: 10
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vite & Static Server Integration
async function startServer() {
  await initDatabase();

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[InfraTrack Server] Ready and listening on port ${PORT} (http://0.0.0.0:${PORT})`);
  });
}

// Only start the HTTP listener if not running in a serverless environment (e.g. Vercel)
if (process.env.VERCEL !== '1' && !process.env.NOW_REGION) {
  startServer().catch((err) => {
    console.error('[InfraTrack Server] Failed to start:', err);
    process.exit(1);
  });
}

export default app;
