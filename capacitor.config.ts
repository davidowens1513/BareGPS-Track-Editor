import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.baregps.trackeditor",
  appName: "BareGPS Track Creator and Editor",
  webDir: "dist",
  ios: { contentInset: "never" },
  android: { backgroundColor: "#f5f6f2" },
};
export default config;
