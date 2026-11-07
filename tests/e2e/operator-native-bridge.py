"""Test-only loopback harness pinned to a supplied native binary, never deployment."""
import argparse
import hashlib
import os
from pathlib import Path
import sys
import tempfile

parser=argparse.ArgumentParser()
parser.add_argument("--port",type=int,default=5189)
args=parser.parse_args()
repo=Path(__file__).resolve().parents[2]
root=Path(os.environ.get("TILESIM_TEST_ROOT","D:/tileSim"))
cli=Path(os.environ.get("TILESIM_TEST_CLI",str(root/"build-msys-topology-20261031/TileSimCLI.exe")))
if not cli.is_file(): parser.error("explicit native fixture CLI is required")
os.environ["PATH"]="C:/msys64/usr/bin;"+os.environ.get("PATH","")
os.environ["TILESIM_ROOT"]=str(root)
os.environ["TILESIM_CLI"]=str(cli)
temporary=tempfile.TemporaryDirectory(prefix="operator-browser-")
os.environ["TILESIM_WEB_STATE_ROOT"]=temporary.name
sys.path.insert(0,str(repo/"bridge"))
import server
cli_sha=hashlib.sha256(cli.read_bytes()).hexdigest()
# This identity is a test binding to one known binary. It makes no claim that
# this binary was built from the current dirty backend source tree.
server.backend_identity=lambda:dict(versions_match=True,source_revision="test-native-binary-only",build_revision="test-native-binary-only",source_state_digest=cli_sha,build_state_digest=cli_sha,deployment_ref="isolated-operator-e2e",cli_sha256=cli_sha)
server.RUNS_ROOT.mkdir(parents=True,exist_ok=True)
httpd=server.ThreadingHTTPServer(("127.0.0.1",args.port),server.BridgeHandler)
print(f"operator test bridge http://127.0.0.1:{args.port}; cli sha256:{cli_sha}",flush=True)
try: httpd.serve_forever()
finally: httpd.server_close();temporary.cleanup()
