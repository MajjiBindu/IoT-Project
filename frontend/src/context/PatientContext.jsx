import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { sseClient } from '../services/sseClient';

const PatientContext = createContext(null);

export const PatientProvider = ({ children }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getPatients();
      if (res && res.success) {
        setPatients(res.data);
        setError(null);
      } else {
        setError(res?.message || 'Database unavailable');
      }
    } catch (err) {
      console.error('[PatientContext] Failed to fetch patients:', err);
      setError(err.message || 'Network error or database unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();

    // Reconcile patient roster on SSE reconnection
    const unsubReconnect = sseClient.addReconnectListener(() => {
      console.log('[PatientContext] SSE reconnection detected, refreshing patients...');
      fetchPatients();
    });

    // Listen for real-time movement status badge updates
    const unsubStatus = sseClient.on('patient_status_updated', (update) => {
      console.log('[PatientContext] SSE patient_status_updated received:', update);
      const movementTimestamp = update.lastMovementUpdate || update.timestamp || new Date();
      setPatients((prev) =>
        prev.map((p) =>
          p._id === update.patientId
            ? {
                ...p,
                ...(update.movementStatus && { movementStatus: update.movementStatus }),
                ...(update.roomNumber && { roomNumber: update.roomNumber }),
                ...(update.bedNumber !== undefined && { bedNumber: update.bedNumber }),
                ...(update.assignedDeviceId !== undefined && { assignedDeviceId: update.assignedDeviceId }),
                lastMovementUpdate: movementTimestamp,
              }
            : p
        )
      );
    });

    // Listen for real-time room/bed location updates
    const unsubLocation = sseClient.on('location_updated', (loc) => {
      console.log('[PatientContext] SSE location_updated received:', loc);
      setPatients((prev) =>
        prev.map((p) =>
          p._id === loc.patientId
            ? {
                ...p,
                roomNumber: loc.roomNumber,
                bedNumber: loc.bedNumber,
                wardId: loc.wardId || p.wardId,
                lastLocationUpdate: loc.timestamp || new Date(),
              }
            : p
        )
      );
    });

    return () => {
      unsubReconnect();
      unsubStatus();
      unsubLocation();
    };
  }, [fetchPatients]);

  return (
    <PatientContext.Provider value={{ patients, loading, error, refreshPatients: fetchPatients }}>
      {children}
    </PatientContext.Provider>
  );
};

export const usePatients = () => {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error('usePatients must be used within a PatientProvider');
  return ctx;
};
