#!/usr/bin/env python3
"""Prepare current native sources under an isolated app identity, never production data.
Run npm run native:sync first. Builds/tests run from the printed temporary checkout.
"""
import argparse
from pathlib import Path
import shutil

parser = argparse.ArgumentParser()
parser.add_argument("destination", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
destination = args.destination.resolve()
assert destination != root and not destination.exists(), "Use a new, empty test directory."
destination.mkdir(parents=True)
ignore = shutil.ignore_patterns("build", ".gradle", ".kotlin", "DerivedData", "Pods", "xcuserdata")
for name in ["android", "ios", "tests"]:
    shutil.copytree(root / name, destination / name, ignore=ignore)
(destination / "node_modules").symlink_to(root / "node_modules", target_is_directory=True)
p = destination / "android/app/build.gradle"
s = p.read_text().replace('applicationId "com.baregps.trackeditor"', 'applicationId "com.baregps.trackeditor.nativetest"')
p.write_text(s)
p = destination / "android/app/src/main/res/values/strings.xml"
s = p.read_text().replace("BareGPS Route Planner", "BareGPS Native Tests")
p.write_text(s)
p = destination / "ios/App/App.xcodeproj/project.pbxproj"
s = p.read_text().replace("com.baregps.trackeditor.uitests", "com.baregps.trackeditor.nativetest.uitests").replace("PRODUCT_BUNDLE_IDENTIFIER = com.baregps.trackeditor;", "PRODUCT_BUNDLE_IDENTIFIER = com.baregps.trackeditor.nativetest;")
p.write_text(s)
p = destination / "ios/App/App/Info.plist"
s = p.read_text().replace("<string>BareGPS Route Planner</string>", "<string>BareGPS Native Tests</string>")
p.write_text(s)
print(destination)
print("Isolated application identity: com.baregps.trackeditor.nativetest")
