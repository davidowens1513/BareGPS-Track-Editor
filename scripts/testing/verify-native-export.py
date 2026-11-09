#!/usr/bin/env python3
"""Verify the dedicated native fixture after Reverse → Plan → Confirm → Save."""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument("exported_gpx", type=Path)
args = parser.parse_args()
root = ET.parse(args.exported_gpx).getroot()
points = [element for element in root.iter() if element.tag.split("}")[-1] == "trkpt"]
assert len(points) == 5, f"Expected five points, got {len(points)}"
expected = [(56.004, 200, "Finish"), (56.003, 160, None), (56.002, 120, None), (56.001, 150, None), (56, 100, "Start")]
for point, (lat, elevation, name) in zip(points, expected):
    children = {child.tag.split("}")[-1]: child.text for child in point}
    assert abs(float(point.attrib["lat"]) - lat) < 1e-9
    assert abs(float(point.attrib["lon"]) + 5) < 1e-9
    assert float(children["ele"]) == elevation
    assert children.get("name") == name
print(json.dumps({"file": str(args.exported_gpx), "points": 5, "reversed_order": True, "heights_preserved": True, "names_preserved": True}))
