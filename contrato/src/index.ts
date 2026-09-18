import { z } from "zod";

// Contrato provisional de conector. Mientras arkanaio/alma#364 no cierre la
// definicion comun en el producto, esta es la referencia que usan la guia de
// contribucion y los conectores de este repositorio. Un cambio incompatible
// aqui se anuncia en la guia antes de aplicarse.

/** Lo que un conector puede sincronizar. Declara una o varias. */
export const capacidadSchema = z.enum([
  "directorio",
  "dispositivos",
  "licencias",
]);
export type Capacidad = z.infer<typeof capacidadSchema>;

/** Se muestra tal cual al cliente para que sepa que tiene instalado. */
export const nivelDeSoporteSchema = z.enum([
  "oficial",
  "comunidad",
  "navegador",
]);
export type NivelDeSoporte = z.infer<typeof nivelDeSoporteSchema>;

/** Que necesita la organizacion para rellenar la configuracion del conector. */
export const campoDeConfiguracionSchema = z.object({
  clave: z.string().min(1),
  etiqueta: z.string().min(1),
  ayuda: z.string().min(1),
  tipo: z.enum(["texto", "secreto", "dominio", "booleano"]),
  obligatorio: z.boolean(),
});
export type CampoDeConfiguracion = z.infer<typeof campoDeConfiguracionSchema>;

/**
 * Declaracion de la capacidad opcional de ultima actividad (decision de
 * arkanaio/alma#409). Un conector de licencias es valido sin ella. Cuando la
 * declara, tiene que decir que mide el proveedor y donde deja de medir: la
 * fecha de sincronizacion, la de asignacion o un acceso generico a la cuenta
 * no son uso de una licencia y no valen como sustituto.
 */
export const declaracionDeActividadSchema = z.discriminatedUnion("soportada", [
  z.object({ soportada: z.literal(false) }),
  z.object({
    soportada: z.literal(true),
    queMide: z.string().min(1),
    limitaciones: z.string().min(1),
  }),
]);
export type DeclaracionDeActividad = z.infer<
  typeof declaracionDeActividadSchema
>;

/** Ficha con la que ALMA presenta el conector al cliente. */
export const manifiestoSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  nombre: z.string().min(1),
  descripcion: z.string().min(1),
  documentacion: z.url(),
  capacidades: z.array(capacidadSchema).min(1),
  soporte: nivelDeSoporteSchema,
  // Unicas maquinas con las que el conector puede hablar. Cualquier peticion a
  // otro dominio es un fallo de ejecucion, no una decision del conector.
  dominios: z.array(z.string().min(1)).min(1),
  configuracion: z.array(campoDeConfiguracionSchema),
  exponePrecioPorPuesto: z.boolean(),
  actividad: declaracionDeActividadSchema,
});
export type Manifiesto = z.infer<typeof manifiestoSchema>;

/**
 * Lectura de actividad. La fecha que da el proveedor y el momento en que se
 * obtuvo son datos distintos: un fallo de sincronizacion no convierte un valor
 * anterior en una lectura actual. Sin dato se devuelve null, nunca una fecha
 * inventada ni inactividad inferida.
 */
export const lecturaDeActividadSchema = z.object({
  fechaDelProveedor: z.iso.datetime({ offset: true }),
  obtenidaEn: z.iso.datetime({ offset: true }),
});
export type LecturaDeActividad = z.infer<typeof lecturaDeActividadSchema>;

export const importeSchema = z.object({
  // Cadena decimal: el importe se transporta sin pasar por coma flotante.
  cantidad: z.string().regex(/^-?\d+(\.\d+)?$/),
  moneda: z.string().length(3),
});
export type Importe = z.infer<typeof importeSchema>;

/** Un contrato de software tal y como lo ve el proveedor. */
export const contratoDeLicenciaSchema = z.object({
  idExterno: z.string().min(1),
  producto: z.string().min(1),
  plan: z.string().min(1).nullable(),
  puestosTotales: z.number().int().nonnegative().nullable(),
  precioPorPuesto: importeSchema.nullable(),
  cicloDeFacturacion: z.enum(["mensual", "anual"]).nullable(),
  renovacion: z.iso.date().nullable(),
});
export type ContratoDeLicencia = z.infer<typeof contratoDeLicenciaSchema>;

/**
 * Un puesto ocupado en el proveedor. El conector no decide si el puesto es
 * huerfano: entrega la cuenta tal cual y la conciliacion la hace ALMA, que es
 * quien conoce a los empleados de la organizacion.
 */
export const puestoDeLicenciaSchema = z.object({
  idExterno: z.string().min(1),
  idContratoExterno: z.string().min(1),
  correo: z.email().nullable(),
  nombreMostrado: z.string().min(1).nullable(),
  estado: z.enum(["activo", "suspendido", "invitado"]),
  ultimaActividad: lecturaDeActividadSchema.nullable(),
});
export type PuestoDeLicencia = z.infer<typeof puestoDeLicenciaSchema>;

/** Peticion saliente. La ejecuta el anfitrion, que aplica limites y dominios. */
export type SolicitudSaliente = {
  url: string;
  metodo?: "GET" | "POST";
  cabeceras?: Record<string, string>;
  cuerpo?: string;
};

/**
 * Lo unico que recibe un conector. No hay cliente de base de datos, ni
 * organizacion, ni fetch global: si algo no esta aqui, el conector no lo tiene.
 */
export type ContextoDeEjecucion<Configuracion> = {
  configuracion: Configuracion;
  /** Credencial ya descifrada. No se registra, ni se devuelve, ni se reenvia. */
  credencial: Readonly<Record<string, string>>;
  solicitar: (entrada: SolicitudSaliente) => Promise<Response>;
  /** Traza tecnica. Nunca correos, nombres ni valores de actividad. */
  registrar: (mensaje: string, datos?: Record<string, string | number>) => void;
  cancelacion: AbortSignal;
};

/** Lectura paginada. El conector nunca carga el catalogo entero en memoria. */
export type Pagina<Registro, Continuacion> = {
  registros: readonly Registro[];
  continuacion: Continuacion | null;
};

/** Capacidad "licencias". Dos lecturas, ninguna escritura. */
export type ConectorDeLicencias<Configuracion, Continuacion = unknown> = {
  manifiesto: Manifiesto;
  configuracionSchema: z.ZodType<Configuracion>;
  /** Comprobacion barata de credencial y configuracion antes de sincronizar. */
  verificarAcceso: (
    contexto: ContextoDeEjecucion<Configuracion>,
  ) => Promise<void>;
  listarContratos: (
    contexto: ContextoDeEjecucion<Configuracion>,
    continuacion: Continuacion | null,
  ) => Promise<Pagina<ContratoDeLicencia, Continuacion>>;
  listarPuestos: (
    contexto: ContextoDeEjecucion<Configuracion>,
    continuacion: Continuacion | null,
  ) => Promise<Pagina<PuestoDeLicencia, Continuacion>>;
};

/**
 * Comprueba que el manifiesto es coherente consigo mismo. Se ejecuta en las
 * pruebas de cada conector y en la revision, antes de leer una sola linea de
 * su implementacion.
 */
export function validarManifiesto(valor: unknown): Manifiesto {
  const manifiesto = manifiestoSchema.parse(valor);
  if (
    manifiesto.actividad.soportada &&
    !manifiesto.capacidades.includes("licencias")
  ) {
    throw new Error(
      "La ultima actividad solo la declara un conector de licencias.",
    );
  }
  if (
    manifiesto.exponePrecioPorPuesto &&
    !manifiesto.capacidades.includes("licencias")
  ) {
    throw new Error(
      "El precio por puesto solo lo declara un conector de licencias.",
    );
  }
  return manifiesto;
}
