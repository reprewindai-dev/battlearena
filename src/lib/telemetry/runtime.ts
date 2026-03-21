import { TelemetrySystem } from "@/lib/telemetry/TelemetrySystem";

let telemetrySystem: TelemetrySystem | null = null;

export function getTelemetrySystem() {
  if (!telemetrySystem) {
    telemetrySystem = new TelemetrySystem();
  }

  return telemetrySystem;
}
