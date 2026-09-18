import type { Manifiesto } from "@alma/contrato-conector";

export const manifiesto: Manifiesto = {
  id: "ejemplo",
  nombre: "Proveedor de ejemplo",
  descripcion:
    "Conector de referencia. No habla con ningun proveedor real: existe para que la guia de contribucion tenga un ejemplo ejecutable.",
  documentacion:
    "https://github.com/arkanaio/alma-plugins/tree/main/conectores/ejemplo",
  capacidades: ["licencias"],
  soporte: "oficial",
  dominios: ["api.ejemplo.test"],
  configuracion: [
    {
      clave: "espacio",
      etiqueta: "Identificador del espacio de trabajo",
      ayuda: "Aparece en la URL del panel de administracion del proveedor.",
      tipo: "texto",
      obligatorio: true,
    },
  ],
  exponePrecioPorPuesto: true,
  // El proveedor de ejemplo si publica actividad, asi que el conector la
  // declara y documenta que mide exactamente. Un conector de licencias sin
  // actividad es igual de valido: bastaria con { soportada: false }.
  actividad: {
    soportada: true,
    queMide:
      "Ultima vez que la cuenta genero una accion dentro del producto, segun el campo last_active_at del proveedor.",
    limitaciones:
      "Granularidad diaria y hasta 24 horas de retardo. No distingue entre uso real y sesiones abiertas por integraciones. No se informa de cuentas invitadas que nunca han entrado.",
  },
};
