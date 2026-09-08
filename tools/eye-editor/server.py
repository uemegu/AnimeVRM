#!/usr/bin/env python3
"""Local browser UI -> existing Blender MCP socket. Python standard library only."""
import argparse
import base64
import json
import math
import os
from pathlib import Path
import secrets
import socket
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
TOKEN = secrets.token_urlsafe(32)
PORT = 8765


def blender(code):
    request = json.dumps(dict(type='execute', code=code, strict_json=True)).encode() + b'\0'
    with socket.create_connection(('127.0.0.1', int(os.environ.get('BLENDER_MCP_PORT', '9876'))), timeout=45) as sock:
        sock.sendall(request)
        buf = bytearray()
        while b'\0' not in buf:
            chunk = sock.recv(65536)
            if not chunk:
                raise ConnectionError('Blenderとの接続が切れました。')
            buf.extend(chunk)
            if len(buf) > 32 * 1024 * 1024:
                raise ValueError('Blenderの応答が大きすぎます。')
    response = json.loads(buf.partition(b'\0')[0])
    if response.get('status') != 'ok':
        raise RuntimeError(response.get('message', str(response)))
    return response['result']


def invoke(method, *args):
    # Method names are constants in the router. Browser input is JSON data only.
    return blender('import sys, json\n'
                   "engine = sys.modules.get('vroid_eye_editor')\n"
                   "if engine is None: raise RuntimeError('モデルへ接続してください。')\n"
                   f'result = engine.{method}(*json.loads({json.dumps(args)!r}))')


def connect():
    path = str(ROOT / 'blender_engine.py')
    return blender("import sys, importlib.util\n"
                   "engine = sys.modules.get('vroid_eye_editor')\n"
                   "if engine is None:\n"
                   f" spec = importlib.util.spec_from_file_location('vroid_eye_editor', {path!r})\n"
                   " engine = importlib.util.module_from_spec(spec)\n"
                   " sys.modules['vroid_eye_editor'] = engine\n"
                   "engine.__spec__.loader.exec_module(engine)\n"
                   "result = engine.initialize()")


def numeric(data, key, minimum, maximum):
    value = data[key]
    if type(value) not in (int, float) or not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError(f'{key}: {minimum}〜{maximum}の数値を指定してください。')
    return float(value)


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, body, content_type='application/json; charset=utf-8'):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'")
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def valid_host(self):
        return self.headers.get('Host') in {f'127.0.0.1:{PORT}', f'localhost:{PORT}'}

    def do_GET(self):
        if not self.valid_host():
            return self.respond(403, dict(error='Invalid host'))
        path = urlparse(self.path).path
        if path == '/':
            return self.respond(200, (ROOT / 'index.html').read_bytes(), 'text/html; charset=utf-8')
        if path == '/app.js':
            return self.respond(200, (ROOT / 'app.js').read_bytes(), 'text/javascript; charset=utf-8')
        if path == '/api/session':
            return self.respond(200, dict(token=TOKEN))
        self.respond(404, dict(error='Not found'))

    def do_POST(self):
        origin = self.headers.get('Origin')
        if (not self.valid_host() or self.headers.get('X-Eye-Token') != TOKEN
                or (origin and origin not in {f'http://127.0.0.1:{PORT}', f'http://localhost:{PORT}'})):
            return self.respond(403, dict(error='この画面を再読み込みしてください。'))
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 <= length <= 8192:
                raise ValueError('Invalid request size')
            data = json.loads(self.rfile.read(length) or b'{}')
            if not isinstance(data, dict):
                raise ValueError('Invalid request')
            path = urlparse(self.path).path
            if path == '/api/connect':
                result = connect()
            elif path == '/api/update':
                params = {}
                ranges = dict(flatness=(0, 1), length=(0, 1), thickness=(0, 1.2),
                              corner_ratio=(0, 1), upper_peak=(-1, 1), blink=(0, 1))
                if set(data) - set(ranges) - {'before', 'expression'}:
                    raise ValueError('Unknown parameter')
                for key, bounds in ranges.items():
                    if key in data:
                        params[key] = numeric(data, key, *bounds)
                if 'before' in data:
                    if type(data['before']) is not bool:
                        raise ValueError('Invalid comparison state')
                    params['before'] = data['before']
                if 'expression' in data:
                    if not isinstance(data['expression'], str) or len(data['expression']) > 100:
                        raise ValueError('Invalid expression')
                    params['expression'] = data['expression']
                result = invoke('update', params)
            elif path == '/api/view':
                result = invoke('view', numeric(data, 'angle', -40, 40), numeric(data, 'zoom', .7, 2))
            elif path == '/api/screenshot':
                capture = Path(invoke('screenshot')['path'])
                try:
                    result = dict(image=base64.b64encode(capture.read_bytes()).decode('ascii'))
                finally:
                    capture.unlink(missing_ok=True)
            elif path == '/api/save':
                result = invoke('save', str(ROOT / 'output'))
            elif path == '/api/export':
                result = invoke('export_vrm', str(ROOT / 'output'))
            else:
                return self.respond(404, dict(error='Not found'))
            self.respond(200, result)
        except (ConnectionError, OSError) as exc:
            self.respond(503, dict(error='Blenderに接続できません。BlenderとMCPサーバーを起動してください。', detail=str(exc)))
        except Exception as exc:
            self.respond(400, dict(error=str(exc)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--open', action='store_true', help='Open the browser after binding the local port')
    args = parser.parse_args()
    PORT = args.port
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    print(f'Eye Atelier: http://127.0.0.1:{PORT}', flush=True)
    if args.open:
        webbrowser.open(f'http://127.0.0.1:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
