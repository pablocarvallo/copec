#!/usr/bin/env python3
"""Arma los scripts de los widgets a partir de la app.

1. Copia el lector de avisos de index.html (lo que está entre LECTOR:INICIO y LECTOR:FIN) en widget/copec-widget.js
   y en widget/panel-widget.js, para que los widgets lean los correos exactamente igual que la app.
2. Guarda los dos scripts completos dentro de index.html: WIDGET_CODE, que es lo que copia el botón
   «Copiar el script del widget», y PANEL_CODE, lo que copia «Copiar el script del panel».

Se ejecuta desde la carpeta del repositorio después de cambiar el lector o un widget:  python3 widget/armar-widget.py
"""
import json, pathlib, re, textwrap

raiz = pathlib.Path(__file__).resolve().parent.parent
app = (raiz / 'index.html').read_text(encoding='utf-8')

m = re.search(r'\n[ \t]*/\* LECTOR:INICIO[^\n]*\n(.*?)\n[ \t]*/\* LECTOR:FIN \*/', app, re.S)
assert m, 'No encuentro el lector en index.html'
lector = textwrap.dedent(m.group(1)).strip('\n')


def armar(nombre, variable):
    global app
    path = raiz / 'widget' / nombre
    script = path.read_text(encoding='utf-8')
    w = re.search(r'/\* LECTOR:INICIO \*/\n.*?/\* LECTOR:FIN \*/', script, re.S)
    assert w, 'No encuentro las marcas del lector en ' + nombre
    script = script[:w.start()] + '/* LECTOR:INICIO */\n' + lector + '\n/* LECTOR:FIN */' + script[w.end():]
    path.write_text(script, encoding='utf-8')
    codigo = json.dumps(script, ensure_ascii=False).replace('</', '<\\/')
    linea = re.compile(r'^(  var ' + variable + r' = ).*;$', re.M)
    assert linea.search(app), 'No encuentro ' + variable + ' en index.html'
    app = linea.sub(lambda x: x.group(1) + codigo + ';', app, count=1)
    print(nombre + ' armado:', len(script), 'caracteres')


armar('copec-widget.js', 'WIDGET_CODE')
armar('panel-widget.js', 'PANEL_CODE')
(raiz / 'index.html').write_text(app, encoding='utf-8')
