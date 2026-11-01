import React from 'react';
import { Users } from 'lucide-react';
import { usePatients } from '../../context/PatientContext';
import { StatusBadge } from '../../components/StatusBadge';

export const Patients = () => {
  const { patients, loading, error, refreshPatients } = usePatients();

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users color="#0ea5e9" size={26} />
          Patient Roster &amp; Assigned Wearable Devices
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Ward 3B patient directory, room assignments, and associated IoT telemetry tags.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        {error ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#f87171' }}>
            <p style={{ fontWeight: 600 }}>Database Unavailable</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {error}
            </p>
            <button onClick={refreshPatients} className="btn btn-sm btn-primary" style={{ marginTop: '14px' }}>
              Retry Connection
            </button>
          </div>
        ) : loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading patient roster...
          </div>
        ) : patients.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No patients currently enrolled in Ward 3B.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {patients.map((p) => (
              <div
                key={p._id}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      Room {p.roomNumber} &bull; {p.bedNumber}
                    </span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{p.name}</h3>
                  </div>
                  <StatusBadge status={p.movementStatus} type="movement" />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div>
                    Device Tag:{' '}
                    <strong style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
                      {p.assignedDeviceId || 'None'}
                    </strong>
                  </div>
                  {p.notes && <p style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const PatientsView = Patients;
export default Patients;
