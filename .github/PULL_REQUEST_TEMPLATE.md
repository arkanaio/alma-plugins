## Qué aporta este PR

<!-- Qué conector, qué proveedor y qué capacidades. Enlaza la issue de propuesta. -->

## Seguridad

<!-- Esta sección es lo primero que se lee en la revisión. Responde a todo. -->

- Dominios declarados en el manifiesto y por qué son necesarios:
- Credencial que pide al cliente, y con qué permisos mínimos:
- Dependencias nuevas, si hay, y por qué no se pueden evitar:
- Confirmo que el conector no accede a base de datos, disco, variables de entorno ni red fuera de `contexto.solicitar`: <!-- sí / no -->
- Confirmo que ninguna traza contiene credenciales, correos, nombres ni valores de actividad: <!-- sí / no -->
- Confirmo que los datos de ejemplo están anonimizados y no contienen ningún secreto: <!-- sí / no -->

## Última actividad

<!-- Si el conector no la declara, escribe "No la declara" y sigue. -->

- Campo del proveedor del que sale, con enlace a su documentación:
- Qué mide exactamente y qué no mide:
- Confirmo que no sustituyo el uso por la fecha de sincronización, de asignación ni por un acceso genérico: <!-- sí / no -->
- Confirmo que sin dato se devuelve ausencia de información y que el valor no se persiste ni se registra: <!-- sí / no -->

## Validación realizada

<!-- Resultado de `pnpm verificar`. Si has probado contra el proveedor real en tu entorno, cuéntalo aquí: qué comprobaste y qué salió. Nunca subas credenciales. -->

## Documentación

<!-- Qué has añadido al README del conector: credencial y permisos, permisos que NO hacen falta, límites conocidos. -->
