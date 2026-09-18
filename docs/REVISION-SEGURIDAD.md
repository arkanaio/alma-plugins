# Revisión de seguridad de una aportación

> **Provisional.** El proceso definitivo se fija en [arkanaio/alma#366](https://github.com/arkanaio/alma/issues/366). Esta lista es la que se aplica mientras tanto.

Ninguna aportación se publica sin pasar esta revisión. **Tampoco las de arkana.** Las pruebas automáticas son un filtro previo, no un sustituto: comprueban que el conector hace lo que dice, no que no haga nada más.

La revisión la hace una persona con permiso de escritura en el repositorio, distinta de quien aporta. Su resultado se deja escrito en el PR, con esta lista rellenada.

## Antes de leer el código

- [ ] Existe una issue de propuesta aceptada para este proveedor.
- [ ] El PR trae **un solo conector** y no toca `contrato/`, la configuración del repositorio ni otro conector. Si lo hace, se separa.
- [ ] El manifiesto es válido y su `soporte` es el que corresponde (`comunidad` para una aportación externa).
- [ ] `dominios` contiene solo las máquinas que el proveedor necesita, y son del proveedor. Un dominio de acortador, de analítica, de CDN de terceros o un dominio personal es motivo de rechazo.
- [ ] Los campos de `configuracion` no piden nada que el conector no use.
- [ ] CI está en verde.

## La frontera

- [ ] No hay ninguna importación de base de datos, ORM, cliente HTTP propio, `node:http`, `node:https`, `node:net`, `node:child_process`, `node:fs` ni `node:worker_threads`.
- [ ] Toda salida a la red pasa por `contexto.solicitar`. No hay `fetch` global, ni un SDK del proveedor que abra sus propias conexiones.
- [ ] No se leen variables de entorno ni ficheros del disco.
- [ ] No hay `eval`, `new Function`, importación dinámica con una ruta calculada, ni deserialización de código.
- [ ] El conector no escribe en el proveedor: no hay POST, PUT, PATCH ni DELETE salvo que el proveedor exija POST para una **consulta**, y en ese caso está justificado en el PR.
- [ ] El conector no recibe ni deduce ninguna organización. No hay ningún identificador de organización de ALMA en su código.

## Credenciales

- [ ] La credencial se usa solo para autenticar contra los dominios declarados.
- [ ] La credencial no aparece en ninguna traza, ni en un mensaje de error, ni en una URL, ni en un objeto que se devuelva.
- [ ] Los mensajes de error no incluyen el cuerpo crudo de la respuesta del proveedor, que puede llevar datos o cabeceras.
- [ ] No hay ninguna credencial, token o clave en el repositorio, tampoco en los datos de ejemplo ni en el historial de la rama.

## Datos

- [ ] Toda respuesta del proveedor se valida con Zod antes de usarse.
- [ ] Ningún valor ausente se rellena con una suposición. Un importe sin moneda se descarta entero.
- [ ] El conector no clasifica puestos ni decide si una cuenta es huérfana.
- [ ] La lectura está paginada y no acumula el catálogo entero en memoria.
- [ ] Los errores distinguen reintentable de no reintentable, y una credencial rechazada no se reintenta.
- [ ] Las trazas no contienen correos, nombres, identificadores personales ni valores de actividad.

## Última actividad, si se declara

Aplica la lista completa de [ACTIVIDAD.md](ACTIVIDAD.md). En resumen:

- [ ] `queMide` y `limitaciones` describen el campo real del proveedor.
- [ ] Ninguna fecha de sincronización, asignación o acceso genérico ocupa el lugar del uso.
- [ ] Sin dato se devuelve `null`.
- [ ] `obtenidaEn` se sella en la lectura y no se copia de la fecha del proveedor.
- [ ] El valor no se persiste, ni se cachea, ni se registra.

## Dependencias

- [ ] Cada dependencia nueva está justificada en el PR y no hay una forma razonable de evitarla.
- [ ] Ninguna dependencia nueva ejecuta scripts de instalación.
- [ ] Ninguna dependencia nueva tiene un nombre parecido al de un paquete conocido.
- [ ] El `pnpm-lock.yaml` del PR es consecuencia del `package.json` del PR y no trae cambios no relacionados.

## Datos de ejemplo

- [ ] Están anonimizados: ningún correo, nombre ni identificador de una persona o cliente real.
- [ ] No contienen ningún secreto.
- [ ] Incluyen los casos raros: valor ausente, cuenta suspendida o invitada, más de una página.

## Documentación

- [ ] El `README.md` del conector dice qué credencial hay que crear, con qué permisos y cuáles **no** hacen falta.
- [ ] Están documentados los límites conocidos: cuotas, retardos, campos que el proveedor no ofrece.

## Resultado

La revisión termina con una de tres:

- **Aceptado.** Se publica una versión y ALMA la incorpora. Ver [PUBLICACION.md](PUBLICACION.md).
- **Cambios pedidos.** Con la lista de puntos que no pasan.
- **Rechazado.** Con el motivo. Un rechazo por la frontera del conector no se negocia caso a caso: si el conector necesita algo que el contrato no da, la conversación es sobre el contrato, en una issue.
