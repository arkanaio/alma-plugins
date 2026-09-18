# De este repositorio a producción

> El mecanismo de incorporación en el producto se construye en [arkanaio/alma#367](https://github.com/arkanaio/alma/issues/367). Este documento describe el camino acordado; los detalles de implementación viven allí.

## El camino

1. **Aportación.** Un PR con un conector, siguiendo [CONTRIBUTING.md](../CONTRIBUTING.md).
2. **Pruebas automáticas** en CI, contra los datos de ejemplo. Sin red y sin credenciales.
3. **Revisión humana de seguridad**, con la lista de [REVISION-SEGURIDAD.md](REVISION-SEGURIDAD.md). Obligatoria, también para los conectores de arkana.
4. **Publicación de una versión** concreta del conector.
5. **Incorporación.** ALMA incorpora **esa versión** a su despliegue. No sigue una rama, no se actualiza sola.
6. **Activación.** La organización cliente configura sus credenciales y activa el conector desde el producto.

## Lo que no pasa nunca

Una organización cliente **no instala código**. No sube un conector, no elige una versión, no ejecuta nada suyo dentro de ALMA. Configura credenciales y activa lo que ya está incorporado y revisado.

Esta es la decisión que más riesgo evita. Permitir que una organización suba su propio código para que ALMA lo ejecute exigiría, como mínimo, aislamiento real frente al resto del sistema, verificación de procedencia, límites de recursos, un proceso de cuarentena y un modelo claro de responsabilidad para cuando el conector de un cliente filtre datos de ese mismo cliente. Todo eso es, en sí mismo, otro producto.

Lo que sí se hace desde ahora es **no cerrar la puerta**: el contrato de un conector ya es «datos que entran, datos que salen». Si en el futuro hay demanda real de instalación propia, lo que quedará por hacer es empaquetado y verificación, no un rediseño.

## Versionado

Cada conector se versiona por separado, con versionado semántico:

- **Mayor**: cambia lo que ALMA recibe, o el conector necesita una configuración o una credencial distinta. Obliga a intervenir al incorporarlo.
- **Menor**: campos nuevos, un caso del proveedor que antes no se cubría.
- **Parche**: correcciones que no cambian lo que se recibe.

Un cambio incompatible del **contrato** es otra cosa: se anuncia en [CONTRIBUTING.md](../CONTRIBUTING.md) antes de aplicarse, con qué hay que tocar en un conector existente.

## Qué ve el cliente

El nivel de soporte del conector, tal cual: **oficial**, **aportado por la comunidad** o **basado en automatización de navegador**. No se maquilla. Un cliente tiene derecho a saber quién mantiene la pieza que habla con su proveedor.

## Si un conector deja de funcionar

Un proveedor puede cambiar su API sin avisar. Cuando eso ocurre:

- La sincronización falla con un error claro y **no guarda datos incorrectos en silencio**.
- Si el fallo es de credencial, la conexión queda marcada como «requiere reautenticación» en vez de seguir reintentando.
- La corrección entra por el camino normal: PR, pruebas, revisión y versión nueva.

Un conector sin mantenedor que lleva tiempo roto se marca como no mantenido y se retira de la lista que se ofrece a clientes nuevos, sin romper a quien ya lo tenga activo.
