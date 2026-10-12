# Copec

App personal para llevar el saldo de la cuenta Copec Pay: lee los avisos de compra en bip! que Copec Pay envía por correo, guarda fecha, hora y monto, descuenta cada cargo del saldo y permite anotar a mano los abonos.

Es un registro personal. No es la app oficial de Copec ni está conectada a la cuenta.

## Qué hace

- **Saldo de la cuenta**: se parte ingresando el saldo inicial, el que muestra la app de Copec, junto con la fecha y la hora de ese saldo. Desde ahí cada cargo lo descuenta y cada abono lo suma. Con **Ajustar** se vuelve a cuadrar cuando haga falta.
- **Lectura automática**: una automatización de Atajos envía cada correo de bip! de Copec Pay, apenas llega a Mail, a un buzón privado en GitHub. La app lee ese buzón al abrirse y agrega solo los cargos que falten. Un mismo aviso nunca se registra dos veces.
- **Solo bip!**: cuentan únicamente los correos que traen «bip» en el asunto. Los demás correos de Copec Pay quedan fuera.
- **Cargos de la noche**: los cargos automáticos se hacen de noche y su correo llega recién al encender el iPhone. La app registra cada cargo con la fecha y la hora que trae el aviso, no con la hora en que llegó el correo. Ver [Cargos de la noche](#cargos-de-la-noche).
- **Abono**: anota a mano un abono con monto, descripción, fecha y hora. La misma hoja permite anotar un cargo que no llegó por correo.
- **Pegar un aviso**: alternativa sin configuración. Se copia el texto del correo, se pega en la app y esta extrae los datos.
- **Movimientos**: todos los cargos y abonos, con el saldo que dejó cada uno. Se pueden filtrar (todos, cargos, abonos) y ordenar. Al tocar un movimiento se corrige, se renombra o se elimina. En un cargo leído de un aviso se puede ver el texto original del correo.
- **Widget**: el saldo y los tres últimos cargos en la pantalla de inicio o la pantalla bloqueada, con la app Scriptable. Ver [Widget en la pantalla de inicio](#widget-en-la-pantalla-de-inicio).
- **Datos y respaldo**: copia todos los datos como texto y los restaura desde ahí.

## Cargos de la noche

Los cargos automáticos se hacen de noche, con el iPhone apagado. El correo de aviso queda esperando y llega a Mail en la mañana, al encender y desbloquear el teléfono. En ese momento Atajos lo envía al buzón.

La app lo tiene en cuenta de tres maneras:

1. **La fecha del cargo es la del aviso, no la de llegada.** Un cargo hecho a las 03:12 aparece a las 03:12, aunque el correo haya llegado a las 07:00. El momento en que llegó se muestra aparte, al tocar el cargo.
2. **El saldo de partida tiene fecha y hora.** Solo descuentan los cargos posteriores a ese momento. Si defines el saldo en la mañana, mirando la app de Copec, los cargos de esa madrugada ya están incluidos en él y no se descuentan otra vez, aunque su aviso llegue después. Si lo miraste la noche anterior, indica esa fecha y hora, y los cargos de la noche sí se descuentan.
3. **Con la app abierta, el buzón se relee solo.** Los correos de la noche llegan de a poco al encender el iPhone. La app relee el buzón cada minuto durante los primeros diez minutos y después cada cinco, así los cargos aparecen sin tocar nada.

El correo de bip! trae siempre la fecha y la hora del cargo. Si alguna vez llegara incompleto, esto es lo que se registra:

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

### Solo los correos de bip!

La app considera únicamente los correos que traen «bip» en el asunto. El filtro se aplica dos veces:

1. **En Atajos**, con la condición **El asunto contiene** `bip`: los correos de otro asunto ni siquiera se envían al buzón.
2. **En la app**, que revisa el encabezado del aviso (lo que va antes del monto, donde está el asunto: «Tu compra en Carga bip!…»). Si ahí no dice «bip», el correo se deja fuera aunque haya llegado al buzón. Una mención de bip! en la letra chica de otro correo no cuenta.

Tampoco se registran solos:

- una **compra en bip! que no se pudo realizar**: no descuenta;
- una **devolución o abono** relacionado con bip!: se anota a mano con **Abono**; la app avisa cuando llega uno.

En **Buzón y atajo** se ve qué hizo la app con cada correo y el texto de los que no reconoció. El lector está al comienzo del código de `index.html`, en la sección «Lector de los avisos de Copec Pay»; además del formato de arriba, tolera variantes (fecha como `10/10/2026`, datos con rótulos como `Comercio:`), por si Copec Pay cambia el correo. Cuando el lector cambia, se sube el número `READER` y la app repasa el buzón completo una vez.

## Capturar los correos de la app Mail

iOS no permite que una app web lea el correo ni reciba datos de otras apps mientras está cerrada. Para que los cargos aparezcan sin hacer nada, cada aviso pasa por un buzón en internet:

1. El correo de bip! de Copec Pay llega a Mail.
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
3. En **El asunto contiene** escribe `bip`: solo esos correos se envían al buzón. En **Cuenta** elige **iCloud**, que es donde llegan. Deja vacío **Destinatario**.
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
3. Si el correo no está en la lista, no llegó al buzón: su asunto no decía «bip», Atajos no se ejecutó o GitHub rechazó el envío. Un correo que Atajos no envió en su momento no llega después: ese cargo se agrega con **Pegar un aviso**.
4. Si está en la lista, la app dice por qué no lo registró: era un correo de otro asunto, un abono, un cargo rechazado, un cargo que eliminaste o un correo de bip! que no reconoce como aviso de cargo. En ese último caso muestra el texto del correo.

El botón **Copiar este detalle** copia la lista con el texto de cada correo, para revisar un aviso que la app no reconoce. **Leer todo el buzón ahora** repasa el buzón completo y no solo los correos nuevos.

## Widget en la pantalla de inicio

Muestra el saldo y los tres últimos cargos de bip!. Una app web no puede crear widgets en iPhone, así que el widget se hace con **Scriptable**, una app gratuita que dibuja widgets a partir de un script.

1. Instala **Scriptable** desde el App Store.
2. En Copec, entra a **Buzón y atajo → Widget en la pantalla de inicio** y toca **Copiar el script del widget**. El script va completo, con el buzón y el token.
3. Abre Scriptable, toca **+** y pega el script. Toca el título de arriba, nómbralo **Copec** y ejecútalo con **▶**: debe mostrar el saldo.
4. En la pantalla de inicio, mantén presionado un espacio vacío, toca **Editar → Agregar widget**, busca **Scriptable** y elige el tamaño mediano.
5. Mantén presionado el widget nuevo, toca **Editar widget** y en **Script** elige **Copec**.

Cómo funciona:

- Al activarlo, la app publica el saldo y los últimos cargos en un hito (*milestone*) del repositorio privado del buzón. El script los lee y les descuenta los cargos de bip! que llegaron al buzón después.
- Así el widget se pone al día solo en la mañana: cuando Atajos envía los correos de la noche, el widget descuenta esos cargos aunque no abras la app. Sigue las mismas reglas de la app: solo correos de bip!, cada cargo una vez y nada anterior al saldo de partida.
- El widget lee los correos con el mismo lector de la app, copiado tal cual en el script. Si se cambia el lector, se vuelve a armar el script con `python3 widget/armar-widget.py` y se copia de nuevo en Scriptable.
- iOS decide cada cuánto actualiza el widget, normalmente cada varios minutos. No es instantáneo.
- Los abonos y los ajustes de saldo solo existen dentro de la app: el widget los refleja después de abrirla.
- Al tocar el widget se abre Scriptable, no la app: iOS no permite abrir una app web instalada desde un widget.
- También sirve en tamaño pequeño y en la pantalla bloqueada (rectangular).
- **Desactivar el widget**, en la misma sección de la app, deja de publicar y borra lo publicado.

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
| `widget/armar-widget.py` | Copia el lector de `index.html` en el script del widget y guarda el script dentro de la app |

## Datos

Los movimientos y el saldo quedan en el `localStorage` del navegador, en el dispositivo. Este repositorio solo contiene el código de la app. Los correos de Copec Pay pasan por el buzón, que es un repositorio privado aparte.

- `copec-movimientos`: cada movimiento con tipo (`c` cargo, `d` abono), fecha (`date`), hora (`time`), descripción (`desc`), monto en pesos (`amount`) y origen (`mail` o `manual`). Los cargos leídos de un aviso guardan además la clave que evita duplicados (`key`), cuándo llegó el aviso al buzón (`rcv`), si el aviso venía sin hora (`nt`) o sin fecha (`est`) y el comienzo del texto del correo (`raw`).
- `copec-cuenta`: el saldo de partida (`amount`), desde cuándo rige (`at`) y los avisos eliminados a propósito (`ignored`).
- `copec-preferencias`: orden del listado, repositorio y token del buzón, momento de la última lectura y si el widget está activado.

El saldo que se muestra es el saldo de partida más los movimientos posteriores a su fecha y hora. Los movimientos anteriores quedan como historial y no lo cambian.

## Icono

El icono toma los colores de Copec Pay: azul eléctrico con acento verde. Es un diseño propio, una «c» blanca con una moneda verde, y no reproduce el logotipo de Copec ni el de Copec Pay, que pertenecen a sus dueños.
