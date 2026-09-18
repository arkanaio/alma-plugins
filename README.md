# alma-plugins

Repositorio oficial de conectores de proveedor de [ALMA](https://github.com/arkanaio/alma).

Un **conector** es una pieza que sabe hablar con un proveedor concreto y no sabe nada más. Recibe una configuración validada y una credencial, consulta al proveedor y devuelve los datos con un formato acordado. No conoce organizaciones, no tiene acceso a la base de datos de ALMA y no decide a quién pertenece un dato.

En este repositorio «conector» y «plugin» son la misma cosa. El nombre del repositorio conserva el término «plugin» por continuidad con la documentación de producto; el resto de la documentación dice «conector».

## Estado

Fase C del [roadmap de ALMA](https://github.com/arkanaio/alma/blob/main/docs/ROADMAP.md), en curso. El contrato de `contrato/` es **provisional**: la definición común se cierra en [arkanaio/alma#364](https://github.com/arkanaio/alma/issues/364) y el proceso de revisión de seguridad en [arkanaio/alma#366](https://github.com/arkanaio/alma/issues/366). Un cambio incompatible del contrato se anuncia en [CONTRIBUTING.md](CONTRIBUTING.md) antes de aplicarse.

Hasta que esas dos tareas cierren, este repositorio **no acepta todavía aportaciones externas de conectores nuevos**. Sí acepta correcciones, dudas y propuestas de proveedor a través de una issue.

## Qué hay aquí

| Ruta | Qué es |
|---|---|
| `contrato/` | Tipos y esquemas que definen qué es un conector y qué devuelve. |
| `conectores/ejemplo/` | Conector de referencia, ejecutable, contra datos de ejemplo. Es la plantilla a copiar. |
| `docs/CONTRATO.md` | El contrato explicado: capacidades, datos y límites. |
| `docs/ACTIVIDAD.md` | La capacidad opcional de última actividad y sus reglas. |
| `docs/DATOS-DE-EJEMPLO.md` | Cómo se prueba un conector sin conectarse a un proveedor real. |
| `docs/REVISION-SEGURIDAD.md` | La lista de comprobación que pasa toda aportación. |
| `docs/PUBLICACION.md` | Cómo llega un conector desde este repositorio a producción. |

## Empezar

Se necesita Node 24 y pnpm 11.

```sh
pnpm install
pnpm verificar   # check de Biome, tipos y pruebas
```

`pnpm verificar` no hace ninguna petición de red: todas las pruebas se ejecutan contra los datos de ejemplo de cada conector.

## Contribuir

Lee [CONTRIBUTING.md](CONTRIBUTING.md). Toda aportación pasa por pruebas automáticas y por una revisión humana de seguridad antes de publicarse.

## Cómo se instala un conector

No se instala. Una organización cliente de ALMA configura sus credenciales y activa el conector desde el producto; en ningún momento sube ni ejecuta código por su cuenta. ALMA incorpora una versión concreta y revisada de cada conector a su despliegue. Ver [docs/PUBLICACION.md](docs/PUBLICACION.md).

## Seguridad

Para comunicar un problema de seguridad, lee [SECURITY.md](SECURITY.md). No abras una issue pública.
