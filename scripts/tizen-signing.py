"""Import Samsung certificates from Actions secrets without printing credentials."""
import base64
import os
from pathlib import Path
import subprocess
import tempfile

names = ['TIZEN_AUTHOR_P12', 'TIZEN_AUTHOR_PASSWORD', 'TIZEN_DISTRIBUTOR_P12', 'TIZEN_DISTRIBUTOR_PASSWORD']
missing = [name for name in names if not os.environ.get(name)]
if missing:
    raise SystemExit('Samsung signing secrets missing: ' + ', '.join(missing))
directory = Path(tempfile.mkdtemp(prefix='viptv-samsung-', dir=os.environ.get('RUNNER_TEMP')))
for name, filename in [('TIZEN_AUTHOR_P12', 'author.p12'), ('TIZEN_DISTRIBUTOR_P12', 'distributor.p12')]:
    path = directory / filename
    path.write_bytes(base64.b64decode(os.environ[name], validate=True))
    path.chmod(0o600)
result = subprocess.run(['tizen', 'security-profiles', 'add', '-n', 'viptv', '-a', str(directory / 'author.p12'),
    '-p', os.environ['TIZEN_AUTHOR_PASSWORD'], '-d', str(directory / 'distributor.p12'),
    '-dp', os.environ['TIZEN_DISTRIBUTOR_PASSWORD']], capture_output=True)
if result.returncode:
    raise SystemExit('Could not import Samsung signing profile; check certificates and passwords.')
print('Samsung signing profile imported (credentials hidden).')
