import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Cpu,
  Radio,
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  BatteryWarning,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  X,
  Link2,
  Unlink,
  Search,
  Sliders,
  PowerOff,
  User,
  Clock,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { sseClient } from '../../services/sseClient';
import { usePatients } from '../../context/PatientContext';

export const Devices = () => {
  const { patients, refreshPatients } = usePatients();

  // State
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    deviceCode: '',
    status: 'ACTIVE',
    batteryLevel: 98,
  });
  const [registerError, setRegisterError] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);

  const [assignModalDevice, setAssignModalDevice] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [assignError, setAssignError] = useState(null);
  const [assignLoading, setAssignLoading] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getDevices();
      if (res && res.success) {
        setDevices(res.data);
        setError(null);
      } else {
        setError(res?.message || 'Failed to load devices');
      }
    } catch (err) {
      console.error('[Devices] Error fetching devices:', err);
      setError(err.message || 'Network error fetching devices');
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen to SSE updates and heartbeats
  useEffect(() => {
    fetchDevices();

    // Reconcile on SSE reconnection
    const unsubReconnect = sseClient.addReconnectListener(() => {
      console.log('[Devices] SSE reconnection detected, refreshing devices...');
      fetchDevices();
    });

    // Listen for device_updated broadcast
    const unsubDevice = sseClient.on('device_updated', (data) => {
      console.log('[Devices] SSE device_updated event received:', data);
      fetchDevices();
      refreshPatients();
    });

    // Listen for live sensor_event to refresh device heartbeat
    const unsubSensor = sseClient.on('sensor_event', (eventData) => {
      if (eventData?.deviceId) {
        setDevices((prevDevices) =>
          prevDevices.map((d) =>
            d.deviceCode === eventData.deviceId
              ? { ...d, lastHeartbeat: eventData.timestamp || new Date() }
              : d
          )
        );
      }
    });

    return () => {
      unsubReconnect();
      unsubDevice();
      unsubSensor();
    };
  }, [fetchDevices, refreshPatients]);

  // Overview Metrics
  const overview = useMemo(() => {
    const total = devices.length;
    let active = 0;
    let offline = 0;
    let simulating = 0;
    let lowBattery = 0;

    for (const d of devices) {
      if (d.status === 'ACTIVE') active += 1;
      else if (d.status === 'OFFLINE') offline += 1;
      else if (d.status === 'SIMULATING') simulating += 1;

      if (typeof d.batteryLevel === 'number' && d.batteryLevel < 20) {
        lowBattery += 1;
      }
    }

    return { total, active, offline, simulating, lowBattery };
  }, [devices]);

  // Available patients for assignment: admitted patients with no device
  const availablePatients = useMemo(() => {
    return patients.filter((p) => p.status === 'ADMITTED' && !p.assignedDeviceId);
  }, [patients]);

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      // Status filter
      if (filterStatus === 'ACTIVE' && d.status !== 'ACTIVE') return false;
      if (filterStatus === 'OFFLINE' && d.status !== 'OFFLINE') return false;
      if (filterStatus === 'SIMULATING' && d.status !== 'SIMULATING') return false;
      if (filterStatus === 'LOW_BATTERY' && (typeof d.batteryLevel !== 'number' || d.batteryLevel >= 20)) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const codeMatch = d.deviceCode?.toLowerCase().includes(query);
        const patientMatch = d.assignedPatientId?.name?.toLowerCase().includes(query);
        const roomMatch = d.assignedPatientId?.roomNumber?.toLowerCase().includes(query);
        return codeMatch || patientMatch || roomMatch;
      }

      return true;
    });
  }, [devices, filterStatus, searchQuery]);

  // Format timestamp helper
  const formatHeartbeat = (dateStr) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Never';
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Battery Indicator Helper Component
  const renderBatteryHealth = (level) => {
    const pct = typeof level === 'number' ? Math.max(0, Math.min(100, level)) : 0;
    const isLow = pct < 20;
    const isMedium = pct >= 20 && pct < 50;

    const color = isLow ? '#ef4444' : isMedium ? '#f59e0b' : '#10b981';
    const Icon = isLow ? BatteryWarning : pct > 75 ? BatteryFull : pct > 35 ? BatteryMedium : BatteryLow;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon size={16} color={color} />
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: isLow ? '#f87171' : 'var(--text-primary)',
              }}
            >
              {pct}%
            </span>
          </div>
          {isLow && (
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                letterSpacing: '0.02em',
              }}
            >
              LOW
            </span>
          )}
        </div>
        <div
          style={{
            height: '6px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: isLow
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : isMedium
                ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                : 'linear-gradient(90deg, #10b981, #059669)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    );
  };

  // Status Badge Component
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.03em',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
              }}
              className="animate-pulse-emerald"
            />
            ACTIVE
          </span>
        );
      case 'SIMULATING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(14, 165, 233, 0.15)',
              border: '1px solid rgba(14, 165, 233, 0.35)',
              color: '#38bdf8',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.03em',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9' }} />
            SIMULATING
          </span>
        );
      case 'OFFLINE':
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(148, 163, 184, 0.12)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8' }} />
            OFFLINE
          </span>
        );
    }
  };

  // Handle Device Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError(null);

    const code = registerForm.deviceCode.trim().toUpperCase();
    if (!code) {
      setRegisterError('Device code is required.');
      return;
    }

    const battery = Number(registerForm.batteryLevel);
    if (isNaN(battery) || battery < 0 || battery > 100) {
      setRegisterError('Battery percentage must be a number between 0 and 100.');
      return;
    }

    try {
      setRegisterLoading(true);
      const res = await apiClient.registerDevice({
        deviceCode: code,
        status: registerForm.status,
        batteryLevel: battery,
      });

      if (res && res.success) {
        setIsRegisterOpen(false);
        setRegisterForm({ deviceCode: '', status: 'ACTIVE', batteryLevel: 98 });
        await fetchDevices();
      } else {
        setRegisterError(res?.message || 'Failed to register device.');
      }
    } catch (err) {
      console.error('[Devices] Registration error:', err);
      setRegisterError(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setRegisterLoading(false);
    }
  };

  // Open Assign Modal
  const openAssignModal = (device) => {
    setAssignModalDevice(device);
    setSelectedPatientId('');
    setAssignError(null);
  };

  // Handle Assign Device
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignModalDevice) return;

    if (!selectedPatientId) {
      setAssignError('Please select a patient to assign this device to.');
      return;
    }

    try {
      setAssignLoading(true);
      setAssignError(null);
      const res = await apiClient.assignDevice(assignModalDevice._id, selectedPatientId);

      if (res && res.success) {
        setAssignModalDevice(null);
        setSelectedPatientId('');
        await fetchDevices();
        await refreshPatients();
      } else {
        setAssignError(res?.message || 'Failed to assign device.');
      }
    } catch (err) {
      console.error('[Devices] Assignment error:', err);
      setAssignError(err.message || 'An unexpected error occurred during assignment.');
    } finally {
      setAssignLoading(false);
    }
  };

  // Handle Unassign Device
  const handleUnassign = async (device) => {
    const patientName = device.assignedPatientId?.name || 'the assigned patient';
    const confirm = window.confirm(
      `Are you sure you want to unassign device "${device.deviceCode}" from ${patientName}?`
    );
    if (!confirm) return;

    try {
      setActionLoadingId(device._id);
      const res = await apiClient.unassignDevice(device._id);
      if (res && res.success) {
        await fetchDevices();
        await refreshPatients();
      } else {
        alert(res?.message || 'Failed to unassign device.');
      }
    } catch (err) {
      console.error('[Devices] Unassign error:', err);
      alert(err.message || 'Error unassigning device.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              letterSpacing: '-0.01em',
            }}
          >
            <Cpu color="#0ea5e9" size={28} />
            IoT Wearable Device Management
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Register, monitor telemetry tags, observe real-time battery levels, and manage patient-device pairings.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchDevices()}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh device roster"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setRegisterError(null);
              setIsRegisterOpen(true);
            }}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Register Device</span>
          </button>
        </div>
      </div>

      {/* 1. Device Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Total Devices */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(14, 165, 233, 0.15)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Cpu size={22} color="#0ea5e9" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              TOTAL REGISTERED
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px' }}>
              {overview.total}
            </div>
          </div>
        </div>

        {/* Active Devices */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={22} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              ACTIVE ONLINE
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
              {overview.active}
            </div>
          </div>
        </div>

        {/* Simulating Devices */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(14, 165, 233, 0.15)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Radio size={22} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              SIMULATING
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
              {overview.simulating}
            </div>
          </div>
        </div>

        {/* Offline Devices */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(148, 163, 184, 0.12)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PowerOff size={22} color="#94a3b8" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              OFFLINE
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '2px' }}>
              {overview.offline}
            </div>
          </div>
        </div>

        {/* Low Battery Devices */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            borderColor: overview.lowBattery > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)',
            background: overview.lowBattery > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(14, 21, 38, 0.75)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: overview.lowBattery > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.15)',
              border: overview.lowBattery > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BatteryWarning size={22} color={overview.lowBattery > 0 ? '#ef4444' : '#f59e0b'} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              LOW BATTERY (&lt;20%)
            </div>
            <div
              style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: overview.lowBattery > 0 ? '#ef4444' : 'var(--text-secondary)',
                marginTop: '2px',
              }}
            >
              {overview.lowBattery}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '400px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search by device code, patient, room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px', height: '38px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            STATUS:
          </span>
          {[
            { id: 'ALL', label: 'All Devices' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'OFFLINE', label: 'Offline' },
            { id: 'SIMULATING', label: 'Simulating' },
            { id: 'LOW_BATTERY', label: 'Low Battery' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              style={{
                background: filterStatus === tab.id ? 'var(--bg-surface-hover)' : 'transparent',
                color: filterStatus === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                border:
                  filterStatus === tab.id
                    ? '1px solid rgba(14, 165, 233, 0.4)'
                    : '1px solid var(--border-subtle)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: filterStatus === tab.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Device Inventory Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#f87171' }}>
            <AlertTriangle size={32} style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontWeight: 600 }}>Database or Backend Communication Error</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {error}
            </p>
            <button
              onClick={fetchDevices}
              className="btn btn-sm btn-primary"
              style={{ marginTop: '14px' }}
            >
              Retry
            </button>
          </div>
        ) : loading && devices.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <p>Loading IoT device inventory...</p>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Cpu size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <p style={{ fontWeight: 600 }}>No devices match the selected criteria.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              {searchQuery || filterStatus !== 'ALL'
                ? 'Try clearing the search or status filters.'
                : 'Click "Register Device" above to add the first wearable tag.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <th
                    style={{
                      padding: '14px 20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    DEVICE CODE
                  </th>
                  <th
                    style={{
                      padding: '14px 20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    ASSIGNED PATIENT
                  </th>
                  <th
                    style={{
                      padding: '14px 20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    LOCATION (ROOM / BED)
                  </th>
                  <th
                    style={{
                      padding: '14px 20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    STATUS
                  </th>
                  <th
                    style={{
                      padding: '14px 20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    BATTERY HEALTH
                  </th>
                  <th
                    style={{
                      padding: '14px 20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    LAST HEARTBEAT
                  </th>
                  <th
                    style={{
                      padding: '14px 20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                      textAlign: 'right',
                    }}
                  >
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((device) => {
                  const patient = device.assignedPatientId;
                  const isAssigned = Boolean(patient);
                  const isActionLoading = actionLoadingId === device._id;

                  return (
                    <tr
                      key={device._id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'var(--transition-smooth)',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = 'transparent')
                      }
                    >
                      {/* Device Code */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Cpu size={16} color="var(--color-brand)" />
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {device.deviceCode}
                          </span>
                        </div>
                      </td>

                      {/* Assigned Patient */}
                      <td style={{ padding: '16px 20px' }}>
                        {isAssigned ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <User size={15} color="var(--color-brand)" />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                {patient.name}
                              </div>
                              {patient.movementStatus && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  State: {patient.movementStatus}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              fontStyle: 'italic',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(255, 255, 255, 0.04)',
                            }}
                          >
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Room and Bed */}
                      <td style={{ padding: '16px 20px' }}>
                        {isAssigned ? (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.85rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Room {patient.roomNumber} &bull; {patient.bedNumber}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            &mdash;
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 20px' }}>
                        {renderStatusBadge(device.status)}
                      </td>

                      {/* Battery Health */}
                      <td style={{ padding: '16px 20px' }}>
                        {renderBatteryHealth(device.batteryLevel)}
                      </td>

                      {/* Last Heartbeat */}
                      <td style={{ padding: '16px 20px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                          }}
                          title={device.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleString() : 'Never'}
                        >
                          <Clock size={14} color="var(--text-muted)" />
                          <span>{formatHeartbeat(device.lastHeartbeat)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        {isAssigned ? (
                          <button
                            onClick={() => handleUnassign(device)}
                            disabled={isActionLoading}
                            className="btn btn-secondary btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.75rem',
                            }}
                            title={`Unassign from ${patient.name}`}
                          >
                            <Unlink size={13} color="#f87171" />
                            <span>{isActionLoading ? 'Unpairing...' : 'Unassign'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => openAssignModal(device)}
                            className="btn btn-primary btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.75rem',
                            }}
                            title="Assign to an admitted patient"
                          >
                            <Link2 size={13} />
                            <span>Assign Patient</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Device Registration Modal */}
      {isRegisterOpen && (
        <div className="modal-overlay" onClick={() => setIsRegisterOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu color="var(--color-brand)" size={22} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Register New Wearable Tag</h3>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {registerError && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: '0.85rem',
                  }}
                >
                  {registerError}
                </div>
              )}

              {/* Device Code */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  DEVICE CODE / SERIAL TAG *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. SIM-TAG-07 or DEV-WARD-108"
                  value={registerForm.deviceCode}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, deviceCode: e.target.value })
                  }
                  style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Must be unique across the hospital IoT telemetry network.
                </span>
              </div>

              {/* Initial Status */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  INITIAL STATUS
                </label>
                <select
                  className="form-input"
                  value={registerForm.status}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, status: e.target.value })
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <option value="ACTIVE">ACTIVE (Ready for live tracking)</option>
                  <option value="SIMULATING">SIMULATING (Synthetic test mode)</option>
                  <option value="OFFLINE">OFFLINE (Standby / In storage)</option>
                </select>
              </div>

              {/* Initial Battery Level */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  INITIAL BATTERY PERCENTAGE (0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-input"
                  value={registerForm.batteryLevel}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, batteryLevel: e.target.value })
                  }
                />
              </div>

              {/* Form Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '12px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="btn btn-secondary"
                  disabled={registerLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={registerLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {registerLoading && <RefreshCw size={14} className="animate-spin" />}
                  <span>Register Device</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Patient-Device Assignment Modal */}
      {assignModalDevice && (
        <div className="modal-overlay" onClick={() => setAssignModalDevice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Link2 color="var(--color-brand)" size={22} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                  Assign Wearable Tag: {assignModalDevice.deviceCode}
                </h3>
              </div>
              <button
                onClick={() => setAssignModalDevice(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {assignError && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: '0.85rem',
                  }}
                >
                  {assignError}
                </div>
              )}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '8px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  SELECT ADMITTED PATIENT
                </label>

                {availablePatients.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-subtle)',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                    }}
                  >
                    All admitted patients in Ward 3B currently have active wearable devices assigned.
                  </div>
                ) : (
                  <select
                    className="form-input"
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    required
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">-- Choose Patient --</option>
                    {availablePatients.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} &bull; Room {p.roomNumber} ({p.bedNumber})
                      </option>
                    ))}
                  </select>
                )}
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    marginTop: '6px',
                    display: 'block',
                  }}
                >
                  Each patient can have at most one active wearable tag.
                </span>
              </div>

              {/* Form Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '12px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setAssignModalDevice(null)}
                  className="btn btn-secondary"
                  disabled={assignLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={assignLoading || availablePatients.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {assignLoading && <RefreshCw size={14} className="animate-spin" />}
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const DevicesView = Devices;
export default Devices;
