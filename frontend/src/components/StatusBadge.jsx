import React from 'react';
import { Activity, Moon, AlertTriangle, CheckCircle, ArrowDown, Zap } from 'lucide-react';

export const StatusBadge = ({ status, type = 'movement', className = '' }) => {
  if (type === 'movement') {
    if (status === 'VIBRATION_DETECTED' || status === 'MOVEMENT_DETECTED') {
      return (
        <span className={`badge ${className}`} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse-emerald" />
          <Activity size={13} />
          Vibration Active
        </span>
      );
    }
    if (status === 'QUIESCENT' || status === 'NO_RECENT_MOVEMENT') {
      return (
        <span className={`badge ${className}`} style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)' }}>
          <Moon size={13} />
          Piezo Quiescent
        </span>
      );
    }
    if (status === 'WALKING') {
      return (
        <span className={`badge badge-walking ${className}`}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse-emerald" />
          <Activity size={13} />
          Walking
        </span>
      );
    }
    if (status === 'FREE_FALL') {
      return (
        <span className={`badge ${className}`} style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.4)' }}>
          <ArrowDown size={13} />
          Free-Fall (S1)
        </span>
      );
    }
    if (status === 'FALL_IMPACT') {
      return (
        <span className={`badge badge-critical animate-pulse-critical ${className}`}>
          <Zap size={13} />
          Impact Peak (S2)
        </span>
      );
    }
    if (status === 'ORIENTATION_CHANGE') {
      return (
        <span className={`badge ${className}`} style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.4)' }}>
          Posture Tilt (S3)
        </span>
      );
    }
    return (
      <span className={`badge badge-stationary ${className}`}>
        <Moon size={13} />
        Stationary
      </span>
    );
  }

  if (type === 'severity') {
    if (status === 'CRITICAL') {
      return (
        <span className={`badge badge-critical animate-pulse-critical ${className}`}>
          <AlertTriangle size={13} />
          Critical Fall
        </span>
      );
    }
    return (
      <span className={`badge badge-active ${className}`}>
        {status}
      </span>
    );
  }

  if (type === 'alertStatus') {
    if (status === 'ACTIVE') {
      return <span className={`badge badge-critical ${className}`}>Active</span>;
    }
    if (status === 'ACKNOWLEDGED') {
      return <span className={`badge badge-stationary ${className}`}>Acknowledged</span>;
    }
    return <span className={`badge badge-walking ${className}`}><CheckCircle size={12} /> Resolved</span>;
  }

  if (type === 'fallStage') {
    if (status === 'CONFIRMED' || status === 'FALL_CONFIRMED') {
      return <span className="badge badge-critical animate-pulse-critical">Fall Confirmed (S5)</span>;
    }
    if (status === 'SUSPECTED' || status === 'SUSPECTED_FALL' || status === 'POST_IMPACT_INACTIVITY') {
      return <span className="badge" style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.4)' }}>Suspected Fall (S4)</span>;
    }
    if (status === 'FREE_FALL') {
      return <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>Free Fall (S1)</span>;
    }
    if (status === 'IMPACT') {
      return <span className="badge badge-critical">Impact Peak (S2)</span>;
    }
    if (status === 'ORIENTATION_CHANGE') {
      return <span className="badge" style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c' }}>Orientation (S3)</span>;
    }
    if (status === 'REJECTED') {
      return <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8' }}>False Positive Rejected</span>;
    }
    return <span style={{ color: 'var(--text-muted)' }}>Idle</span>;
  }

  return <span className={`badge badge-active ${className}`}>{status}</span>;
};
