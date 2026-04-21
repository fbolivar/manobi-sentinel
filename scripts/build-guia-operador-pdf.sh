#!/usr/bin/env bash
# Genera PDF imprimible de la guia de pruebas funcionales para el operador.
# Uso: ./scripts/build-guia-operador-pdf.sh
# Salida: docs/guia-pruebas-operador.pdf
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
SRC="$ROOT/docs/guia-pruebas-operador.md"
OUT_HTML="/tmp/guia-operador.html"
OUT_PDF="$ROOT/docs/guia-pruebas-operador.pdf"

CSS=$(cat <<'EOF'
@page {
  size: A4;
  margin: 1.8cm 1.6cm 1.6cm 1.6cm;
  @bottom-left { content: "Manobi Sentinel - Guia de pruebas"; font-size: 8pt; color: #888; }
  @bottom-right { content: "Pag. " counter(page) " / " counter(pages); font-size: 8pt; color: #888; }
}
body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #222; }
h1 { color: #004880; border-bottom: 2px solid #85B425; padding-bottom: 6px; font-size: 22pt; }
h1.title { border: 0; text-align: center; font-size: 28pt; padding-top: 20px; margin-bottom: 4px; }
h2 { color: #004880; margin-top: 1.5em; page-break-after: avoid; border-left: 4px solid #85B425; padding-left: 10px; }
h3 { color: #5B8021; margin-top: 1em; page-break-after: avoid; }
h3 + p, h3 + div { page-break-before: avoid; }
p, ul, ol { page-break-inside: avoid; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 9pt; background: #f3f4f6; padding: 1px 4px; border-radius: 2px; }
pre { background: #f5f5f5; padding: 10px 12px; border-left: 3px solid #85B425; border-radius: 3px; font-size: 9pt; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9pt; page-break-inside: avoid; }
th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: #eef4e6; color: #004880; }
strong { color: #004880; }
hr { border: none; border-top: 1px solid #ddd; margin: 1.2em 0; }
ul { padding-left: 22px; }
li { margin: 3px 0; }
blockquote { border-left: 3px solid #85B425; padding-left: 12px; color: #555; font-style: italic; }
EOF
)

echo "$CSS" > /tmp/guia-operador.css

pandoc "$SRC" \
  -f markdown+yaml_metadata_block+pipe_tables \
  -t html5 \
  --standalone \
  --metadata title="Manobi Sentinel - Guia de pruebas funcionales" \
  --css=/tmp/guia-operador.css \
  --self-contained \
  -o "$OUT_HTML"

weasyprint "$OUT_HTML" "$OUT_PDF"

SIZE=$(du -h "$OUT_PDF" | cut -f1)
echo ""
echo ">>> PDF generado: $OUT_PDF ($SIZE)"
echo ">>> Para bajarlo: scp root@<server>:$OUT_PDF ./"
