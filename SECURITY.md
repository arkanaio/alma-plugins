# Política de seguridad

## Comunicar un problema

**No abras una issue pública.**

Usa el aviso privado de vulnerabilidades de GitHub, en la pestaña **Security** de este repositorio («Report a vulnerability»). Si no puedes, escribe a **jaume@arkana.io**.

Incluye:

- Qué conector o qué parte del repositorio está afectada.
- Qué permite hacer el problema.
- Cómo reproducirlo.
- Tu valoración del impacto, si la tienes.

Se acusa recibo en un plazo de 3 días laborables y se informa del estado al menos cada 7 días hasta el cierre. Cuando haya corrección, se publica la versión afectada y la corregida, y se reconoce a quien lo comunicó salvo que prefiera no aparecer.

## Qué entra en esta política

- Un conector que habla con un dominio que no declara en su manifiesto.
- Un conector que filtra una credencial, un dato personal o un valor de actividad en una traza, un error o un valor devuelto.
- Un conector que accede a algo que el contexto de ejecución no le da.
- Un secreto o un dato personal real subido a este repositorio, incluidos los datos de ejemplo.
- Una dependencia comprometida o suplantada.

Un problema en el producto ALMA, no en un conector, va a [arkanaio/alma](https://github.com/arkanaio/alma).

## Qué no entra

- Fallos de funcionamiento sin consecuencia de seguridad. Esos van a una issue normal.
- Vulnerabilidades en el sistema del proveedor. Comunícalas al proveedor.
- Informes generados automáticamente sin comprobar, sin impacto demostrado.

## Antes de subir nada

No subas credenciales, tokens ni datos de personas reales, tampoco en los datos de ejemplo. Un secreto que llega a una rama pública se considera comprometido aunque se borre después: hay que rotarlo.
