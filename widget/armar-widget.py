#!/usr/bin/env python3
"""Arma el script del widget a partir de la app.

1. Copia en widget/copec-widget.js el lector de avisos de index.html (lo que está entre LECTOR:INICIO y LECTOR:FIN),
   para que el widget lea los correos exactamente igual que la app.
2. Guarda el script completo dentro de index.html (WIDGET_CODE), que es lo que copia el botón
   «Copiar el script del widget».

Se ejecuta desde la carpeta del repositorio después de cambiar el lector o el widget:  python3 widget/armar-widget.py
"""
import json, pathlib, re, textwrap

raiz = pathlib.Path(__file__).resolve().parent.parent
app = (raiz / 'index.html').read_text(encoding='utf-8')
widget_path = raiz / 'widget' / 'copec-widget.js'
widget = widget_path.read_text(encoding='utf-8')

m = re.search(r'\n[ \t]*/\* LECTOR:INICIO[^\n]*\n(.*?)\n[ \t]*/\* LECTOR:FIN \*/', app, re.S)
assert m, 'No encuentro el lector en index.html'
lector = textwrap.dedent(m.group(1)).strip('\n')

w = re.search(r'/\* LECTOR:INICIO \*/\n.*?/\* LECTOR:FIN \*/', widget, re.S)
assert w, 'No encuentro las marcas del lector en el widget'
widget = widget[:w.start()] + '/* LECTOR:INICIO */\n' + lector + '\n/* LECTOR:FIN */' + widget[w.end():]
widget_path.write_text(widget, encoding='utf-8')

codigo = json.dumps(widget, ensure_ascii=False).replace('</', '<\\/')
linea = re.compile(r'^(  var WIDGET_CODE = ).*;$', re.M)
assert linea.search(app), 'No encuentro WIDGET_CODE en index.html'
app = linea.sub(lambda x: x.group(1) + codigo + ';', app, count=1)
(raiz / 'index.html').write_text(app, encoding='utf-8')
print('Widget armado:', len(widget), 'caracteres')
