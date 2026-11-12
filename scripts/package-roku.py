"""Validate the existing SDK package and publish a beta sideload ZIP."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'roku/dist-roku/pkg-dir'
BETA = 'https://beta-viptv.syek.tech'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    git = lambda *args: subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()
    revision = git('rev-parse', 'HEAD')
    assert revision == os.environ['GITHUB_SHA']
    assert not git('status', '--porcelain', '--untracked-files=no')
    meta = json.loads((ROOT / 'roku/dist-roku/bundle/metafile.json').read_text())
    assert any(value.get('entryPoint') == 'src/index.ts' for value in meta['outputs'].values())
    assert all(not value.get('imports') for value in meta['outputs'].values()), 'unresolved_module_imports'
    files = {str(path.relative_to(PACKAGE)): path.read_bytes() for path in PACKAGE.rglob('*') if path.is_file()}
    assert len(files) <= 4096 and sum(map(len, files.values())) < 64 * 1024 * 1024
    required = ['manifest', 'source/Main.brs', 'source/compiled/index.js',
                'components/BaseAppScene.xml', 'components/WorkerTask.xml',
                'fonts/remote_onest_400.ttf', 'assets/fallback.png']
    assert all(name in files for name in required), 'required_roku_runtime_file_missing'
    assert b'BaseAppScene' in files['source/Main.brs']
    compiled = files['source/compiled/index.js']
    assert BETA.encode() in compiled, 'beta_origin_missing'
    assert b'sourceMappingURL=' not in compiled
    for name, content in files.items():
        assert not name.endswith('.map') and not any(part in name.split('/') for part in ['.git', 'node_modules', '.env'])
        if name.endswith(('.js', '.brs', '.xml')) or name == 'manifest':
            assert not re.search(rb'-----BEGIN [A-Z ]*PRIVATE KEY|Bearer\s+[A-Za-z0-9_.-]{24,}|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}', content), 'private_token_material'
        if name.endswith('.xml'):
            xml = ET.fromstring(content)
            for node in xml.iter():
                uri = node.attrib.get('uri', '')
                if uri.startswith('pkg:/'):
                    assert uri.removeprefix('pkg:/') in files, 'unresolved_component_script'
    for path in (ROOT / 'roku/pkg').rglob('*'):
        if path.is_file():
            assert files[str(path.relative_to(ROOT / 'roku/pkg'))] == path.read_bytes(), 'runtime_asset_changed_or_missing'
    manifest = files['manifest'].decode()
    assert 'ts_path=pkg:/source/compiled/index.js' in manifest and 'run_as_process=1' in manifest
    build = 20000 + int(os.environ['GITHUB_RUN_NUMBER'])
    assert 11145 < build <= 999999
    manifest, replacements = re.subn(r'(?m)^build_version=\d+$', 'build_version=' + str(build), manifest)
    assert replacements == 1
    files['manifest'] = manifest.encode()
    out = ROOT / 'artifacts/roku'
    out.mkdir(parents=True, exist_ok=False)
    filename = 'viptv-roku-beta-' + revision[:8] + '.zip'
    with zipfile.ZipFile(out / filename, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(files.items()):
            archive.writestr(name, content)
    with zipfile.ZipFile(out / filename) as archive:
        assert 'manifest' in archive.namelist() and archive.testzip() is None
    proof = {'source_revision': revision, 'source_tree': git('rev-parse', 'HEAD^{tree}'),
             'api_origin': BETA, 'sdk_version': '2.19.0', 'minimum_roku_os': '16.0',
             'version': '1.0.' + str(build), 'manifest_only_patch': 'build_version',
             'zip': filename, 'zip_sha256': sha((out / filename).read_bytes()),
             'compiled_js_sha256': sha(compiled), 'files': {name: sha(content) for name, content in sorted(files.items())},
             'module_closure_verified': True, 'runtime_assets_verified': True,
             'source_maps': False, 'private_token_scan_passed': True,
             'workflow_run_id': os.environ['GITHUB_RUN_ID'], 'device_install_performed': False}
    (out / 'provenance.json').write_text(json.dumps(proof, indent=2) + '\n')
    (out / 'SHA256SUMS').write_text(proof['zip_sha256'] + '  ' + filename + '\n')
    print(json.dumps({'zip': filename, 'source_revision': revision, 'version': proof['version'], 'api_origin': BETA}))

if __name__ == '__main__':
    main()
