# Copec

App personal para llevar el saldo de la cuenta Copec Pay: lee los avisos de cargo que Copec Pay envía por correo desde `mensajeria@copecpay.cl`, guarda fecha, hora y monto, descuenta cada cargo del saldo y permite anotar a mano los abonos.

Es un registro personal. No es la app oficial de Copec ni está conectada a la cuenta.

## Qué hace

- **Saldo de la cuenta**: se parte ingresando el saldo inicial, el que muestra la app de Copec, junto con la fecha y la hora de ese saldo. Desde ahí cada cargo lo descuenta y cada abono lo suma. Con **Ajustar** se vuelve a cuadrar cuando haga falta.
- **Lectura automática**: una automatización de Atajos envía cada correo de `mensajeria@copecpay.cl`, apenas llega a Mail, a un buzón privado en GitHub. La app lee ese buzón al abrirse y agrega solo los cargos que falten. Un mismo cargo nunca se registra dos veces, aunque Copec Pay mande dos correos por él.
- **Solo Copec Pay, con cualquier asunto**: cuentan los avisos de cargo de `mensajeria@copecpay.cl`. El texto de otros correos que llegan pegados en el mismo issue (publicidad, por ejemplo) se deja fuera.
- **Cargos de la noche**: los cargos automáticos se hacen de noche y su correo llega recién al encender el iPhone. La app registra cada cargo con la fecha y la hora que trae el aviso, no con la hora en que llegó el correo. Ver [Cargos de la noche](#cargos-de-la-noche).
- **Abono**: anota a mano un abono con monto, descripción, fecha y hora. La misma hoja permite anotar un cargo que no llegó por correo.
- **Pegar un aviso**: alternativa sin configuración. Se copia el texto del correo, se pega en la app y esta extrae los datos.
- **Movimientos**: todos los cargos y abonos, con el saldo que dejó cada uno. Se pueden filtrar (todos, cargos, abonos) y ordenar. Al tocar un movimiento se corrige, se renombra o se elimina. En un cargo leído de un aviso se puede ver el texto original del correo.
- **Widget**: el saldo y los tres últimos cargos en la pantalla de inicio o la pantalla bloqueada, con la app Scriptable. Ver [Widget en la pantalla de inicio](#widget-en-la-pantalla-de-inicio).
- **Panel de las cuatro cuentas**: un widget grande con Copec, FAN, Master y LiderBCI, con los colores de Copec. Ver [Panel con las cuatro cuentas](#panel-con-las-cuatro-cuentas).
- **Datos y respaldo**: copia todos los datos como texto y los restaura desde ahí.

## Cargos de la noche

Los cargos automáticos se hacen de noche, con el iPhone apagado. El correo de aviso queda esperando y llega a Mail en la mañana, al encender y desbloquear el teléfono. En ese momento Atajos lo envía al buzón.

La app lo tiene en cuenta de tres maneras:

1. **La fecha del cargo es la del aviso, no la de llegada.** Un cargo hecho a las 03:12 aparece a las 03:12, aunque el correo haya llegado a las 07:00. El momento en que llegó se muestra aparte, al tocar el cargo.
2. **El saldo de partida tiene fecha y hora.** Solo descuentan los cargos posteriores a ese momento. Si defines el saldo en la mañana, mirando la app de Copec, los cargos de esa madrugada ya están incluidos en él y no se descuentan otra vez, aunque su aviso llegue después. Si lo miraste la noche anterior, indica esa fecha y hora, y los cargos de la noche sí se descuentan.
3. **Con la app abierta, el buzón se relee solo.** Los correos de la noche llegan de a poco al encender el iPhone. La app relee el buzón cada minuto durante los primeros diez minutos y después cada cinco, así los cargos aparecen sin tocar nada.

El aviso de Copec Pay trae siempre la fecha y la hora del cargo. Si alguna vez llegara incompleto, esto es lo que se registra:

| El aviso trae | Qué se registra |
| --- | --- |
| Fecha y hora | Esa fecha y esa hora. |
| Fecha, sin hora | Esa fecha. Si el aviso llegó ese mismo día, el cargo se ordena al comienzo del día (madrugada); si llegó al día siguiente, al final (noche anterior). En la lista aparece sin hora. |
| Hora, sin fecha | Esa hora, en el día de llegada o en el anterior si esa hora todavía no había pasado. |
| Ni fecha ni hora | El momento en que el aviso llegó al buzón, marcado como «Hora del aviso». Si el cargo fue la noche anterior, la fecha se corrige tocando el cargo. |

## Formato del aviso

Los avisos llegan desde `mensajeria@copecpay.cl`. Este es el correo de una compra en bip!:

```
Tu compra en Carga bip! se realizó con éxito
Monto
$815
Cuenta origen:
Cuenta Vista
****0000
Copec Pay
N° transacción:
000000
Fecha y hora:
2026-10-11 01:01:34
```

De cada aviso la app toma:

- el **monto** (`$815`), que es lo que se descuenta del saldo;
- la **fecha y la hora** del cargo (`2026-10-11 01:01:34`), que son las que se registran;
- el **número de transacción**, que identifica el cargo: el mismo correo nunca se registra dos veces, y dos viajes del mismo valor en el mismo minuto son dos cargos distintos;
- el **comercio** (`Carga bip!`), que queda como nombre del movimiento.

Funciona con el texto plano o con el correo en HTML, con los datos en líneas separadas o en una sola, y también si el correo llega codificado (con `=C3=A9` y líneas cortadas con `=`, o en base64).

Desde noviembre de 2026 el correo de una carga automática tiene otro formato. La app lo lee igual y nombra el cargo con quien usa la tarjeta (`Carga bip! · Pablo`, `Carga bip! · Piti`):

```
¡Hola Pablo!,
Hemos cargado tu tarjeta bip! automáticamente
Monto
$585
Fecha y Hora
2026-11-15 01:00:54
Tarjeta Bip
Pablo - 00000000
Código de Transacción
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Método de pago
Copec Pay **** **** **** 0000
```

### Dos correos por cada carga de bip!

Por cada carga automática de bip!, `mensajeria@copecpay.cl` manda **dos** correos, casi siempre juntos:

| Correo | Número de transacción | Ejemplo |
| --- | --- | --- |
| «¡Hola Pablo! Hemos cargado tu tarjeta bip! automáticamente» | «Código de Transacción», con letras y dígitos | `1Xsrr34…` |
| «Tu compra en Carga bip! se realizó con éxito» | «N° transacción», solo dígitos | `845067` |

Tienen números de transacción distintos, pero son **el mismo cargo**: el mismo monto, con uno o dos minutos de diferencia. La app los cuenta una sola vez: dos avisos de formatos distintos, del mismo monto y con 5 minutos o menos entre uno y otro, son el mismo cargo. Se queda el que dice de quién es la tarjeta («Carga bip! · Pablo»), y la clave del otro correo queda anotada en él (`twin`), para que el buzón no lo vuelva a agregar. En **Buzón y atajo** el segundo aparece como «Segundo correo del mismo cargo».

Si llegan dos cargas del mismo monto en pocos minutos (por ejemplo, una para cada tarjeta), cada «Hemos cargado» se empareja con un solo «Tu compra», así que se cuentan las dos.

La versión del 15 de noviembre de 2026 contaba los dos correos. Al abrir la app, esos cargos repetidos se quitan solos (se queda el registrado primero) y la app avisa cuántos quitó.

### Varios correos en un mismo issue

Cada correo trae un solo aviso. Pero cuando llegan varios juntos (los cargos de la noche, al encender el iPhone), Atajos los envía todos en un mismo issue, uno a continuación del otro, y a veces junto con otros correos que llegaron al mismo tiempo (publicidad). La app separa el issue en un correo por cada saludo o encabezado («¡Hola Pablo!», «Tu compra en…», «Hemos cargado…») y registra un cargo por cada aviso de Copec Pay. En **Buzón y atajo** aparecen como «correo 1 de 2», «correo 2 de 2». El widget y el panel hacen lo mismo.

### Qué cuenta y qué no

Cuenta todo aviso de cargo de Copec Pay, con cualquier asunto. Un aviso de Copec Pay se reconoce por sus señas: «Copec Pay», «Cuenta Vista», «N° transacción» o «Código de Transacción». El monto es el que va con el rótulo «Monto», aunque el texto pegado de otro correo traiga otros precios, y el nombre sale del propio aviso.

No se registran solos:

- el **texto de otros correos** que llegaron pegados en el mismo issue: aparece como «Correo que no es de Copec Pay»;
- una **compra que no se pudo realizar**: no descuenta;
- una **devolución o abono**: se anota a mano con **Abono**; la app avisa cuando llega uno.

Hasta noviembre de 2026 contaban solo los correos con «bip» en el asunto.

En **Buzón y atajo** se ve qué hizo la app con cada correo y el texto de los que no reconoció. El lector está al comienzo del código de `index.html`, en la sección «Lector de los avisos de Copec Pay»; además de los formatos de arriba, tolera variantes (fecha como `10/10/2026`, datos con rótulos como `Comercio:`), por si Copec Pay cambia el correo. Cuando el lector cambia, se sube el número `READER` y la app repasa el buzón completo una vez.

## Capturar los correos de la app Mail

iOS no permite que una app web lea el correo ni reciba datos de otras apps mientras está cerrada. Para que los cargos aparezcan sin hacer nada, cada aviso pasa por un buzón en internet:

1. El correo de Copec Pay llega a Mail.
2. Una automatización de **Atajos** lo envía al buzón: un repositorio **privado** de GitHub, donde cada correo queda como un *issue*.
3. La app lee el buzón al abrirse (y mientras está abierta) y agrega los cargos nuevos.

El buzón de Copec es propio (`copec-avisos`) y distinto del de FAN y Master, para que los avisos de Copec Pay no se mezclen con los del banco. Se configura una sola vez, en tres partes.

### 1. Crear el buzón en GitHub

1. Crea un repositorio nuevo, **privado**, llamado `copec-avisos`.
2. Ve a **Settings → Developer settings → Personal access tokens → Fine-grained tokens** y toca **Generate new token**.
3. Ponle un nombre (por ejemplo `Copec`) y elige la expiración. Cuando el token venza habrá que crear otro y volver a conectarlo.
4. En **Repository access** elige **Only select repositories** y marca `copec-avisos`.
5. En **Permissions**, da a **Issues** el acceso **Read and write**.
6. Toca **Generate token** y copia el token. GitHub lo muestra una sola vez.

### 2. Conectar la app

1. En Copec, toca **Conectar buzón**.
2. Escribe el repositorio (`tu-usuario/copec-avisos`) y pega el token.
3. Toca **Probar y conectar**. La app muestra entonces los datos para el paso siguiente, con botones para copiarlos.

### 3. Crear la automatización en Atajos

1. Abre **Atajos**, entra a **Automatización** y toca **+**.
2. Elige **Correo electrónico** y en **Remitente** escribe `mensajeria@copecpay.cl`.
3. Deja vacío **El asunto contiene**: cuentan los correos de Copec Pay con cualquier asunto. Deja también **Cualquier cuenta** y **Cualquier destinatario**.
4. Marca **Ejecutar inmediatamente**, toca **Siguiente** y elige **Nueva automatización en blanco**.
5. Toca **Agregar acción**, busca «URL» y elige **Obtener contenido de URL**. En la URL pega `https://api.github.com/repos/tu-usuario/copec-avisos/issues`.
6. Toca **Mostrar más** y en **Método** elige **POST**.
7. En **Encabezados**, agrega uno nuevo con la clave `Authorization` y el valor `Bearer ` seguido del token.
8. En **Solicitar cuerpo** deja **JSON** y agrega dos campos de tipo **Texto**: `title` con el valor `Copec`, y `body` con la variable **Entrada del atajo**.
9. Toca **Listo**.

### Notas

- Los avisos deben llegar a una cuenta agregada en la app Mail del iPhone. Los nombres de las opciones pueden variar un poco según la versión de iOS.
- El token da acceso solo a los *issues* de ese repositorio privado. Queda guardado en Atajos y, dentro de la app, solo en el dispositivo; no entra en los respaldos.
- Cada correo queda como un *issue* aparte. Si en la noche hubo varios cargos, en la mañana llegan varios correos juntos: las primeras veces conviene comprobar, en **Últimos correos del buzón**, que hayan llegado todos.
- Para comprobar que Atajos funciona, mira la pestaña **Issues** del repositorio después de un cargo: debe aparecer un *issue* nuevo con el texto del correo.
- Un cargo eliminado en la app no vuelve a aparecer al leer el buzón. Para recuperarlo, se pega su aviso a mano.
- La lectura del buzón funciona en la app publicada en GitHub Pages. Dentro de Claude, la página no puede llamar a GitHub y los cargos se agregan pegando el aviso.

### Si llega un correo y el cargo no aparece

1. Toca **Actualizar**.
2. Abre **Buzón y atajo** y mira **Últimos correos del buzón**. Ahí están los últimos correos que recibió el buzón, del más reciente al más antiguo, con la hora en que llegaron y lo que la app hizo con cada uno.
3. Si el correo no está en la lista, no llegó al buzón: Atajos no se ejecutó o GitHub rechazó el envío. Un correo que Atajos no envió en su momento no llega después: ese cargo se agrega con **Pegar un aviso**.
4. Si está en la lista, la app dice por qué no lo registró: era el segundo correo de un cargo ya registrado, texto de otro correo que no es de Copec Pay, un abono, un cargo rechazado, un cargo que eliminaste o un correo de bip! que no reconoce como aviso de cargo. En ese último caso muestra el texto del correo.

El botón **Copiar este detalle** copia la lista con el texto de cada correo, para revisar un aviso que la app no reconoce. **Leer todo el buzón ahora** repasa el buzón completo y no solo los correos nuevos.

## Widget en la pantalla de inicio

Muestra el saldo y los tres últimos cargos. Una app web no puede crear widgets en iPhone, así que el widget se hace con **Scriptable**, una app gratuita que dibuja widgets a partir de un script.

1. Instala **Scriptable** desde el App Store.
2. En Copec, entra a **Buzón y atajo → Widget en la pantalla de inicio** y toca **Copiar el script del widget**. El script va completo, con el buzón y el token.
3. Abre Scriptable, toca **+** y pega el script. Toca el título de arriba, nómbralo **Copec** y ejecútalo con **▶**: debe mostrar el saldo.
4. En la pantalla de inicio, mantén presionado un espacio vacío, toca **Editar → Agregar widget**, busca **Scriptable** y elige el tamaño mediano.
5. Mantén presionado el widget nuevo, toca **Editar widget** y en **Script** elige **Copec**.

Cómo funciona:

- Al activarlo, la app publica el saldo y los últimos cargos en un hito (*milestone*) del repositorio privado del buzón. El script los lee y les descuenta los cargos que llegaron al buzón después.
- Así el widget se pone al día solo en la mañana: cuando Atajos envía los correos de la noche, el widget descuenta esos cargos aunque no abras la app. Sigue las mismas reglas de la app: solo avisos de Copec Pay, cada cargo una vez (aunque lleguen sus dos correos) y nada anterior al saldo de partida.
- El widget lee los correos con el mismo lector de la app, copiado tal cual en el script. Si se cambia el lector, se vuelve a armar el script con `python3 widget/armar-widget.py` y se copia de nuevo en Scriptable.
- iOS decide cada cuánto actualiza el widget, normalmente cada varios minutos. No es instantáneo.
- Los abonos y los ajustes de saldo solo existen dentro de la app: el widget los refleja después de abrirla.
- Al tocar el widget se abre Scriptable, no la app: iOS no permite abrir una app web instalada desde un widget.
- También sirve en tamaño pequeño y en la pantalla bloqueada (rectangular).
- **Desactivar el widget**, en la misma sección de la app, deja de publicar y borra lo publicado.

## Panel con las cuatro cuentas

Un widget grande, con los colores de Copec, que reúne las cuatro apps domésticas. De cada cuenta muestra el total y los tres últimos movimientos:

| Cuenta | Total que muestra |
| --- | --- |
| Copec | Saldo disponible de la cuenta Copec Pay |
| FAN | Saldo disponible de la cuenta bancaria |
| Master | Deuda a pagar este mes (sin las cuotas que vencen después) |
| LiderBCI | Total del periodo de facturación (LiderBCI no lleva cupo ni saldo) |

Instalación:

1. Revisa que en Scriptable estén los scripts de los widgets de Copec, FAN, Master y LiderBCI. No hace falta que estén en la pantalla de inicio.
2. En Copec, entra a **Buzón y atajo → Panel con las cuatro cuentas** y toca **Copiar el script del panel**.
3. Abre Scriptable, toca **+** y pega el script. Nómbralo **Cuentas** y ejecútalo con **▶**: debe mostrar las cuatro cuentas. Si falta alguna, avisa cuál.
4. En la pantalla de inicio, mantén presionado un espacio vacío, toca **Editar → Agregar widget**, busca **Scriptable** y elige el tamaño **grande**.
5. Mantén presionado el widget nuevo, toca **Editar widget** y en **Script** elige **Cuentas**.

Cómo funciona:

- El script del panel no lleva tokens. Busca en Scriptable los scripts de los cuatro widgets (los reconoce por su contenido, no por su nombre) y toma de ellos el buzón y el token. Lo encontrado queda guardado en el llavero del iPhone, por si después se borra un script. Si un script trae un token nuevo, el panel usa ese.
- Cada cuenta se calcula igual que en su propio widget: lo que publicó la app más los avisos que llegaron al buzón después. Copec descuenta los cargos de la noche, FAN las compras con cargo a la cuenta y Master suma las compras con la tarjeta.
- Si una cuenta no se puede leer, muestra lo último que se leyó, marcado «sin conexión», y las demás siguen al día.
- En iPhone el tamaño grande es el más grande que permite iOS; ningún widget ocupa la pantalla completa. En tamaño mediano muestra los cuatro totales con el último movimiento, en pequeño solo los totales y en la pantalla bloqueada los cuatro totales en dos líneas.
- El lector de Copec se copia en el panel con `python3 widget/armar-widget.py`, igual que en el widget de Copec. Los lectores de FAN y Master están copiados de sus widgets: si alguno cambia, hay que copiarlo también en `widget/panel-widget.js`.

## Instalar en el iPhone

1. En GitHub, ve a **Settings → Pages** y publica la rama `main` desde la raíz (`/`). La app queda en `https://pablocarvallo.github.io/copec/`.
2. Abre esa dirección en **Safari** en el iPhone.
3. Toca **Compartir → Añadir a pantalla de inicio**.

Se abre como app independiente, con su icono, y funciona sin conexión.

## Archivos

| Archivo | Uso |
| --- | --- |
| `index.html` | La app completa (HTML, CSS y JavaScript sin dependencias de compilación) |
| `manifest.webmanifest` | Nombre, colores e iconos de la app instalada |
| `sw.js` | Service worker para uso sin conexión |
| `icons/icon-full.svg` | Icono original a pantalla completa (fuente de los PNG) |
| `icons/icon.svg` | Icono con esquinas redondeadas (favicon) |
| `icons/apple-touch-icon.png` | Icono de 180 px para la pantalla de inicio del iPhone |
| `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-1024.png` | Iconos del manifiesto y archivo de alta resolución |
| `widget/copec-widget.js` | Script del widget para la app Scriptable (la app lo entrega completo con el botón de copiar) |
| `widget/panel-widget.js` | Script del panel con las cuatro cuentas para Scriptable (la app lo entrega con «Copiar el script del panel») |
| `widget/armar-widget.py` | Copia el lector de `index.html` en los scripts del widget y del panel, y guarda ambos scripts dentro de la app |

## Datos

Los movimientos y el saldo quedan en el `localStorage` del navegador, en el dispositivo. Este repositorio solo contiene el código de la app. Los correos de Copec Pay pasan por el buzón, que es un repositorio privado aparte.

- `copec-movimientos`: cada movimiento con tipo (`c` cargo, `d` abono), fecha (`date`), hora (`time`), descripción (`desc`), monto en pesos (`amount`) y origen (`mail` o `manual`). Los cargos leídos de un aviso guardan además la clave que evita duplicados (`key`), cuándo llegó el aviso al buzón (`rcv`), si el aviso venía sin hora (`nt`) o sin fecha (`est`), el comienzo del texto del correo (`raw`), el formato del correo (`fmt`: `h` para «Hemos cargado…», `t` para «Tu compra…») y la clave del otro correo del mismo cargo (`twin`).
- `copec-cuenta`: el saldo de partida (`amount`), desde cuándo rige (`at`) y los avisos eliminados a propósito (`ignored`).
- `copec-preferencias`: orden del listado, repositorio y token del buzón, momento de la última lectura y si el widget está activado.

El saldo que se muestra es el saldo de partida más los movimientos posteriores a su fecha y hora. Los movimientos anteriores quedan como historial y no lo cambian.

## Icono

El icono toma los colores de Copec Pay: azul eléctrico con acento verde. Es un diseño propio, una «c» blanca con una moneda verde, y no reproduce el logotipo de Copec ni el de Copec Pay, que pertenecen a sus dueños.
