# La capacidad opcional de última actividad

Recoge la decisión tomada en [arkanaio/alma#409](https://github.com/arkanaio/alma/issues/409). Léela entera antes de declarar esta capacidad.

## Es opcional, y de verdad

Un conector de licencias que sincroniza contratos y puestos **sin ofrecer actividad es completamente válido**. Se acepta igual, se publica igual y el cliente lo usa igual. Muchos proveedores sencillamente no publican este dato, y forzarlo produciría un número inventado, que es peor que no tener ninguno.

No se admite ninguna vía manual para suplirlo: ni pedir la fecha a mano, ni cargas periódicas de ficheros.

## Cómo se declara

En el manifiesto, en el campo `actividad`.

Cuando el proveedor no lo ofrece:

```ts
actividad: { soportada: false }
```

Cuando sí:

```ts
actividad: {
  soportada: true,
  queMide:
    "Ultima vez que la cuenta genero una accion dentro del producto, segun el campo last_active_at del proveedor.",
  limitaciones:
    "Granularidad diaria y hasta 24 horas de retardo. No distingue entre uso real y sesiones abiertas por integraciones.",
}
```

`queMide` y `limitaciones` no son texto de relleno: se revisan y se le enseñan al cliente. Tienen que decir **qué mide exactamente el proveedor** y **dónde deja de medir**.

## Qué no vale como actividad

Ninguna de estas cosas es uso de una licencia, y ninguna puede ocupar el lugar del dato:

- La **fecha de sincronización**. Es cuándo miramos nosotros, no cuándo usó nadie nada.
- La **fecha de asignación** del puesto. Es cuándo se le dio la licencia a alguien.
- Un **acceso genérico a la cuenta**, como un inicio de sesión en el SSO del proveedor o la creación de la cuenta. Entrar en una cuenta no es usar el producto que se está pagando.
- Una **fecha derivada** de cualquiera de las anteriores.

Si el proveedor solo publica una de estas, la capacidad es `{ soportada: false }`. Sustituir el dato por un sucedáneo hace que el informe de puestos pagados sin usar señale a personas por un dato que no significa lo que dice significar.

## Ausencia de información

Sin dato del proveedor, el puesto devuelve `ultimaActividad: null`.

`null` significa **no lo sabemos**, no «no lo usa». No tener información no demuestra falta de uso, y ALMA lo trata así: el informe de puestos pagados sin usar distingue puestos libres de puestos asignados con evidencia de inactividad, y los puestos sin información no se cuentan como inactivos.

Nunca devuelvas una fecha muy antigua, ni el epoch, ni la fecha de creación de la cuenta, para «representar» que no hay dato.

## La fecha del proveedor y el momento de la lectura son dos datos

```ts
ultimaActividad: {
  fechaDelProveedor: "2026-09-16T08:12:00Z",  // lo que dice el proveedor
  obtenidaEn: "2026-09-18T06:30:00Z",         // cuándo lo leímos
}
```

Un fallo de sincronización no convierte un valor anterior en una lectura actual. Por eso el conector sella `obtenidaEn` en el momento de la lectura y nunca lo copia de `fechaDelProveedor`.

## Qué no hace el conector

Estas reglas son de ALMA, no tuyas. Se listan para que quede claro que el conector **no tiene que implementarlas ni puede**:

- La organización **activa expresamente** la recogida, y está desactivada por defecto. Conectar el proveedor no activa nada.
- La finalidad es gestionar la utilización y el coste de las licencias y revisar puestos potencialmente prescindibles; **no** medir productividad, desempeño ni control horario.
- Solo se conserva el **último** dato, mientras la asignación y la recogida sigan activas. Se borra al liberar el puesto, al desactivar la recogida o al desconectar la integración. Una asignación nueva no hereda la actividad de la persona anterior.
- **No se acumula historial**, tampoco a través de auditoría.

Para el conector esto se traduce en una sola regla práctica: **devuelve el dato y no lo guardes en ningún sitio**. No lo escribas en disco, no lo cachees entre ejecuciones y no lo metas en una traza.

## Trazas

`contexto.registrar` no puede recibir valores de actividad, ni correos, ni nombres, ni identificadores personales. Una traza de una página de puestos cuenta cuántos venían; no dice quiénes eran ni cuándo entraron.

```ts
contexto.registrar("Pagina de puestos leida", { puestos: cuerpo.members.length });  // bien
contexto.registrar(`Ultimo acceso de ${correo}: ${fecha}`);                          // se rechaza
```

`conectores/ejemplo/tests/conector.test.ts` tiene una prueba que comprueba justo esto. Cópiala.

## Qué se revisa

En la revisión de seguridad se comprueba, una por una:

- [ ] `queMide` describe el campo real del proveedor, y hay enlace a su documentación.
- [ ] `limitaciones` dice granularidad, retardo y qué casos no cubre.
- [ ] Ninguna fecha de sincronización, asignación o acceso genérico ocupa el lugar del uso.
- [ ] Sin dato se devuelve `null`, nunca una fecha de relleno.
- [ ] `obtenidaEn` se sella en la lectura.
- [ ] El valor no se persiste, ni se cachea, ni aparece en ninguna traza.
- [ ] Hay una prueba con un puesto sin actividad y otra de que la traza no filtra el valor.
