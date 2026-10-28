"""collect.js가 보낸 쿠팡 검색 결과를 <폴더>/<검색어>.json으로 저장한다.

사용: python3 recv.py data   (127.0.0.1:8765, Chrome의 로컬 네트워크 접근 허용 필요)
"""
import http.server, json, sys, os
OUT = sys.argv[1]
class H(http.server.BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', 'https://www.coupang.com')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        with open(os.path.join(OUT, body['query'] + '.json'), 'w', encoding='utf-8') as f:
            json.dump(body, f, ensure_ascii=False, indent=1)
        self.send_response(200); self.cors(); self.end_headers(); self.wfile.write(b'ok')
http.server.ThreadingHTTPServer(('127.0.0.1', 8765), H).serve_forever()
