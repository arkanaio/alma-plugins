# Guía de contribución

Gracias por querer añadir un conector a ALMA. Esta guía dice qué se espera de una aportación y cómo se revisa.

Antes de escribir código, lee [docs/CONTRATO.md](docs/CONTRATO.md). Casi todo lo que se rechaza en revisión es código que no respeta la frontera del conector, y esa frontera es lo único que hace viable aceptar aportaciones externas: revisar una pieza que solo puede hablar con el proveedor que declara y devolver un formato conocido es rápido; revisar una pieza que pudiera tocar la base de datos no lo sería a ningún precio.

## Antes de empezar

1. **Abre una issue de propuesta** con la plantilla «Proponer un conector nuevo». Se acuerda ahí el proveedor, sus capacidades y si hay un cliente real esperándolo. Un conector que llega sin propuesta previa puede quedarse sin revisar mucho tiempo.
2. Comprueba que el proveedor ofrece una **vía programática** (API) para lo que quieres sincronizar. Si no la tiene, el camino no es este repositorio todavía: es la fase de conectores por automatización de navegador, que tiene otras reglas y otro nivel de soporte.
3. Mientras [arkanaio/alma#364](https://github.com/arkanaio/alma/issues/364) y [arkanaio/alma#366](https://github.com/arkanaio/alma/issues/366) sigan abiertas, el contrato puede cambiar. Los cambios incompatibles se anuncian aquí, en la sección «Cambios del contrato», antes de aplicarse.

## Requisitos de una aportación

Un conector se acepta cuando cumple **todo** lo siguiente.

### Estructura

Copia `conectores/ejemplo/` y renómbralo con el identificador de tu proveedor:

```
conectores/<proveedor>/
├── README.md                 # qué sincroniza, qué credencial pide, sus límites
├── package.json
├── src/
│   ├── manifiesto.ts         # la ficha que ALMA enseña al cliente
│   ├── esquemas.ts           # configuración y respuestas del proveedor, en Zod
│   └── conector.ts           # la implementación
├── datos-de-ejemplo/         # respuestas reales anonimizadas del proveedor
└── tests/
```

### Manifiesto

Declara el nombre, la descripción, el enlace a la documentación, las capacidades (`directorio`, `dispositivos`, `licencias`), el nivel de soporte, los dominios con los que habla, qué necesita la organización para configurarlo y si expone precio por puesto. El nivel de soporte de una aportación externa es `comunidad`, y se le muestra tal cual al cliente para que sepa qué tiene.

Los `dominios` son un compromiso: el anfitrión rechaza cualquier petición a una máquina que no esté en esa lista. Declara los que realmente necesitas y ninguno más.

### Lo que un conector no puede hacer, nunca

- Acceder a la base de datos de ALMA, ni directamente ni a través de nada.
- Decidir a qué organización pertenece un dato. Siempre recibe ese contexto ya resuelto.
- Hablar con cualquier dirección que no sea la del proveedor que declara servir. Usa `contexto.solicitar`; no uses `fetch` global, ni `node:http`, ni un SDK que abra sus propias conexiones.
- Leer variables de entorno, ficheros del disco o el reloj del sistema para tomar decisiones de negocio.
- Ver la credencial de otra integración, ni devolver la suya propia al cliente, ni escribirla en una traza.
- Escribir en el proveedor. Un conector lee. No crea, no modifica y no borra nada en el sistema del proveedor.
- Añadir dependencias sin justificarlas. Cada dependencia nueva es superficie que hay que revisar, y se pregunta por ella en la revisión.

### Datos

- **Valida toda respuesta del proveedor con Zod** antes de que su contenido llegue a ninguna otra parte del conector. Una respuesta que cambia de forma tiene que fallar ahí, no producir datos incorrectos más adelante.
- **No inventes datos.** Si el proveedor no da un valor, devuelve `null`. Un importe sin moneda se descarta entero en vez de suponer la moneda de la organización.
- **No clasifiques.** El conector entrega las cuentas tal cual; decidir si un puesto es huérfano es trabajo de ALMA, que es quien conoce a los empleados.
- **Pagina.** Nunca cargues el catálogo entero en memoria.
- **Distingue los errores.** Una credencial rechazada por el proveedor no se reintenta y deja la conexión en «requiere reautenticación»; un 429 o un 5xx sí es reintentable.
- **Las trazas cuentan, no describen.** `contexto.registrar` sirve para números y estados. Nunca correos, nombres, identificadores personales, credenciales ni valores de actividad.

### Última actividad

Es una capacidad **opcional**. Un conector de licencias que sincroniza contratos y puestos sin ofrecer actividad es perfectamente válido y se acepta igual.

Si la declaras, tienes que documentar qué mide el proveedor y dónde deja de medir, y respetar reglas concretas sobre el dato. Están en [docs/ACTIVIDAD.md](docs/ACTIVIDAD.md) y se revisan una por una. Resumido: la fecha de sincronización, la de asignación o un acceso genérico a la cuenta **no** son uso de una licencia y no valen como sustituto; sin dato se devuelve ausencia de información, nunca inactividad inferida.

### Pruebas

Las pruebas de un conector se ejecutan **sin conectarse a ningún proveedor real**, contra los datos de ejemplo del propio conector. Ver [docs/DATOS-DE-EJEMPLO.md](docs/DATOS-DE-EJEMPLO.md).

Como mínimo hay que cubrir: que el manifiesto es válido y coherente con el esquema de configuración, el recorrido completo de la paginación, un valor ausente del proveedor, una credencial rechazada, un fallo temporal del proveedor, una respuesta con una forma inesperada, que solo se habla con los dominios declarados y que la traza no filtra datos personales. `conectores/ejemplo/tests/conector.test.ts` tiene una de cada.

### Documentación

El `README.md` del conector explica, en castellano y sin tecnicismos innecesarios: qué sincroniza, qué credencial hay que crear en el proveedor y con qué permisos, qué permisos **no** hace falta conceder, y sus límites conocidos (cuotas, retardos, campos que el proveedor no ofrece).

## Cómo se envía

1. Bifurca el repositorio y trabaja en una rama.
2. Ejecuta `pnpm verificar` antes de abrir el PR. CI ejecuta exactamente lo mismo.
3. Abre el PR y completa la plantilla. La sección de seguridad no es una formalidad: es lo primero que se lee.
4. Un PR que cambia `contrato/` o la configuración del repositorio se revisa aparte del conector que lo motivó. Sepáralos.

## Cómo se revisa

Toda aportación pasa, en este orden:

1. **Pruebas automáticas** en CI contra los datos de ejemplo.
2. **Revisión humana de seguridad**, con la lista de [docs/REVISION-SEGURIDAD.md](docs/REVISION-SEGURIDAD.md). Es obligatoria y ningún conector se publica sin ella, tampoco los de arkana.
3. **Publicación de una versión** concreta, que es la que ALMA incorpora a su despliegue. Ver [docs/PUBLICACION.md](docs/PUBLICACION.md).

La revisión de seguridad puede pedir cambios que no son defectos de funcionamiento: reducir dependencias, estrechar dominios, quitar un campo de una traza. No es desconfianza hacia quien aporta; es que el coste de equivocarse aquí lo paga un cliente.

## Idioma

El código, los comentarios, la documentación y los mensajes de commit se escriben en castellano. Los identificadores que vienen del proveedor se dejan como el proveedor los llama.

## Cambios del contrato

Los cambios incompatibles de `contrato/` se anuncian aquí antes de aplicarse, con la fecha y qué hay que tocar en un conector existente.

- Sin cambios todavía. El contrato inicial es provisional hasta que cierre [arkanaio/alma#364](https://github.com/arkanaio/alma/issues/364).

## Seguridad

Si encuentras un problema de seguridad, **no abras una issue**. Sigue [SECURITY.md](SECURITY.md).
