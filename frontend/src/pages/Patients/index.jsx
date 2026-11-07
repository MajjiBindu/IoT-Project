import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Edit,
  UserCheck,
  Cpu,
  UserX,
  Eye,
  AlertTriangle,
  Activity,
  MapPin,
  CheckCircle,
  X,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { usePatients } from '../../context/PatientContext';
import { useAuth } from '../../context/AuthContext';
import { useAlerts } from '../../context/AlertContext';
import { apiClient } from '../../services/apiClient';
import { StatusBadge } from '../../components/StatusBadge';

export const Patients = () => {
  const { patients, loading, error, refreshPatients } = usePatients();
  const { user, isAdmin, isNurse } = useAuth();
  const { activeAlerts } = useAlerts();

  // Filter and Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [wardFilter, setWardFilter] = useState('ALL');
  const [nurseFilter, setNurseFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [movementFilter, setMovementFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ADMITTED');
  const [onlyMyPatients, setOnlyMyPatients] = useState(false);

  // Auxiliary data for dropdowns
  const [nurses, setNurses] = useState([]);
  const [devices, setDevices] = useState([]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const [nurseAssignPatient, setNurseAssignPatient] = useState(null);
  const [deviceAssignPatient, setDeviceAssignPatient] = useState(null);
  const [dischargePatient, setDischargePatient] = useState(null);
  const [detailsPatient, setDetailsPatient] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'UNSPECIFIED',
    wardId: 'WARD-3B',
    floor: 'Floor 3',
    roomNumber: '101',
    bedNumber: 'Bed-A',
    fallRiskLevel: 'MEDIUM',
    notes: '',
    assignedNurseId: '',
    assignedDeviceId: '',
  });

  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [selectedDeviceCode, setSelectedDeviceCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Load nurses and devices for assignments
  useEffect(() => {
    async function loadAuxData() {
      try {
        const [staffRes, devRes] = await Promise.all([
          apiClient.getStaff().catch(() => ({ success: false, data: [] })),
          apiClient.getDevices().catch(() => ({ success: false, data: [] })),
        ]);
        if (staffRes.success && Array.isArray(staffRes.data)) {
          setNurses(staffRes.data.filter((s) => s.role === 'NURSE' && s.status === 'ACTIVE'));
        }
        if (devRes.success && Array.isArray(devRes.data)) {
          setDevices(devRes.data);
        }
      } catch (err) {
        console.warn('[Patients] Could not load staff/devices:', err);
      }
    }
    loadAuxData();
  }, []);

  // Filtered patients calculation
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // Status filter
      if (statusFilter !== 'ALL' && p.status !== statusFilter) {
        return false;
      }

      // Nurse role quick filter
      if (onlyMyPatients && user?._id) {
        const nurseId = p.assignedNurseId?._id || p.assignedNurseId;
        if (nurseId !== user._id) return false;
      }

      // Ward filter
      if (wardFilter !== 'ALL' && p.wardId !== wardFilter) {
        return false;
      }

      // Specific nurse filter
      if (nurseFilter !== 'ALL') {
        const nurseId = p.assignedNurseId?._id || p.assignedNurseId;
        if (nurseFilter === 'UNASSIGNED') {
          if (nurseId) return false;
        } else if (nurseId !== nurseFilter) {
          return false;
        }
      }

      // Fall risk filter
      if (riskFilter !== 'ALL' && p.fallRiskLevel !== riskFilter) {
        return false;
      }

      // Movement status filter
      if (movementFilter !== 'ALL' && p.movementStatus !== movementFilter) {
        return false;
      }

      // Search Query (Name or ID or Room)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = p.name?.toLowerCase().includes(q);
        const idMatch = p._id?.toLowerCase().includes(q);
        const roomMatch = p.roomNumber?.toLowerCase().includes(q);
        const deviceMatch = p.assignedDeviceId?.toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !roomMatch && !deviceMatch) {
          return false;
        }
      }

      return true;
    });
  }, [patients, statusFilter, onlyMyPatients, user, wardFilter, nurseFilter, riskFilter, movementFilter, searchQuery]);

  // Wards list
  const availableWards = useMemo(() => {
    const set = new Set(patients.map((p) => p.wardId).filter(Boolean));
    return ['WARD-3B', ...Array.from(set).filter((w) => w !== 'WARD-3B')];
  }, [patients]);

  // Helper to get active alert for a patient
  const getPatientAlert = (patientId) => {
    return activeAlerts.find((a) => (a.patientId?._id || a.patientId) === patientId);
  };

  // Helper for Nurse Name
  const getNurseName = (patient) => {
    if (!patient.assignedNurseId) return 'Unassigned';
    if (typeof patient.assignedNurseId === 'object' && patient.assignedNurseId.fullName) {
      return patient.assignedNurseId.fullName;
    }
    const found = nurses.find((n) => n._id === patient.assignedNurseId);
    return found ? found.fullName : 'Nurse Assigned';
  };

  // Handlers for Admin actions
  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      age: '',
      gender: 'UNSPECIFIED',
      wardId: 'WARD-3B',
      floor: 'Floor 3',
      roomNumber: '101',
      bedNumber: 'Bed-A',
      fallRiskLevel: 'MEDIUM',
      notes: '',
      assignedNurseId: '',
      assignedDeviceId: '',
    });
    setActionError(null);
    setIsAddModalOpen(true);
  };

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      const payload = {
        ...formData,
        age: formData.age ? parseInt(formData.age, 10) : undefined,
        assignedNurseId: formData.assignedNurseId || null,
        assignedDeviceId: formData.assignedDeviceId || null,
      };
      const res = await apiClient.createPatient(payload);
      if (res.success) {
        setIsAddModalOpen(false);
        refreshPatients();
      } else {
        setActionError(res.message || 'Failed to register patient');
      }
    } catch (err) {
      setActionError(err.message || 'Error registering patient');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditModal = (p) => {
    setEditPatient(p);
    setFormData({
      name: p.name || '',
      age: p.age || '',
      gender: p.gender || 'UNSPECIFIED',
      wardId: p.wardId || 'WARD-3B',
      floor: p.floor || 'Floor 3',
      roomNumber: p.roomNumber || '',
      bedNumber: p.bedNumber || '',
      fallRiskLevel: p.fallRiskLevel || 'MEDIUM',
      notes: p.notes || '',
      assignedNurseId: p.assignedNurseId?._id || p.assignedNurseId || '',
      assignedDeviceId: p.assignedDeviceId || '',
    });
    setActionError(null);
  };

  const handleUpdatePatient = async (e) => {
    e.preventDefault();
    if (!editPatient) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const payload = {
        ...formData,
        age: formData.age ? parseInt(formData.age, 10) : undefined,
        assignedNurseId: formData.assignedNurseId || null,
        assignedDeviceId: formData.assignedDeviceId || null,
      };
      const res = await apiClient.updatePatient(editPatient._id, payload);
      if (res.success) {
        setEditPatient(null);
        refreshPatients();
      } else {
        setActionError(res.message || 'Failed to update patient');
      }
    } catch (err) {
      setActionError(err.message || 'Error updating patient');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignNurseSubmit = async (e) => {
    e.preventDefault();
    if (!nurseAssignPatient) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await apiClient.assignNurse(nurseAssignPatient._id, selectedNurseId || null);
      if (res.success) {
        setNurseAssignPatient(null);
        refreshPatients();
      } else {
        setActionError(res.message || 'Failed to assign nurse');
      }
    } catch (err) {
      setActionError(err.message || 'Error assigning nurse');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignDeviceSubmit = async (e) => {
    e.preventDefault();
    if (!deviceAssignPatient) return;
    setActionLoading(true);
    setActionError(null);
    try {
      // Find device _id from deviceCode
      const dev = devices.find((d) => d.deviceCode === selectedDeviceCode);
      if (selectedDeviceCode && dev) {
        const res = await apiClient.assignDevice(dev._id, deviceAssignPatient._id);
        if (res.success) {
          setDeviceAssignPatient(null);
          refreshPatients();
        } else {
          setActionError(res.message || 'Failed to assign device');
        }
      } else if (!selectedDeviceCode) {
        // Unassign existing device if any
        if (deviceAssignPatient.assignedDeviceId) {
          const oldDev = devices.find((d) => d.deviceCode === deviceAssignPatient.assignedDeviceId);
          if (oldDev) {
            await apiClient.unassignDevice(oldDev._id);
          }
        }
        await apiClient.updatePatient(deviceAssignPatient._id, { assignedDeviceId: null });
        setDeviceAssignPatient(null);
        refreshPatients();
      }
    } catch (err) {
      setActionError(err.message || 'Error updating device assignment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDischargeConfirm = async () => {
    if (!dischargePatient) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await apiClient.dischargePatient(dischargePatient._id);
      if (res.success) {
        setDischargePatient(null);
        refreshPatients();
      } else {
        setActionError(res.message || 'Failed to discharge patient');
      }
    } catch (err) {
      setActionError(err.message || 'Error discharging patient');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper for fall risk badge
  const renderRiskBadge = (risk) => {
    const level = (risk || 'LOW').toUpperCase();
    let bg = 'rgba(16, 185, 129, 0.15)';
    let color = '#34d399';
    let border = '1px solid rgba(16, 185, 129, 0.3)';
    if (level === 'HIGH') {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#f87171';
      border = '1px solid rgba(239, 68, 68, 0.3)';
    } else if (level === 'MEDIUM') {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#fbbf24';
      border = '1px solid rgba(245, 158, 11, 0.3)';
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 9px',
          borderRadius: '999px',
          fontSize: '0.72rem',
          fontWeight: 700,
          background: bg,
          color,
          border,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {level === 'HIGH' && <AlertTriangle size={12} />}
        {level} RISK
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header with Title and Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users color="#0ea5e9" size={28} />
            Patient Clinical Roster &amp; Mobility Tag Directory
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Hospital-wide inpatient mobility tracking, fall-risk stratification, room assignments, and assigned IoT sensors.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={refreshPatients}
            className="btn btn-sm btn-secondary"
            title="Refresh Roster"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="btn btn-sm btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
            >
              <Plus size={16} /> Register Patient
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          background: 'var(--bg-surface-elevated)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search by patient name, ID, room, or device..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
            {searchQuery && (
              <X
                size={14}
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              />
            )}
          </div>

          {/* Quick toggle for Nurses */}
          {isNurse && (
            <button
              type="button"
              onClick={() => setOnlyMyPatients((prev) => !prev)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: onlyMyPatients ? '1px solid #0ea5e9' : '1px solid var(--border-subtle)',
                background: onlyMyPatients ? 'rgba(14, 165, 233, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                color: onlyMyPatients ? '#38bdf8' : 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <UserCheck size={14} /> My Assigned Patients Only
            </button>
          )}

          {/* Fall Risk Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Risk:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="ALL">All Risk Levels</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>
          </div>

          {/* Movement Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Movement:</span>
            <select
              value={movementFilter}
              onChange={(e) => setMovementFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="ALL">All States</option>
              <option value="STATIONARY">Stationary</option>
              <option value="WALKING">Walking</option>
              <option value="FALL_IMPACT">Fall Impact</option>
              <option value="FREE_FALL">Free Fall</option>
            </select>
          </div>

          {/* Ward Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ward:</span>
            <select
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="ALL">All Wards</option>
              {availableWards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Admission Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="ADMITTED">Admitted Only</option>
              <option value="DISCHARGED">Discharged Only</option>
              <option value="ALL">All Records</option>
            </select>
          </div>
        </div>

        {/* Counter readout */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>
            Showing <strong>{filteredPatients.length}</strong> of {patients.length} total patient records
          </span>
          {(searchQuery || wardFilter !== 'ALL' || riskFilter !== 'ALL' || movementFilter !== 'ALL' || onlyMyPatients) && (
            <span
              onClick={() => {
                setSearchQuery('');
                setWardFilter('ALL');
                setNurseFilter('ALL');
                setRiskFilter('ALL');
                setMovementFilter('ALL');
                setOnlyMyPatients(false);
              }}
              style={{ color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Reset Filters
            </span>
          )}
        </div>
      </div>

      {/* Main Table / Grid Content */}
      <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
        {error ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#f87171' }}>
            <AlertTriangle size={36} style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>Patient Database Connection Unavailable</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{error}</p>
            <button onClick={refreshPatients} className="btn btn-sm btn-primary" style={{ marginTop: '16px' }}>
              Retry Reconnect
            </button>
          </div>
        ) : loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity className="animate-spin" size={28} style={{ margin: '0 auto 12px auto' }} />
            <p>Loading clinical patient roster and IoT telemetry states...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={36} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>No matching patient records found.</p>
            <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              Adjust search keywords or clear your active filters.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  <th style={{ padding: '14px 18px' }}>Patient</th>
                  <th style={{ padding: '14px 14px' }}>Location</th>
                  <th style={{ padding: '14px 14px' }}>Fall Risk</th>
                  <th style={{ padding: '14px 14px' }}>Assigned Nurse</th>
                  <th style={{ padding: '14px 14px' }}>IoT Device</th>
                  <th style={{ padding: '14px 14px' }}>Movement Status</th>
                  <th style={{ padding: '14px 14px' }}>Safety Alert</th>
                  <th style={{ padding: '14px 14px' }}>Last Activity</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p) => {
                  const alert = getPatientAlert(p._id);
                  const isHighAlert = alert && alert.severity === 'CRITICAL';
                  const isWalking = p.movementStatus === 'WALKING';

                  return (
                    <tr
                      key={p._id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: isHighAlert
                          ? 'rgba(239, 68, 68, 0.08)'
                          : isWalking
                          ? 'rgba(14, 165, 233, 0.03)'
                          : 'transparent',
                        transition: 'background 0.2s',
                      }}
                    >
                      {/* Patient Name & Demographics */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                            {p.name}
                          </span>
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {p.age ? `${p.age} yrs` : 'Age N/A'} &bull; {p.gender || 'Demographics N/A'} &bull;{' '}
                            <span style={{ fontFamily: 'var(--font-mono)' }}>ID: {p._id.slice(-6).toUpperCase()}</span>
                          </span>
                        </div>
                      </td>

                      {/* Location: Ward / Floor / Room / Bed */}
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} /> Rm {p.roomNumber} &bull; {p.bedNumber}
                          </span>
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                            {p.wardId} &bull; {p.floor || 'Floor 3'}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            Status: <em>{p.locationStatus || 'Assigned'}</em>
                          </span>
                        </div>
                      </td>

                      {/* Fall Risk Level */}
                      <td style={{ padding: '14px 14px' }}>{renderRiskBadge(p.fallRiskLevel)}</td>

                      {/* Assigned Nurse */}
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserCheck size={14} color="#0ea5e9" />
                          <span style={{ fontWeight: 600, color: p.assignedNurseId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {getNurseName(p)}
                          </span>
                        </div>
                      </td>

                      {/* Wearable Device */}
                      <td style={{ padding: '14px 14px' }}>
                        {p.assignedDeviceId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Cpu size={14} color="#10b981" />
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#34d399', fontSize: '0.8rem' }}>
                              {p.assignedDeviceId}
                            </span>
                            {p.assignedDeviceId === 'ARDUINO-PIEZO-01' && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(16, 185, 129, 0.2)',
                                  color: '#10b981',
                                  fontWeight: 700,
                                }}
                              >
                                HW
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No device paired</span>
                        )}
                      </td>

                      {/* Current Movement Status */}
                      <td style={{ padding: '14px 14px' }}>
                        <StatusBadge status={p.movementStatus} type="movement" />
                        {p.piezoActivityStatus && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Piezo: <strong style={{ color: p.piezoActivityStatus === 'ACTIVE' ? '#34d399' : '#94a3b8' }}>{p.piezoActivityStatus}</strong>
                          </div>
                        )}
                      </td>

                      {/* Latest Alert Status */}
                      <td style={{ padding: '14px 14px' }}>
                        {alert ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: alert.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: alert.severity === 'CRITICAL' ? '#f87171' : '#fbbf24',
                              border: alert.severity === 'CRITICAL' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                            }}
                          >
                            <AlertTriangle size={12} />
                            {alert.type} ({alert.status})
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                              color: '#34d399',
                            }}
                          >
                            <CheckCircle size={13} /> Normal
                          </span>
                        )}
                      </td>

                      {/* Last Activity */}
                      <td style={{ padding: '14px 14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {p.lastMovementUpdate
                          ? new Date(p.lastMovementUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : 'Recent'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* View details button (for both Admin & Nurse) */}
                          <button
                            onClick={() => setDetailsPatient(p)}
                            className="btn btn-xs btn-secondary"
                            title="View Patient Safety Details"
                            style={{ padding: '5px 8px' }}
                          >
                            <Eye size={13} />
                          </button>

                          {/* Admin actions */}
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(p)}
                                className="btn btn-xs btn-secondary"
                                title="Edit Patient Details"
                                style={{ padding: '5px 8px' }}
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  setNurseAssignPatient(p);
                                  setSelectedNurseId(p.assignedNurseId?._id || p.assignedNurseId || '');
                                }}
                                className="btn btn-xs btn-secondary"
                                title="Assign Nurse"
                                style={{ padding: '5px 8px' }}
                              >
                                <UserCheck size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  setDeviceAssignPatient(p);
                                  setSelectedDeviceCode(p.assignedDeviceId || '');
                                }}
                                className="btn btn-xs btn-secondary"
                                title="Assign Sensor Device"
                                style={{ padding: '5px 8px' }}
                              >
                                <Cpu size={13} />
                              </button>
                              {p.status !== 'DISCHARGED' && (
                                <button
                                  onClick={() => setDischargePatient(p)}
                                  className="btn btn-xs btn-danger"
                                  title="Discharge Patient"
                                  style={{ padding: '5px 8px' }}
                                >
                                  <UserX size={13} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD NEW PATIENT (ADMIN) */}
      {isAddModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-container" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus color="#0ea5e9" size={20} /> Register Inpatient
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', marginBottom: '16px', fontSize: '0.85rem' }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreatePatient} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  Full Patient Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Age</label>
                  <input
                    type="number"
                    min="1"
                    max="125"
                    placeholder="e.g. 72"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  >
                    <option value="UNSPECIFIED">Unspecified</option>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Ward</label>
                  <input
                    type="text"
                    required
                    value={formData.wardId}
                    onChange={(e) => setFormData({ ...formData, wardId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Floor</label>
                  <input
                    type="text"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Room / Bed</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="text"
                      placeholder="Rm"
                      required
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                      style={{ width: '50%', padding: '9px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="text"
                      placeholder="Bed"
                      required
                      value={formData.bedNumber}
                      onChange={(e) => setFormData({ ...formData, bedNumber: e.target.value })}
                      style={{ width: '50%', padding: '9px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Fall Risk Level</label>
                  <select
                    value={formData.fallRiskLevel}
                    onChange={(e) => setFormData({ ...formData, fallRiskLevel: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  >
                    <option value="LOW">Low Risk</option>
                    <option value="MEDIUM">Medium Risk</option>
                    <option value="HIGH">High Risk</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Assign Nurse</label>
                  <select
                    value={formData.assignedNurseId}
                    onChange={(e) => setFormData({ ...formData, assignedNurseId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Unassigned</option>
                    {nurses.map((n) => (
                      <option key={n._id} value={n._id}>
                        {n.fullName} ({n.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Assign Wearable Device</label>
                <select
                  value={formData.assignedDeviceId}
                  onChange={(e) => setFormData({ ...formData, assignedDeviceId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                >
                  <option value="">No device / pair later</option>
                  {devices.map((d) => (
                    <option key={d._id} value={d.deviceCode}>
                      {d.deviceCode} (Batt: {d.batteryLevel || 100}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Clinical Care Notes</label>
                <textarea
                  rows={2}
                  placeholder="Mobility instructions, recovery goals, fall precautions..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-sm btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Saving...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT PATIENT (ADMIN) */}
      {editPatient && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-container" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit color="#0ea5e9" size={20} /> Edit Patient: {editPatient.name}
              </h3>
              <button onClick={() => setEditPatient(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', marginBottom: '16px', fontSize: '0.85rem' }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleUpdatePatient} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  Full Patient Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Age</label>
                  <input
                    type="number"
                    min="1"
                    max="125"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  >
                    <option value="UNSPECIFIED">Unspecified</option>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Ward</label>
                  <input
                    type="text"
                    required
                    value={formData.wardId}
                    onChange={(e) => setFormData({ ...formData, wardId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Floor</label>
                  <input
                    type="text"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Room / Bed</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="text"
                      placeholder="Rm"
                      required
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                      style={{ width: '50%', padding: '9px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="text"
                      placeholder="Bed"
                      required
                      value={formData.bedNumber}
                      onChange={(e) => setFormData({ ...formData, bedNumber: e.target.value })}
                      style={{ width: '50%', padding: '9px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Fall Risk Level</label>
                  <select
                    value={formData.fallRiskLevel}
                    onChange={(e) => setFormData({ ...formData, fallRiskLevel: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  >
                    <option value="LOW">Low Risk</option>
                    <option value="MEDIUM">Medium Risk</option>
                    <option value="HIGH">High Risk</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Assign Nurse</label>
                  <select
                    value={formData.assignedNurseId}
                    onChange={(e) => setFormData({ ...formData, assignedNurseId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Unassigned</option>
                    {nurses.map((n) => (
                      <option key={n._id} value={n._id}>
                        {n.fullName} ({n.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>Clinical Care Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setEditPatient(null)} className="btn btn-sm btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ASSIGN NURSE */}
      {nurseAssignPatient && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck color="#0ea5e9" size={20} /> Assign Nurse
              </h3>
              <button onClick={() => setNurseAssignPatient(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Select an authorized clinical nurse responsible for <strong>{nurseAssignPatient.name}</strong>.
            </p>

            {actionError && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', marginBottom: '14px', fontSize: '0.82rem' }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleAssignNurseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
                  Nurse In-Charge
                </label>
                <select
                  value={selectedNurseId}
                  onChange={(e) => setSelectedNurseId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                >
                  <option value="">Unassigned (None)</option>
                  {nurses.map((n) => (
                    <option key={n._id} value={n._id}>
                      {n.fullName} &bull; {n.email}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setNurseAssignPatient(null)} className="btn btn-sm btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ASSIGN DEVICE */}
      {deviceAssignPatient && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu color="#10b981" size={20} /> Pair IoT Wearable Tag
              </h3>
              <button onClick={() => setDeviceAssignPatient(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Pair a hardware sensor tag to stream continuous mobility telemetry for <strong>{deviceAssignPatient.name}</strong>.
            </p>

            {actionError && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', marginBottom: '14px', fontSize: '0.82rem' }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleAssignDeviceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
                  Available Wearable Tag
                </label>
                <select
                  value={selectedDeviceCode}
                  onChange={(e) => setSelectedDeviceCode(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: 'var(--text-primary)' }}
                >
                  <option value="">Unassign / No Wearable Tag</option>
                  {devices.map((d) => (
                    <option key={d._id} value={d.deviceCode}>
                      {d.deviceCode} &bull; {d.status} (Batt: {d.batteryLevel || 100}%)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setDeviceAssignPatient(null)} className="btn btn-sm btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Updating...' : 'Save Tag Pairing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: DISCHARGE CONFIRMATION */}
      {dischargePatient && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserX size={20} /> Confirm Inpatient Discharge
              </h3>
              <button onClick={() => setDischargePatient(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
              Are you sure you want to discharge patient <strong>{dischargePatient.name}</strong>?
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Discharging will release the assigned wearable tag (
              <strong>{dischargePatient.assignedDeviceId || 'None'}</strong>), archive active telemetry streams, and record an administrative audit entry.
            </p>

            {actionError && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', marginBottom: '14px', fontSize: '0.82rem' }}>
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setDischargePatient(null)} className="btn btn-sm btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDischargeConfirm}
                disabled={actionLoading}
                className="btn btn-sm btn-danger"
                style={{ fontWeight: 700 }}
              >
                {actionLoading ? 'Discharging...' : 'Confirm Discharge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: PATIENT SAFETY DETAILS DRAWER / MODAL */}
      {detailsPatient && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-container" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  PATIENT ID: {detailsPatient._id}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>{detailsPatient.name}</h3>
              </div>
              <button onClick={() => setDetailsPatient(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  padding: '14px',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Location:</span>
                  <div style={{ fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                    {detailsPatient.wardId} &bull; {detailsPatient.floor || 'Floor 3'} &bull; Room {detailsPatient.roomNumber} ({detailsPatient.bedNumber})
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Location Status:</span>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>
                    {detailsPatient.locationStatus || 'Assigned'} ({detailsPatient.locationSource || 'MANUAL'})
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Demographics:</span>
                  <div style={{ fontWeight: 600, marginTop: '2px' }}>
                    {detailsPatient.age ? `${detailsPatient.age} years old` : 'Age N/A'} &bull; {detailsPatient.gender || 'Demographics N/A'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Fall Risk Protocol:</span>
                  <div style={{ marginTop: '2px' }}>{renderRiskBadge(detailsPatient.fallRiskLevel)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Assigned Nurse:</span>
                  <div style={{ fontWeight: 600, color: '#0ea5e9', marginTop: '2px' }}>{getNurseName(detailsPatient)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>IoT Sensor Tag:</span>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#34d399', marginTop: '2px' }}>
                    {detailsPatient.assignedDeviceId || 'None paired'}
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Current Mobility Status:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                  <StatusBadge status={detailsPatient.movementStatus} type="movement" />
                  {detailsPatient.piezoActivityStatus && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Physical Piezo State: <strong>{detailsPatient.piezoActivityStatus}</strong>
                    </span>
                  )}
                </div>
              </div>

              {detailsPatient.notes && (
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Clinical Notes &amp; Precautions:</span>
                  <p style={{ marginTop: '4px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {detailsPatient.notes}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button onClick={() => setDetailsPatient(null)} className="btn btn-sm btn-primary">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const PatientsView = Patients;
export default Patients;
