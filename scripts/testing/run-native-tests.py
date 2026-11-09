#!/usr/bin/env python3
"""Run real-device acceptance tests under a disposable application identity.
Never clears, uninstalls or installs over com.baregps.trackeditor.
"""
import argparse
from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
TEST_APP = "com.baregps.trackeditor.nativetest"
parser = argparse.ArgumentParser()
parser.add_argument("platform", choices=["android", "ios"])
parser.add_argument("--device", required=True, help="ADB serial or iPhone UDID")
parser.add_argument("--team", help="Apple development team (required for iOS)")
parser.add_argument("--results", type=Path, help="New directory for logs, copied source and results")
args = parser.parse_args()
if args.platform == "ios" and not args.team:
    parser.error("--team is required for iOS")
results = args.results.resolve() if args.results else Path(tempfile.mkdtemp(prefix="baregps-native-results-"))
results.mkdir(parents=True, exist_ok=True)
checkout = results / "checkout"
assert not checkout.exists(), "Use a fresh results directory."
print(f"Results: {results}", flush=True)

def run(command, name, cwd=ROOT, check=True):
    with (results / f"{name}.log").open("w") as log:
        completed = subprocess.run(command, cwd=cwd, stdout=log, stderr=subprocess.STDOUT)
    if check and completed.returncode:
        raise RuntimeError(f"{name} failed; see {results / (name + '.log')}")
    return completed

try:
    run(["npm", "run", "native:sync"], "sync")
    run([sys.executable, str(ROOT / "scripts/testing/prepare-native-tests.py"), str(checkout)], "prepare")
    if args.platform == "android":
        adb = shutil.which("adb") or str(Path.home() / "Library/Android/sdk/platform-tools/adb")
        device = [adb, "-s", args.device]
        run(["./gradlew", ":app:assembleDebug", ":app:assembleDebugAndroidTest"], "build", checkout / "android")
        run(device + ["install", "-r", str(checkout / "android/app/build/outputs/apk/debug/app-debug.apk")], "install-app")
        run(device + ["install", "-r", str(checkout / "android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk")], "install-tests")
        run(device + ["shell", "pm", "clear", TEST_APP], "reset-test-app")
        run(device + ["push", str(ROOT / "tests/native-fixture.gpx"), "/sdcard/Download/BareGPS-native-workflow.gpx"], "fixture")
        run(device + ["shell", "am", "instrument", "-w", TEST_APP + ".test/androidx.test.runner.AndroidJUnitRunner"], "tests")
        assert "OK (1 test)" in (results / "tests.log").read_text(), "Instrumentation reported a failed test; see tests.log"
        paths = subprocess.check_output(device + ["shell", "ls -t /sdcard/Download/BareGPS-native-output-*.gpx"], text=True).splitlines()
        assert paths and paths[0].startswith("/sdcard/Download/BareGPS-native-output-")
        run(device + ["pull", paths[0], str(results / "export.gpx")], "readback")
    else:
        derived = results / "derived"
        run(["xcodebuild", "-project", "ios/App/App.xcodeproj", "-scheme", "App", "-configuration", "Debug", "-destination", f"id={args.device}", "-derivedDataPath", str(derived), f"DEVELOPMENT_TEAM={args.team}", "-allowProvisioningUpdates", "build-for-testing"], "build", checkout)
        device = ["xcrun", "devicectl", "device"]
        run(device + ["uninstall", "app", "--device", args.device, TEST_APP], "reset-test-app", check=False)
        run(device + ["install", "app", "--device", args.device, str(derived / "Build/Products/Debug-iphoneos/App.app")], "install-app")
        domain = ["--device", args.device, "--domain-type", "appDataContainer", "--domain-identifier", TEST_APP]
        run(device + ["copy", "to"] + domain + ["--source", str(ROOT / "tests/native-fixture.gpx"), "--destination", "Documents/BareGPS-native-workflow.gpx"], "fixture")
        bundles = list((derived / "Build/Products").glob("*.xctestrun"))
        assert len(bundles) == 1
        run(["xcodebuild", "test-without-building", "-xctestrun", str(bundles[0]), "-destination", f"id={args.device}", "-resultBundlePath", str(results / "tests.xcresult"), "-parallel-testing-enabled", "NO"], "tests")
        run(device + ["copy", "from"] + domain + ["--source", "Documents/Edited Route.gpx", "--destination", str(results / "export.gpx")], "readback")
    run([sys.executable, str(ROOT / "scripts/testing/verify-native-export.py"), str(results / "export.gpx")], "verify-export")
    print(f"PASS: {args.platform} native workflow and exported content. Results: {results}")
except (RuntimeError, AssertionError, OSError) as error:
    print(f"FAIL: {error}\nResults retained at {results}", file=sys.stderr)
    sys.exit(1)
