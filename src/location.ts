import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export async function getDevicePosition() {
  if (Capacitor.isNativePlatform()) {
    let permission = await Geolocation.checkPermissions();
    if (
      permission.location !== "granted" &&
      permission.coarseLocation !== "granted"
    ) {
      permission = await Geolocation.requestPermissions({
        permissions: ["location"],
      });
    }
    if (
      permission.location !== "granted" &&
      permission.coarseLocation !== "granted"
    )
      throw { code: "OS-PLUG-GLOC-0003" };
  }
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
  });
  const { latitude: lat, longitude: lon, accuracy } = position.coords;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    !Number.isFinite(accuracy) ||
    accuracy < 0
  )
    throw new Error("Invalid position");
  return { lat, lon, accuracy };
}
export function locationError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  if (code === 1 || code === "OS-PLUG-GLOC-0003")
    return "Location access was denied. Allow location access in your device or browser settings, then try again.";
  if (code === "OS-PLUG-GLOC-0007" || code === "OS-PLUG-GLOC-0009")
    return "Location services are off. Turn them on in your device settings, then try again.";
  if (code === 3 || code === "OS-PLUG-GLOC-0010")
    return "A position could not be found in time. Try again where the sky is clearer.";
  return "Your position is unavailable. Check location access and try again where the sky is clearer.";
}
