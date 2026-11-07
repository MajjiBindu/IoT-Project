import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const AudioContext = createContext(null);

export const AudioProvider = ({ children }) => {
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('hospital_mobility_muted') === 'true';
  });
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [activeEmergencyAlert, setActiveEmergencyAlert] = useState(null);

  const audioCtxRef = useRef(null);
  const emergencyIntervalRef = useRef(null);

  // Initialize Web Audio Context lazily on user interaction
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtxRef.current = new AudioCtxClass();
      }
    }
    return audioCtxRef.current;
  };

  const resumeAudioContext = async () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        setIsAutoplayBlocked(false);
        console.log('[Audio] AudioContext resumed successfully.');
      } catch (err) {
        console.warn('[Audio] Failed to resume AudioContext:', err);
      }
    } else {
      setIsAutoplayBlocked(false);
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('hospital_mobility_muted', String(next));
      if (!next) {
        resumeAudioContext();
      } else {
        stopEmergencyLoop();
      }
      return next;
    });
  };

  /**
   * Emergency Alarm Pulse (Urgent dual-tone rapid siren)
   * 880Hz (A5) -> 1200Hz high alert
   */
  const playEmergencyAlarm = async () => {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        setIsAutoplayBlocked(true);
        return;
      }

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.5, now);
      masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
      masterGain.connect(ctx.destination);

      // Rapid alternating siren
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(1320, now + 0.2);
      osc.frequency.linearRampToValueAtTime(880, now + 0.4);
      osc.frequency.linearRampToValueAtTime(1320, now + 0.6);
      osc.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.7);
    } catch (err) {
      console.warn('[Audio] Emergency alarm failed:', err);
    }
  };

  /**
   * Warning Alert Chime (Moderate chime: D5 587Hz -> E5 659Hz)
   */
  const playWarningChime = async () => {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state === 'suspended') return;

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.3, now);
      masterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      masterGain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.25);
      osc2.connect(masterGain);
      osc2.start(now + 0.25);
      osc2.stop(now + 0.6);
    } catch (err) {
      console.warn('[Audio] Warning chime failed:', err);
    }
  };

  /**
   * Info / Recovery Beep (Soft crisp ping: C6 1046.5Hz)
   */
  const playInfoPing = async () => {
    if (isMuted) return;

    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state === 'suspended') return;

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.2, now);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      masterGain.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now);
      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (err) {
      console.warn('[Audio] Info ping failed:', err);
    }
  };

  /**
   * Start looping emergency siren until acknowledged or silenced
   */
  const startEmergencyLoop = (alertId) => {
    setActiveEmergencyAlert(alertId);
    playEmergencyAlarm();

    if (emergencyIntervalRef.current) {
      clearInterval(emergencyIntervalRef.current);
    }

    emergencyIntervalRef.current = setInterval(() => {
      playEmergencyAlarm();
    }, 1800);
  };

  /**
   * Stop and silence emergency loop
   */
  const stopEmergencyLoop = () => {
    if (emergencyIntervalRef.current) {
      clearInterval(emergencyIntervalRef.current);
      emergencyIntervalRef.current = null;
    }
    setActiveEmergencyAlert(null);
  };

  // Backward compatibility alias
  const playEmergencyChime = playEmergencyAlarm;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (emergencyIntervalRef.current) {
        clearInterval(emergencyIntervalRef.current);
      }
    };
  }, []);

  return (
    <AudioContext.Provider
      value={{
        isMuted,
        toggleMute,
        isAutoplayBlocked,
        resumeAudioContext,
        playEmergencyAlarm,
        playWarningChime,
        playInfoPing,
        playEmergencyChime,
        startEmergencyLoop,
        stopEmergencyLoop,
        activeEmergencyAlert,
      }}
    >
      {/* Visual notification when audio autoplay is blocked */}
      {isAutoplayBlocked && (
        <div
          onClick={resumeAudioContext}
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            zIndex: 9999,
            backgroundColor: '#ea580c',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span>🔇 Sound blocked by browser</span>
          <span style={{ textDecoration: 'underline' }}>Click here to enable alert chimes</span>
        </div>
      )}
      {children}
    </AudioContext.Provider>
  );
};

export const useAudioAlert = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudioAlert must be used within an AudioProvider');
  }
  return context;
};
