import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MapPin,
  Building2,
  Bed,
  Clock,
  History,
  Plus,
  RefreshCw,
  Search,
  User,
  AlertTriangle,
  X,
  ArrowRight,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { sseClient } from '../../services/sseClient';
import { usePatients } from '../../context/PatientContext';
import { StatusBadge } from '../../components/StatusBadge';

export const Locations = () => {
  const { patients, refreshPatients } = usePatients();

  // Location events state
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL');

  // Location Update Modal State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newBedNumber, setNewBedNumber] = useState('');
  const [updateError, setUpdateError] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);

  // History Modal State
  const [historyModalPatient, setHistoryModalPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Fetch recent location events
  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getLocations({ limit: 100 });
      if (res && res.success) {
        setLocations(res.data);
        setError(null);
      } else {
        setError(res?.message || 'Failed to fetch location events');
      }
    } catch (err) {
      console.error('[Locations] Error fetching locations:', err);
      setError(err.message || 'Network error fetching locations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time SSE subscription
  useEffect(() => {
    fetchLocations();

    const unsubReconnect = sseClient.addReconnectListener(() => {
      console.log('[Locations] SSE reconnection detected, refreshing locations...');
      fetchLocations();
      refreshPatients();
    });

    const unsubLocation = sseClient.on('location_updated', (loc) => {
      console.log('[Locations] SSE location_updated received:', loc);
      fetchLocations();
      refreshPatients();

      // If history modal is open for this patient, refresh history
      if (historyModalPatient && historyModalPatient._id === loc.patientId) {
        loadPatientHistory(historyModalPatient._id);
      }
    });

    return () => {
      unsubReconnect();
      unsubLocation();
    };
  }, [fetchLocations, refreshPatients, historyModalPatient]);

  // Load history for a patient
  const loadPatientHistory = async (patientId) => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await apiClient.getPatientLocationHistory(patientId);
      if (res && res.success) {
        setPatientHistory(res.data);
      } else {
        setHistoryError(res?.message || 'Failed to load location history');
      }
    } catch (err) {
      console.error('[Locations] Error loading patient history:', err);
      setHistoryError(err.message || 'Error loading history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = (patient) => {
    setHistoryModalPatient(patient);
    loadPatientHistory(patient._id);
  };

  // Open Update Modal for a specific patient
  const openUpdateModal = (patient = null) => {
    setUpdateError(null);
    if (patient) {
      setSelectedPatientId(patient._id);
      setNewRoomNumber(patient.roomNumber || '');
      setNewBedNumber(patient.bedNumber || '');
    } else {
      setSelectedPatientId(patients[0]?._id || '');
      setNewRoomNumber('');
      setNewBedNumber('');
    }
    setIsUpdateModalOpen(true);
  };

  // Handle location update form submit
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setUpdateError(null);

    if (!selectedPatientId) {
      setUpdateError('Please select a patient.');
      return;
    }

    if (!newRoomNumber.trim()) {
      setUpdateError('Room number is required.');
      return;
    }

    try {
      setUpdateLoading(true);
      const res = await apiClient.recordLocation({
        patientId: selectedPatientId,
        roomNumber: newRoomNumber.trim(),
        bedNumber: newBedNumber.trim(),
        wardId: 'WARD-3B',
      });

      if (res && res.success) {
        setIsUpdateModalOpen(false);
        await fetchLocations();
        await refreshPatients();
      } else {
        setUpdateError(res?.message || 'Failed to update location.');
      }
    } catch (err) {
      console.error('[Locations] Error recording location:', err);
      setUpdateError(err.message || 'An error occurred while recording location.');
    } finally {
      setUpdateLoading(false);
    }
  };

  // Format timestamp helper
  const formatTime = (dateStr) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Never';
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 1. Overview Computations
  const overview = useMemo(() => {
    const totalPatients = patients.length;
    const roomCounts = {};
    let unknownCount = 0;

    patients.forEach((p) => {
      if (!p.roomNumber || p.roomNumber.trim() === '' || p.roomNumber === 'UNKNOWN') {
        unknownCount += 1;
      } else {
        const r = p.roomNumber.trim();
        roomCounts[r] = (roomCounts[r] || 0) + 1;
      }
    });

    const activeRooms = Object.keys(roomCounts).sort();
    const totalEvents = locations.length;

    return { totalPatients, roomCounts, activeRooms, unknownCount, totalEvents };
  }, [patients, locations]);

  // Filtered patients list
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // Room filter
      if (selectedRoomFilter !== 'ALL' && p.roomNumber !== selectedRoomFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = p.name?.toLowerCase().includes(q);
        const roomMatch = p.roomNumber?.toLowerCase().includes(q);
        const bedMatch = p.bedNumber?.toLowerCase().includes(q);
        const idMatch = p._id?.toLowerCase().includes(q);
        return nameMatch || roomMatch || bedMatch || idMatch;
      }
      return true;
    });
  }, [patients, selectedRoomFilter, searchQuery]);

  const selectedPatientForUpdate = useMemo(() => {
    return patients.find((p) => p._id === selectedPatientId);
  }, [patients, selectedPatientId]);

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
            <MapPin color="#0ea5e9" size={28} />
            Patient Indoor Location &amp; Ward Occupancy
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Simulated hospital room and bed tracking, occupancy breakdown, and chronological relocation audit history.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              fetchLocations();
              refreshPatients();
            }}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh location roster"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => openUpdateModal()}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Record Location Change</span>
          </button>
        </div>
      </div>

      {/* 1. Location Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Total Monitored Patients */}
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
            <User size={22} color="#0ea5e9" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              MONITORED PATIENTS
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '2px' }}>
              {overview.totalPatients}
            </div>
          </div>
        </div>

        {/* Occupied Rooms */}
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
            <Building2 size={22} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              OCCUPIED ROOMS
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
              {overview.activeRooms.length}
            </div>
          </div>
        </div>

        {/* Patients with Unknown Location */}
        <div
          className="glass-panel"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            borderColor: overview.unknownCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: overview.unknownCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.12)',
              border: overview.unknownCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(148, 163, 184, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={22} color={overview.unknownCount > 0 ? '#ef4444' : '#94a3b8'} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              UNKNOWN LOCATION
            </div>
            <div
              style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: overview.unknownCount > 0 ? '#ef4444' : 'var(--text-secondary)',
                marginTop: '2px',
              }}
            >
              {overview.unknownCount}
            </div>
          </div>
        </div>

        {/* Total Relocation Events */}
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
            <History size={22} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              AUDITED LOCATION EVENTS
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
              {overview.totalEvents}
            </div>
          </div>
        </div>
      </div>

      {/* Room Distribution Breakdown */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          WARD 3B ROOM OCCUPANCY:
        </span>
        {overview.activeRooms.map((room) => {
          const count = overview.roomCounts[room];
          const isSelected = selectedRoomFilter === room;
          return (
            <button
              key={room}
              onClick={() => setSelectedRoomFilter(isSelected ? 'ALL' : room)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                background: isSelected ? 'rgba(14, 165, 233, 0.2)' : 'var(--bg-surface-elevated)',
                border: isSelected ? '1px solid rgba(14, 165, 233, 0.5)' : '1px solid var(--border-subtle)',
                color: isSelected ? 'var(--color-brand)' : 'var(--text-primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
              }}
            >
              <Building2 size={13} color={isSelected ? '#0ea5e9' : 'currentColor'} />
              <span>Room {room}</span>
              <span
                style={{
                  background: isSelected ? '#0ea5e9' : 'rgba(255, 255, 255, 0.1)',
                  color: isSelected ? 'white' : 'var(--text-secondary)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                {count} {count === 1 ? 'pt' : 'pts'}
              </span>
            </button>
          );
        })}
        {selectedRoomFilter !== 'ALL' && (
          <button
            onClick={() => setSelectedRoomFilter('ALL')}
            className="btn btn-sm btn-secondary"
            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
          >
            Show All Rooms
          </button>
        )}
      </div>

      {/* Search Bar */}
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
        <div style={{ position: 'relative', minWidth: '280px', flex: 1, maxWidth: '420px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search by patient name, ID, room, or bed..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px', height: '38px', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredPatients.length}</strong> of <strong>{patients.length}</strong> admitted patients
        </div>
      </div>

      {/* 2. Patient Location Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#f87171' }}>
            <AlertTriangle size={32} style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontWeight: 600 }}>Location Ingestion / Database Error</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {error}
            </p>
            <button
              onClick={() => {
                fetchLocations();
                refreshPatients();
              }}
              className="btn btn-sm btn-primary"
              style={{ marginTop: '14px' }}
            >
              Retry
            </button>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <MapPin size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <p style={{ fontWeight: 600 }}>No patient locations match the current filters.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Try clearing the search query or selecting "Show All Rooms".
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
                    PATIENT NAME
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
                    PATIENT ID
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
                    CURRENT ROOM
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
                    BED NUMBER
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
                    LAST LOCATION UPDATE
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
                    MOVEMENT STATUS
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
                {filteredPatients.map((patient) => {
                  return (
                    <tr
                      key={patient._id}
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
                      {/* Patient Name */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(14, 165, 233, 0.15)',
                              border: '1px solid rgba(14, 165, 233, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <User size={16} color="var(--color-brand)" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                              {patient.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Device: {patient.assignedDeviceId || 'Unassigned'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Patient ID */}
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            background: 'rgba(255, 255, 255, 0.04)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          title={patient._id}
                        >
                          {patient._id.substring(patient._id.length - 8).toUpperCase()}
                        </span>
                      </td>

                      {/* Room Number */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={15} color="var(--color-brand)" />
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            Room {patient.roomNumber}
                          </span>
                        </div>
                      </td>

                      {/* Bed Number */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Bed size={15} color="#34d399" />
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {patient.bedNumber || 'Unassigned Bed'}
                          </span>
                        </div>
                      </td>

                      {/* Last Location Update */}
                      <td style={{ padding: '16px 20px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                          }}
                          title={patient.lastLocationUpdate ? new Date(patient.lastLocationUpdate).toLocaleString() : 'Never'}
                        >
                          <Clock size={14} color="var(--text-muted)" />
                          <span>{formatTime(patient.lastLocationUpdate || patient.updatedAt)}</span>
                        </div>
                      </td>

                      {/* Movement Status */}
                      <td style={{ padding: '16px 20px' }}>
                        <StatusBadge status={patient.movementStatus} type="movement" />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => openHistoryModal(patient)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.75rem',
                            }}
                            title="View location history"
                          >
                            <History size={13} color="var(--color-brand)" />
                            <span>History</span>
                          </button>
                          <button
                            onClick={() => openUpdateModal(patient)}
                            className="btn btn-primary btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.75rem',
                            }}
                            title="Update room / bed location"
                          >
                            <Navigation size={13} />
                            <span>Relocate</span>
                          </button>
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

      {/* 4. Location Update Modal */}
      {isUpdateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsUpdateModalOpen(false)}>
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
                <Navigation color="var(--color-brand)" size={22} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Record Indoor Location Relocation</h3>
              </div>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
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

            <form
              onSubmit={handleUpdateSubmit}
              style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}
            >
              {updateError && (
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
                  {updateError}
                </div>
              )}

              {/* Select Patient */}
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
                  PATIENT *
                </label>
                <select
                  className="form-input"
                  value={selectedPatientId}
                  onChange={(e) => {
                    const pId = e.target.value;
                    setSelectedPatientId(pId);
                    const p = patients.find((pat) => pat._id === pId);
                    if (p) {
                      setNewRoomNumber(p.roomNumber || '');
                      setNewBedNumber(p.bedNumber || '');
                    }
                  }}
                  required
                  style={{ cursor: 'pointer' }}
                >
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} &bull; Currently Room {p.roomNumber} ({p.bedNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Location Info Banner */}
              {selectedPatientForUpdate && (
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Building2 size={16} color="var(--color-brand)" />
                  <span>
                    Current Location:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      Room {selectedPatientForUpdate.roomNumber} &bull; {selectedPatientForUpdate.bedNumber}
                    </strong>{' '}
                    (Ward 3B)
                  </span>
                </div>
              )}

              {/* New Room Number */}
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
                  NEW ROOM NUMBER *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. 101, 102, 103, 104, 201"
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                />
              </div>

              {/* New Bed Number */}
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
                  NEW BED NUMBER
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Bed-A, Bed-B, Bed-1"
                  value={newBedNumber}
                  onChange={(e) => setNewBedNumber(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '10px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={updateLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {updateLoading && <RefreshCw size={14} className="animate-spin" />}
                  <span>Record Relocation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Location History Modal */}
      {historyModalPatient && (
        <div className="modal-overlay" onClick={() => setHistoryModalPatient(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px' }}
          >
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
                <History color="var(--color-brand)" size={22} />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                    Location History: {historyModalPatient.name}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Chronological audit of room and bed transitions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalPatient(null)}
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

            <div style={{ padding: '24px', maxHeight: '500px', overflowY: 'auto' }}>
              {historyLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
                  <p>Loading historical location transitions...</p>
                </div>
              ) : historyError ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#f87171' }}>
                  {historyError}
                </div>
              ) : patientHistory.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <MapPin size={28} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                  <p>No historical relocation events recorded yet for this patient.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                    Current location: Room {historyModalPatient.roomNumber} &bull; {historyModalPatient.bedNumber}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {patientHistory.map((event, idx) => {
                    const isLatest = idx === 0;
                    return (
                      <div
                        key={event._id || idx}
                        style={{
                          background: isLatest ? 'rgba(14, 165, 233, 0.08)' : 'var(--bg-surface-elevated)',
                          border: isLatest ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 'var(--radius-full)',
                              background: isLatest ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Building2 size={16} color={isLatest ? '#0ea5e9' : '#94a3b8'} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                Room {event.roomNumber}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>&bull;</span>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {event.bedNumber || 'No Bed Specified'}
                              </span>
                              {isLatest && (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#34d399',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-full)',
                                  }}
                                >
                                  CURRENT
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Ward: {event.wardId || 'WARD-3B'}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {formatTime(event.timestamp)}
                          </div>
                          <div style={{ fontSize: '0.7rem' }}>
                            {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setHistoryModalPatient(null)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const LocationsView = Locations;
export default Locations;
