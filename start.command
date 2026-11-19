#!/bin/bash
cd "$(dirname "$0")" || exit 1

PORT=8765

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python 3 was not found. Install Python 3 and run this launcher again."
  exit 1
fi

echo ""
echo "  HeadTracking3D — Your Screen Becomes a Window"
echo "  -------------------------------------------"
echo "  Local server: http://127.0.0.1:$PORT/index.html"
echo "  Stop with Ctrl+C"
echo ""

( sleep 1 && open "http://127.0.0.1:$PORT/index.html" ) &

exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
