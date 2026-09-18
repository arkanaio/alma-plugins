# Conector de ejemplo

Conector de referencia del repositorio. **No habla con ningún proveedor real**: `api.ejemplo.test` no existe y el dominio `.test` no es resoluble por diseño. Existe para que la guía de contribución tenga un ejemplo ejecutable y para que copiarlo sea el primer paso de un conector nuevo.

Implementa la capacidad `licencias` y declara la capacidad opcional de última actividad, para que las dos formas estén a la vista.

## Qué sincroniza

| Lectura | Qué devuelve |
|---|---|
| `listarContratos` | Producto, plan, puestos totales, precio por puesto, ciclo de facturación y renovación |
| `listarPuestos` | Cuentas que ocupan un puesto, con su estado y, si el proveedor lo da, su última actividad |

No escribe nada en el proveedor.

## Qué credencial pediría

Un token de API con permiso de **solo lectura** sobre suscripciones y miembros del espacio de trabajo. No hace falta ningún permiso de escritura, ni de administración de usuarios, ni de facturación.

## Límites conocidos

- La actividad tiene granularidad diaria y hasta 24 horas de retardo.
- La actividad no distingue uso real de sesiones abiertas por integraciones.
- Una cuenta invitada que nunca ha entrado no tiene actividad: se devuelve ausencia de información, no inactividad.
- El precio por puesto puede venir sin moneda; en ese caso se descarta entero en vez de suponerla.

## Copiarlo

```sh
cp -R conectores/ejemplo conectores/<proveedor>
```

Después: renombra el paquete en `package.json`, cambia `id`, `nombre`, `descripcion`, `documentacion` y `dominios` en `src/manifiesto.ts`, sustituye los esquemas de `src/esquemas.ts` por los del proveedor real, y reemplaza los datos de ejemplo por respuestas reales anonimizadas.

Lee [CONTRIBUTING.md](../../CONTRIBUTING.md) antes de abrir el PR.

## Probar

```sh
pnpm verificar
```
