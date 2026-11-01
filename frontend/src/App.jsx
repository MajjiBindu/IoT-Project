import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { AlertProvider } from './context/AlertContext';
import { PatientProvider } from './context/PatientContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RootLayout } from './layouts/RootLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Alerts } from './pages/Alerts';
import { LiveTracking } from './pages/LiveTracking';
import { MovementHistory } from './pages/MovementHistory';
import { Patients } from './pages/Patients';
import { Locations } from './pages/Locations';
import { Devices } from './pages/Devices';
import { Staff } from './pages/Staff';
import { Simulator } from './pages/Simulator';
import { NotFound } from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AudioProvider>
          <AlertProvider>
            <PatientProvider>
              <Routes>
                {/* Public Authentication Route */}
                <Route path="/login" element={<Login />} />

                {/* Protected Hospital Application Shell */}
                <Route
                  element={
                    <ProtectedRoute>
                      <RootLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Default redirect: / -> /dashboard */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />

                  {/* Accessible to all authenticated clinical staff (ADMIN & NURSE) */}
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/live-tracking" element={<LiveTracking />} />
                  <Route path="/movement-history" element={<MovementHistory />} />
                  <Route path="/patients" element={<Patients />} />
                  <Route path="/locations" element={<Locations />} />
                  <Route path="/devices" element={<Devices />} />

                  {/* Restricted to ADMIN staff only */}
                  <Route
                    path="/staff"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <Staff />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/simulator"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <Simulator />
                      </ProtectedRoute>
                    }
                  />

                  {/* 404 Fallback within authenticated shell */}
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </PatientProvider>
          </AlertProvider>
        </AudioProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
