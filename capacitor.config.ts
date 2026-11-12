import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.baregps.trackeditor",
  appName: "BareGPS Track Editor",
  webDir: "dist",
  ios: { contentInset: "never" },
  android: { backgroundColor: "#f5f6f2" },
  plugins: { SystemBars: { insetsHandling: "disable" } },
};
export default config;
