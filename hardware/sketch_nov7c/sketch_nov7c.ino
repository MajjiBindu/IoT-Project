/*
  =========================================================
  HOSPITAL MOBILITY MONITORING SYSTEM
  Arduino Uno - Piezoelectric Sensor Prototype (Corrected)
  =========================================================

  Hardware:
  - Arduino Uno R3
  - Existing piezoelectric sensor assembly (5 discs)
  - Analog sensor input: A0
  - LED output: D12
  - USB Serial communication: 9600 baud

  Features:
  - Startup calibration with noise baseline estimation
  - Rolling observation window for upper-rail saturation detection
  - Self-healing recovery from transient sensor saturation
  - Vibration / movement event detection and counting
  - Inactivity monitoring and timeout alerts
  - LED visual feedback on detected movement
  - Sequence-numbered 10-field CSV telemetry
  - Periodic heartbeat telemetry (1 Hz)

  Protocol Format:
  DATA,SEQUENCE,TIME_MS,RAW,BASELINE,DEVIATION,THRESHOLD,MOVEMENT_COUNT,EVENT,STATUS
*/

// ---------------- PIN CONFIGURATION ----------------

const int SENSOR_PIN = A0;
const int LED_PIN = 12;

// ---------------- TIMING & SENSITIVITY CONFIGURATION ----------------

const unsigned long SERIAL_BAUD = 9600;

const unsigned long SAMPLE_INTERVAL = 50;         // 50ms (20 Hz sampling)
const unsigned long CALIBRATION_DURATION = 3000;  // 3-second stationary calibration
const unsigned long HEARTBEAT_INTERVAL = 1000;    // 1-second telemetry heartbeat

const unsigned long MOVEMENT_COOLDOWN = 300;      // 300ms lockout between distinct movements
const unsigned long INACTIVITY_TIMEOUT = 10000;   // 10-second inactivity threshold
const unsigned long LED_DURATION = 200;           // 200ms LED pulse

// Movement sensitivity limits
const int MIN_MOVEMENT_THRESHOLD = 30;
const int MAX_MOVEMENT_THRESHOLD = 150;

// Dynamic baseline adaptation factor (low-pass alpha)
const float BASELINE_ALPHA = 0.02;

// ---------------- ROLLING DIAGNOSTIC CONFIGURATION ----------------

// 10-bit ADC upper rail limit (5.0V on Arduino Uno)
const int UPPER_RAIL_THRESHOLD = 1018;

// 40 samples @ 50ms = 2.0-second rolling observation window
const int DIAG_WINDOW_SIZE = 40;

// Sustained upper rail: >= 30 of 40 samples (75% of 2s) at rail triggers SENSOR_CHECK
const int FAULT_SAMPLE_LIMIT = 30;

// Recovery: <= 4 of 40 samples (<= 10% of 2s) at rail returns to healthy
const int RECOVERY_SAMPLE_LIMIT = 4;

// ---------------- SENSOR VARIABLES ----------------

int rawValue = 0;
int peakAdcInWindow = 0;
int valleyAdcInWindow = 1023;

float sensorBaseline = 0;
float movementThreshold = MIN_MOVEMENT_THRESHOLD;

int calibrationMin = 1023;
int calibrationMax = 0;

unsigned long calibrationSamples = 0;
unsigned long calibrationTotal = 0;

bool calibrated = false;
bool sensorSaturated = false;

// Rolling circular buffer for upper-rail samples
bool upperRailHistory[DIAG_WINDOW_SIZE];
int diagHistoryIndex = 0;
int upperRailCount = 0;

// ---------------- MOVEMENT & TELEMETRY VARIABLES ----------------

unsigned long movementCount = 0;
unsigned long sequenceNumber = 0;

unsigned long lastSampleTime = 0;
unsigned long lastMovementTime = 0;
unsigned long lastEventTime = 0;
unsigned long lastTelemetryTime = 0;
unsigned long ledStartTime = 0;

bool movementActive = false;
bool ledActive = false;
bool inactivityReported = false;

// ---------------- SERIAL PROTOCOL FUNCTIONS ----------------

void printHeader() {
  Serial.println(
    "TYPE,SEQUENCE,TIME_MS,RAW,BASELINE,DEVIATION,"
    "THRESHOLD,MOVEMENT_COUNT,EVENT,STATUS"
  );
}

void printTelemetry(const char* eventName,
                    const char* status,
                    int deviation) {

  Serial.print("DATA,");
  Serial.print(sequenceNumber++);
  Serial.print(",");
  Serial.print(millis());
  Serial.print(",");
  Serial.print(rawValue);
  Serial.print(",");
  Serial.print(sensorBaseline, 2);
  Serial.print(",");
  Serial.print(deviation);
  Serial.print(",");
  Serial.print(movementThreshold, 2);
  Serial.print(",");
  Serial.print(movementCount);
  Serial.print(",");
  Serial.print(eventName);
  Serial.print(",");
  Serial.println(status);
}

// ---------------- SENSOR DIAGNOSTIC MONITORING ----------------

void updateSensorDiagnostics(int currentRaw) {
  bool isUpperRail = (currentRaw >= UPPER_RAIL_THRESHOLD);

  // Subtract outgoing sample from window sum
  if (upperRailHistory[diagHistoryIndex]) {
    upperRailCount--;
  }

  // Insert incoming sample into window
  upperRailHistory[diagHistoryIndex] = isUpperRail;
  if (isUpperRail) {
    upperRailCount++;
  }

  diagHistoryIndex = (diagHistoryIndex + 1) % DIAG_WINDOW_SIZE;

  // Evaluate state transitions
  if (!sensorSaturated && upperRailCount >= FAULT_SAMPLE_LIMIT) {
    sensorSaturated = true;
    Serial.println("STATUS:SENSOR_SIGNAL_CHECK_REQUIRED");
  } else if (sensorSaturated && upperRailCount <= RECOVERY_SAMPLE_LIMIT) {
    sensorSaturated = false;
    Serial.println("STATUS:SENSOR_READY");
  }
}

// ---------------- STARTUP CALIBRATION ----------------

void calibrateSensor() {
  Serial.println("CALIBRATION_STARTED");
  Serial.println("Keep the sensor assembly stationary.");

  unsigned long startTime = millis();

  unsigned long total = 0;
  unsigned long samples = 0;
  unsigned long upperRailSamples = 0;

  int minValue = 1023;
  int maxValue = 0;

  while (millis() - startTime < CALIBRATION_DURATION) {
    int value = analogRead(SENSOR_PIN);

    total += value;
    samples++;

    if (value < minValue) {
      minValue = value;
    }
    if (value > maxValue) {
      maxValue = value;
    }

    // Only count upper electrical rail saturation (>= 1018).
    // Readings near 0V are normal resting levels for piezo discs.
    if (value >= UPPER_RAIL_THRESHOLD) {
      upperRailSamples++;
    }

    delay(10);
  }

  if (samples == 0) {
    sensorSaturated = true;
    return;
  }

  sensorBaseline = (float)total / samples;

  calibrationMin = minValue;
  calibrationMax = maxValue;
  calibrationSamples = samples;
  calibrationTotal = total;

  int noiseRange = maxValue - minValue;

  // Adapt threshold dynamically to observed stationary noise floor
  movementThreshold = noiseRange * 2.0 + 25.0;

  if (movementThreshold < MIN_MOVEMENT_THRESHOLD) {
    movementThreshold = MIN_MOVEMENT_THRESHOLD;
  }
  if (movementThreshold > MAX_MOVEMENT_THRESHOLD) {
    movementThreshold = MAX_MOVEMENT_THRESHOLD;
  }

  // Diagnostic fault criteria: only if sustained at upper rail (> 80%) or baseline near 5V
  float upperRailPercentage = (100.0 * upperRailSamples) / samples;
  sensorSaturated = (upperRailPercentage > 80.0) || (sensorBaseline > 1000.0);

  // Seed the rolling observation window
  for (int i = 0; i < DIAG_WINDOW_SIZE; i++) {
    upperRailHistory[i] = sensorSaturated;
  }
  upperRailCount = sensorSaturated ? DIAG_WINDOW_SIZE : 0;
  diagHistoryIndex = 0;

  calibrated = true;

  // Diagnostic visibility report
  Serial.println("CALIBRATION_COMPLETED");
  Serial.print("MIN_VALUE:");
  Serial.println(minValue);
  Serial.print("MAX_VALUE:");
  Serial.println(maxValue);
  Serial.print("BASELINE:");
  Serial.println(sensorBaseline, 2);
  Serial.print("NOISE_RANGE:");
  Serial.println(noiseRange);
  Serial.print("MOVEMENT_THRESHOLD:");
  Serial.println(movementThreshold, 2);
  Serial.print("UPPER_RAIL_PERCENTAGE:");
  Serial.println(upperRailPercentage, 2);

  if (sensorSaturated) {
    Serial.println("STATUS:SENSOR_SIGNAL_CHECK_REQUIRED");
  } else {
    Serial.println("STATUS:SENSOR_READY");
  }

  printHeader();

  lastMovementTime = millis();
  lastSampleTime = millis();
  lastTelemetryTime = millis();
}

// ---------------- MOVEMENT PROCESSING ----------------

void processMovement() {
  unsigned long now = millis();
  int deviation = abs(rawValue - (int)sensorBaseline);

  // Continuously evaluate rolling upper-rail diagnostics
  updateSensorDiagnostics(rawValue);

  // If electrically saturated / shorted to 5V, emit periodic diagnostic telemetry
  if (sensorSaturated) {
    if (now - lastTelemetryTime >= HEARTBEAT_INTERVAL) {
      lastTelemetryTime = now;
      printTelemetry("NONE", "SENSOR_CHECK", deviation);
    }
    return;
  }

  // 1. Detect a genuine vibration / tapping event
  if (deviation >= movementThreshold &&
      !movementActive &&
      now - lastEventTime >= MOVEMENT_COOLDOWN) {

    movementActive = true;
    movementCount++;

    lastMovementTime = now;
    lastEventTime = now;
    inactivityReported = false;

    digitalWrite(LED_PIN, HIGH);
    ledActive = true;
    ledStartTime = now;

    lastTelemetryTime = now;
    printTelemetry("MOVEMENT", "ACTIVE", deviation);
  }

  // 2. Rearm detector after vibration amplitude settles
  if (deviation < movementThreshold * 0.5) {
    movementActive = false;
  }

  // 3. Adapt baseline dynamically only during quiet periods
  if (deviation < movementThreshold * 0.5) {
    sensorBaseline =
      (1.0 - BASELINE_ALPHA) * sensorBaseline +
      BASELINE_ALPHA * rawValue;
  }

  // 4. Turn off the LED after its indication pulse
  if (ledActive && (now - ledStartTime >= LED_DURATION)) {
    digitalWrite(LED_PIN, LOW);
    ledActive = false;
  }

  // 5. Inactivity detection
  if (now - lastMovementTime >= INACTIVITY_TIMEOUT && !inactivityReported) {
    lastTelemetryTime = now;
    printTelemetry("INACTIVITY", "INACTIVE", deviation);
    inactivityReported = true;
  }

  // 6. Periodic telemetry heartbeat during quiescent periods
  if (now - lastTelemetryTime >= HEARTBEAT_INTERVAL) {
    lastTelemetryTime = now;
    const char* currentStatus = inactivityReported ? "INACTIVE" : "ACTIVE";
    printTelemetry("NONE", currentStatus, deviation);
  }
}

// ---------------- ARDUINO SETUP ----------------

void setup() {
  pinMode(SENSOR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  digitalWrite(LED_PIN, LOW);

  Serial.begin(SERIAL_BAUD);

  delay(1000);

  Serial.println();
  Serial.println("HOSPITAL_MOBILITY_SYSTEM");
  Serial.println("DEVICE:ARDUINO_UNO");
  Serial.println("SENSOR:PIEZOELECTRIC");
  Serial.println("VERSION:1.1");

  calibrateSensor();
}

// ---------------- ARDUINO MAIN LOOP ----------------

void loop() {
  if (!calibrated) {
    return;
  }

  // High-frequency sub-millisecond continuous sampling
  // Guarantees capturing 1-10ms transient piezo vibration/impact peaks
  int currentAdc = analogRead(SENSOR_PIN);
  if (currentAdc > peakAdcInWindow) {
    peakAdcInWindow = currentAdc;
  }
  if (currentAdc < valleyAdcInWindow) {
    valleyAdcInWindow = currentAdc;
  }

  unsigned long now = millis();

  if (now - lastSampleTime >= SAMPLE_INTERVAL) {
    lastSampleTime = now;

    // Select the peak value with maximum absolute deviation from baseline
    int devHigh = abs(peakAdcInWindow - (int)sensorBaseline);
    int devLow = abs(valleyAdcInWindow - (int)sensorBaseline);
    if (devHigh >= devLow) {
      rawValue = peakAdcInWindow;
    } else {
      rawValue = valleyAdcInWindow;
    }

    // Reset peak tracking for next 50ms observation window
    peakAdcInWindow = 0;
    valleyAdcInWindow = 1023;

    processMovement();
  }
}
