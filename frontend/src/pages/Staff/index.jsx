import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  RefreshCw,
  X,
  Mail,
  Lock,
  User,
  AlertTriangle,
  CheckCircle2,
  PowerOff,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';

export const Staff = () => {
  const { user: currentUser } = useAuth();

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add Staff Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'NURSE',
    status: 'ACTIVE',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getStaff();
      if (res && res.success) {
        setStaffList(res.data);
        setError(null);
      } else {
        setError(res?.message || 'Failed to load staff roster');
      }
    } catch (err) {
      console.error('[Staff] Error loading staff:', err);
      setError(err.message || 'Network error loading staff roster');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError(null);

    if (!addForm.fullName.trim() || !addForm.email.trim() || !addForm.password) {
      setAddError('All fields are required.');
      return;
    }

    if (addForm.password.length < 8) {
      setAddError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setAddLoading(true);
      const res = await apiClient.createStaff({
        fullName: addForm.fullName.trim(),
        email: addForm.email.trim(),
        password: addForm.password,
        role: addForm.role,
        status: addForm.status,
      });

      if (res && res.success) {
        setIsAddModalOpen(false);
        setAddForm({ fullName: '', email: '', password: '', role: 'NURSE', status: 'ACTIVE' });
        await fetchStaff();
      } else {
        setAddError(res?.message || 'Failed to create staff member.');
      }
    } catch (err) {
      console.error('[Staff] Registration error:', err);
      setAddError(err.message || 'An unexpected error occurred.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleStatus = async (staffMember) => {
    const isSelf = currentUser && staffMember._id === currentUser._id;
    if (isSelf && staffMember.status === 'ACTIVE') {
      alert('You cannot deactivate your own administrative account.');
      return;
    }

    const nextStatus = staffMember.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionName = nextStatus === 'INACTIVE' ? 'deactivate' : 'activate';

    const confirmed = window.confirm(
      `Are you sure you want to ${actionName} the account for ${staffMember.fullName} (${staffMember.email})?`
    );
    if (!confirmed) return;

    try {
      setActionLoadingId(staffMember._id);
      const res = await apiClient.updateStaffStatus(staffMember._id, nextStatus);
      if (res && res.success) {
        await fetchStaff();
      } else {
        alert(res?.message || `Failed to ${actionName} staff member.`);
      }
    } catch (err) {
      console.error('[Staff] Status toggle error:', err);
      alert(err.message || 'Error updating staff status.');
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
            <Shield color="#0ea5e9" size={28} />
            Clinical Staff &amp; RBAC Management
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Administrator portal for managing clinical credentials, station permissions, and active staff accounts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchStaff}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setAddError(null);
              setIsAddModalOpen(true);
            }}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={16} />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Staff Roster Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#f87171' }}>
            <AlertTriangle size={32} style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontWeight: 600 }}>Error loading staff records</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {error}
            </p>
            <button onClick={fetchStaff} className="btn btn-sm btn-primary" style={{ marginTop: '14px' }}>
              Retry
            </button>
          </div>
        ) : loading && staffList.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <p>Loading clinical staff roster...</p>
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
                    STAFF MEMBER
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
                    EMAIL ADDRESS
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
                    RBAC ROLE
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
                    ACCOUNT STATUS
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
                    ENROLLED DATE
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
                {staffList.map((staff) => {
                  const isSelf = currentUser && staff._id === currentUser._id;
                  const isActive = staff.status === 'ACTIVE';
                  const isAdminRole = staff.role === 'ADMIN';

                  return (
                    <tr
                      key={staff._id}
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
                      {/* Name */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 'var(--radius-full)',
                              background: isAdminRole
                                ? 'rgba(14, 165, 233, 0.2)'
                                : 'rgba(16, 185, 129, 0.2)',
                              border: isAdminRole
                                ? '1px solid rgba(14, 165, 233, 0.4)'
                                : '1px solid rgba(16, 185, 129, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <User size={16} color={isAdminRole ? '#0ea5e9' : '#10b981'} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                              {staff.fullName}
                              {isSelf && (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    marginLeft: '6px',
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'rgba(14, 165, 233, 0.2)',
                                    color: 'var(--color-brand)',
                                  }}
                                >
                                  YOU
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                        {staff.email}
                      </td>

                      {/* Role Badge */}
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)',
                            background: isAdminRole
                              ? 'rgba(14, 165, 233, 0.15)'
                              : 'rgba(16, 185, 129, 0.15)',
                            border: isAdminRole
                              ? '1px solid rgba(14, 165, 233, 0.35)'
                              : '1px solid rgba(16, 185, 129, 0.35)',
                            color: isAdminRole ? '#38bdf8' : '#34d399',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                          }}
                        >
                          <Shield size={12} />
                          {staff.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 20px' }}>
                        {isActive ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#34d399',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                            ACTIVE
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#f87171',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                            DEACTIVATED
                          </span>
                        )}
                      </td>

                      {/* Enrolled Date */}
                      <td style={{ padding: '16px 20px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(staff.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        {isSelf ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Current Session
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(staff)}
                            disabled={actionLoadingId === staff._id}
                            className={`btn btn-sm ${isActive ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          >
                            {actionLoadingId === staff._id ? (
                              'Updating...'
                            ) : isActive ? (
                              'Deactivate'
                            ) : (
                              'Activate'
                            )}
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

      {/* Add Staff Member Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
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
                <UserPlus color="var(--color-brand)" size={22} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Enroll New Clinical Staff</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
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
              onSubmit={handleAddSubmit}
              style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {addError && (
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
                  {addError}
                </div>
              )}

              {/* Full Name */}
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
                  FULL NAME *
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Dr. Jane Smith or RN David Park"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                />
              </div>

              {/* Email */}
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
                  EMAIL ADDRESS *
                </label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="staff.name@hospital.org"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                />
              </div>

              {/* Temporary Password */}
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
                  TEMPORARY PASSWORD (MIN 8 CHARS) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="form-input"
                  placeholder="••••••••••••"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                />
              </div>

              {/* Role */}
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
                  ASSIGNED CLINICAL ROLE *
                </label>
                <select
                  className="form-input"
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="NURSE">NURSE (Dashboard, Patient info, Alerts, Locations)</option>
                  <option value="ADMIN">ADMIN (Full access: Devices, Staff, Simulator, All features)</option>
                </select>
              </div>

              {/* Form Buttons */}
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
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={addLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {addLoading && <RefreshCw size={14} className="animate-spin" />}
                  <span>Enroll Staff</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const StaffView = Staff;
export default Staff;
