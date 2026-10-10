#!/usr/bin/env python3
"""Repeatable archive -> map pipeline using the actual build_index.py importer."""
import argparse
from pathlib import Path
import subprocess
import sys

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--evidence-dir')
    p.add_argument('--site', required=True)
    p.add_argument('--seed')
    p.add_argument('--review-catalog')
    p.add_argument('--source-manifest', action='append', default=[])
    p.add_argument('--manifest', action='append', default=[])
    a=p.parse_args()
    home=Path(__file__).resolve().parent
    command=[sys.executable,str(home/'build_index.py'),'--output',str(Path(a.site)/'data'/'merged.json')]
    if a.evidence_dir:
        for arch in sorted(Path(a.evidence_dir).glob('*.zip')):
            command.extend(['--archive',str(arch)])
    for manifest in a.manifest:
        command.extend(['--manifest',manifest])
    if a.seed:
        command.extend(['--seed',a.seed])
    if a.review_catalog:
        command.extend(['--review-catalog',a.review_catalog])
    for manifest in a.source_manifest:
        command.extend(['--source-manifest',manifest])
    subprocess.run(command,check=True)
