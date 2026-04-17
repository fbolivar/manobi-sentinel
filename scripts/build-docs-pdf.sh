#!/usr/bin/env bash
# Genera un PDF unico con toda la documentacion del proyecto.
# Uso: ./scripts/build-docs-pdf.sh
# Requiere: pandoc, weasyprint (apt install pandoc weasyprint)
# Salida:   docs/manobi-sentinel-docs.pdf
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT_HTML="/tmp/manobi-docs.html"
OUT_PDF="$ROOT/docs/manobi-sentinel-docs.pdf"

# Orden logico: portada -> valor -> arquitectura -> operacion -> manual -> presentacion -> QA
DOCS=(
  "README.md"
  "docs/propuesta-valor-pnn.md"
  "docs/arquitectura.md"
  "docs/operacion.md"
  "docs/manual-usuario.md"
  "docs/guia-presentacion.md"
  "docs/setup-smtp-ci.md"
  "docs/guia-validacion-ux.md"
)

CSS=$(cat <<'EOF'
@page { size: A4; margin: 2cm 1.8cm; @bottom-center { content: "Manobi Sentinel — pagina " counter(page) " de " counter(pages); font-size: 9pt; color: #666; } }
body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 10pt; line-height: 1.45; color: #222; }
h1 { color: #004880; border-bottom: 2px solid #85B425; padding-bottom: 6px; page-break-before: always; margin-top: 0; }
h1.title { border: 0; text-align: center; font-size: 28pt; padding-top: 80px; page-break-before: avoid; }
h2 { color: #004880; margin-top: 1.5em; }
h3 { color: #5B8021; }
code, pre { font-family: "DejaVu Sans Mono", monospace; font-size: 9pt; }
pre { background: #f5f5f5; padding: 10px 12px; border-left: 3px solid #85B425; border-radius: 3px; overflow-x: auto; page-break-inside: avoid; }
code { background: #f5f5f5; padding: 1px 4px; border-radius: 2px; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 9pt; }
th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: #eef4e6; color: #004880; }
blockquote { border-left: 3px solid #85B425; padding-left: 12px; color: #555; font-style: italic; margin: 10px 0; }
a { color: #004880; }
ul, ol { padding-left: 22px; }
li { margin: 3px 0; }
#TOC { page-break-after: always; }
#TOC ul { list-style: none; padding-left: 16px; }
#TOC a { text-decoration: none; color: #004880; }
#TOC a::after { content: leader('.') target-counter(attr(href), page); color: #666; }
.cover { text-align: center; page-break-after: always; padding-top: 150px; }
.cover h1 { border: 0; font-size: 32pt; color: #004880; }
.cover .subtitle { font-size: 16pt; color: #5B8021; margin-top: 20px; }
.cover .meta { margin-top: 80px; font-size: 11pt; color: #666; }
EOF
)

# Cabecera con portada
cat > /tmp/manobi-cover.md <<MARKDOWN
<div class="cover">
<h1>Manobi Sentinel</h1>
<div class="subtitle">Sistema de alerta temprana climatica<br/>para Parques Nacionales Naturales de Colombia</div>
<div class="meta">
Documentacion completa del proyecto<br/>
Generado: $(date +"%Y-%m-%d")<br/>
Repositorio: github.com/fbolivar/manobi-sentinel
</div>
</div>

MARKDOWN

# Agrega cada doc con salto de pagina antes de cada H1
ALL_MD="/tmp/manobi-all.md"
cat /tmp/manobi-cover.md > "$ALL_MD"
for f in "${DOCS[@]}"; do
  if [ ! -f "$ROOT/$f" ]; then
    echo "[WARN] falta $f (se omite)"
    continue
  fi
  echo "" >> "$ALL_MD"
  echo "" >> "$ALL_MD"
  cat "$ROOT/$f" >> "$ALL_MD"
done

# Pandoc: markdown -> HTML con TOC
echo "$CSS" > /tmp/manobi-style.css
pandoc "$ALL_MD" \
  -f markdown+yaml_metadata_block \
  -t html5 \
  --standalone \
  --toc --toc-depth=2 \
  --metadata title="Manobi Sentinel — Documentacion" \
  --css=/tmp/manobi-style.css \
  --self-contained \
  -o "$OUT_HTML"

# WeasyPrint: HTML -> PDF
weasyprint "$OUT_HTML" "$OUT_PDF"

SIZE=$(du -h "$OUT_PDF" | cut -f1)
echo ""
echo ">>> PDF generado: $OUT_PDF ($SIZE)"
echo ">>> Para descargarlo: scp root@<servidor>:$OUT_PDF ./"
