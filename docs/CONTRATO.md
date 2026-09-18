# El contrato de un conector

> **Provisional.** La definición común de conector se cierra en [arkanaio/alma#364](https://github.com/arkanaio/alma/issues/364). Hasta entonces, este documento y el paquete `contrato/` son la referencia de trabajo de este repositorio. Los cambios incompatibles se anuncian en [CONTRIBUTING.md](../CONTRIBUTING.md).

## Qué es un conector

Una pieza que **sabe hablar con un proveedor concreto y no sabe nada más**. No conoce organizaciones, no tiene acceso a la base de datos, no sabe cómo se audita un cambio. Recibe una configuración validada y una credencial, consulta al proveedor y entrega los datos con un formato ya acordado.

Esa frontera no es una preferencia de estilo. Es lo que permite aceptar aportaciones externas: revisar una pieza que solo puede hablar con el proveedor declarado y devolver un formato conocido es una tarea acotada.

## Capacidades

Un conector declara una o varias:

| Capacidad | Qué sincroniza | A qué alimenta en ALMA |
|---|---|---|
| `directorio` | La lista de empleados de la organización | Altas y bajas automáticas de empleados |
| `dispositivos` | El inventario de equipos gestionados por el proveedor | Inventario de material |
| `licencias` | Contratos y puestos ocupados | Inventario de licencias y control de costes |

Un proveedor como Slack o Figma declararía solo `licencias`. Google Workspace declara `directorio` y `licencias`. Mosyle declara solo `dispositivos`.

Este repositorio arranca con la capacidad `licencias`, que es donde hay más proveedores reales esperando. `directorio` y `dispositivos` reutilizarán exactamente este mismo contrato.

## El manifiesto

La ficha con la que ALMA presenta el conector al cliente.

```ts
{
  id: "ejemplo",                      // slug, estable para siempre
  nombre: "Proveedor de ejemplo",
  descripcion: "...",
  documentacion: "https://...",
  capacidades: ["licencias"],
  soporte: "oficial",                 // "oficial" | "comunidad" | "navegador"
  dominios: ["api.ejemplo.test"],     // compromiso, no sugerencia
  configuracion: [ /* campos que rellena la organización */ ],
  exponePrecioPorPuesto: true,
  actividad: { soportada: false },
}
```

`soporte` se muestra tal cual al cliente para que sepa qué tiene instalado. Una aportación externa es `comunidad`.

`dominios` es la lista cerrada de máquinas con las que el conector puede hablar. El anfitrión la aplica: una petición a cualquier otra máquina es un fallo de ejecución, no una decisión del conector.

## Qué recibe al ejecutarse

```ts
type ContextoDeEjecucion<Configuracion> = {
  configuracion: Configuracion;
  credencial: Readonly<Record<string, string>>;
  solicitar: (entrada: SolicitudSaliente) => Promise<Response>;
  registrar: (mensaje: string, datos?: Record<string, string | number>) => void;
  cancelacion: AbortSignal;
};
```

Eso es todo. No hay cliente de base de datos, ni identificador de organización, ni `fetch` global disponible. **Si algo no está en el contexto, el conector no lo tiene.**

- `solicitar` es la única salida a la red. Aplica los dominios declarados, los tiempos de espera y los límites de tamaño.
- `credencial` llega descifrada. No se registra, no se devuelve y no se reenvía a ninguna parte.
- `registrar` es para trazas técnicas: números y estados. Nunca datos personales ni credenciales.
- `cancelacion` se dispara cuando el anfitrión aborta la sincronización. Respétala en bucles largos.

## Qué devuelve la capacidad de licencias

Dos lecturas paginadas y ninguna escritura.

```ts
verificarAcceso(contexto): Promise<void>
listarContratos(contexto, continuacion): Promise<Pagina<ContratoDeLicencia, C>>
listarPuestos(contexto, continuacion): Promise<Pagina<PuestoDeLicencia, C>>
```

Un **contrato** es lo que la organización paga: producto, plan, puestos totales, precio por puesto, ciclo de facturación y fecha de renovación. Lo que el proveedor no dé, va a `null`.

Un **puesto** es una cuenta que ocupa una plaza de ese contrato: identificador externo, contrato al que pertenece, correo, nombre mostrado, estado y, opcionalmente, última actividad.

El conector **no clasifica** los puestos. No decide si una cuenta es huérfana: entrega la cuenta tal cual y la conciliación la hace ALMA, que es quien conoce a los empleados de la organización. Esa conciliación —ocupado por un empleado conocido, huérfano, o empleado sin cuenta detectada— es justo donde está el valor del producto, y depende de datos que el conector no tiene ni debe tener.

## Errores

Distingue dos clases, porque el anfitrión hace cosas distintas con ellas:

- **No reintentable.** La credencial ha sido rechazada, la configuración no es válida, el proveedor devuelve algo que no encaja con su propio contrato. ALMA deja la conexión marcada como «requiere reautenticación» en vez de seguir fallando en silencio.
- **Reintentable.** Cuota agotada (429) o fallo temporal del proveedor (5xx). ALMA lo reintenta más tarde.

Ante una respuesta que no encaja con el esquema, falla. Nunca produzcas datos incorrectos guardados en silencio: es peor que no sincronizar.

## Lo que un conector no puede hacer, nunca

- Acceder directamente a la base de datos del producto.
- Decidir a qué organización pertenece un dato: siempre recibe ese contexto ya resuelto.
- Comunicarse con cualquier dirección que no sea la del proveedor que declara servir.
- Ver la credencial de otra integración, ni entregar la suya propia de vuelta al cliente.
- Escribir en el proveedor.

## Ver también

- [ACTIVIDAD.md](ACTIVIDAD.md) — la capacidad opcional de última actividad.
- [DATOS-DE-EJEMPLO.md](DATOS-DE-EJEMPLO.md) — cómo se prueba todo esto sin un proveedor real.
- `conectores/ejemplo/` — el contrato entero, ejecutable.
