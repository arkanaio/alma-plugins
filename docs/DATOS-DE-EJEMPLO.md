# Probar un conector sin conectarse a un proveedor

Ninguna prueba de este repositorio habla con un proveedor real. Ni en tu máquina ni en CI. Un conector se prueba contra **datos de ejemplo** que viajan con él.

Esto no es una comodidad: es lo que permite que cualquiera pueda revisar, reproducir y mantener un conector sin tener una cuenta del proveedor, y que CI pase sin custodiar credenciales de terceros.

## Dónde viven

En `conectores/<proveedor>/datos-de-ejemplo/`, un fichero JSON por recurso del proveedor. Cada fichero es un mapa de cursor a respuesta, de forma que la paginación se pueda recorrer entera:

```json
{
  "": { "subscriptions": [ ... ], "next_cursor": "pagina-2" },
  "pagina-2": { "subscriptions": [ ... ], "next_cursor": null }
}
```

La clave `""` es la primera página.

## Cómo tienen que ser

- **Respuestas reales, anonimizadas.** Cópialas del proveedor y sustituye correos, nombres, identificadores de cuenta y de espacio de trabajo. Usa el dominio `ejemplo.test`, que no es resoluble.
- **Sin ningún secreto.** Ni tokens, ni claves, ni cabeceras de autorización, ni identificadores internos de un cliente. Si dudas, quítalo.
- **Con los casos raros dentro.** Unos datos de ejemplo en los que todo está relleno no prueban nada. Incluye al menos: un campo opcional ausente, un importe sin moneda, una cuenta suspendida o invitada, un puesto sin actividad y más de una página.
- **Sin datos de personas reales.** Tampoco tuyos.

## El anfitrión de pruebas

`conectores/ejemplo/tests/anfitrion.ts` hace lo mismo que hará ALMA al ejecutar el conector: sirve los datos de ejemplo, **rechaza cualquier dominio que no esté en el manifiesto** y deja a la vista las peticiones y las trazas para poder comprobarlas.

Cópialo a tu conector y adáptalo a los recursos de tu proveedor. No lo simplifiques quitando la comprobación de dominios: esa comprobación es media revisión de seguridad hecha por una máquina.

## Qué hay que cubrir como mínimo

Una prueba de cada una de estas, y `conectores/ejemplo/tests/conector.test.ts` tiene un ejemplo de todas:

| Caso | Por qué |
|---|---|
| El manifiesto es válido | Se revisa antes que el código |
| Los campos del manifiesto coinciden con el esquema de configuración | Un campo declarado y no validado es un agujero |
| La paginación se recorre entera | Un conector que se queda en la primera página pierde datos en silencio |
| Un valor ausente del proveedor | Comprueba que devuelve `null` y no un invento |
| Una credencial rechazada | Tiene que ser no reintentable |
| Un fallo temporal del proveedor | Tiene que ser reintentable |
| Una respuesta con otra forma | Tiene que fallar, no producir datos incorrectos |
| Solo se habla con los dominios declarados | El compromiso del manifiesto, comprobado |
| La traza no filtra datos personales | Lo más fácil de colar en una revisión |

## Ejecutar

```sh
pnpm verificar          # todo: Biome, tipos y pruebas
pnpm test               # solo las pruebas
```

CI ejecuta exactamente eso, sin red y sin credenciales.

## Y las pruebas contra el proveedor real

No van en este repositorio. Si necesitas comprobar tu conector contra el proveedor de verdad, hazlo en tu entorno con tus credenciales, y cuenta el resultado en la descripción del PR. Nunca subas una credencial, ni siquiera de pruebas, ni siquiera caducada.
