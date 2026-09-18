import type {
  ConectorDeLicencias,
  ContextoDeEjecucion,
  ContratoDeLicencia,
  Pagina,
  PuestoDeLicencia,
  SolicitudSaliente,
} from "@alma/contrato-conector";
import {
  type Configuracion,
  configuracionSchema,
  respuestaDeMiembrosSchema,
  respuestaDeSuscripcionesSchema,
} from "./esquemas.ts";
import { manifiesto } from "./manifiesto.ts";

const base = "https://api.ejemplo.test/v1";

/** Cursor opaco del proveedor. null significa que no quedan mas paginas. */
type Continuacion = string;

class ErrorDelProveedor extends Error {
  readonly reintentable: boolean;

  constructor(mensaje: string, reintentable: boolean) {
    super(mensaje);
    this.name = "ErrorDelProveedor";
    this.reintentable = reintentable;
  }
}

async function leerJson(
  contexto: ContextoDeEjecucion<Configuracion>,
  entrada: SolicitudSaliente,
): Promise<unknown> {
  const respuesta = await contexto.solicitar(entrada);
  if (respuesta.status === 401 || respuesta.status === 403) {
    // El anfitrion traduce esto a "requiere reautenticacion". El conector no
    // reintenta una credencial que el proveedor ya ha rechazado.
    throw new ErrorDelProveedor(
      "Credencial rechazada por el proveedor.",
      false,
    );
  }
  if (respuesta.status === 429 || respuesta.status >= 500) {
    throw new ErrorDelProveedor(
      `El proveedor respondio ${respuesta.status}.`,
      true,
    );
  }
  if (!respuesta.ok) {
    throw new ErrorDelProveedor(
      `El proveedor respondio ${respuesta.status}.`,
      false,
    );
  }
  return await respuesta.json();
}

function ruta(
  contexto: ContextoDeEjecucion<Configuracion>,
  recurso: string,
  continuacion: Continuacion | null,
): SolicitudSaliente {
  const url = new URL(`${base}/${recurso}`);
  url.searchParams.set("workspace", contexto.configuracion.espacio);
  if (continuacion) url.searchParams.set("cursor", continuacion);
  return {
    url: url.toString(),
    metodo: "GET",
    cabeceras: { accept: "application/json" },
  };
}

export const conectorDeEjemplo: ConectorDeLicencias<
  Configuracion,
  Continuacion
> = {
  manifiesto,
  configuracionSchema,

  async verificarAcceso(contexto) {
    await leerJson(contexto, ruta(contexto, "subscriptions", null));
  },

  async listarContratos(
    contexto,
    continuacion,
  ): Promise<Pagina<ContratoDeLicencia, Continuacion>> {
    const cuerpo = respuestaDeSuscripcionesSchema.parse(
      await leerJson(contexto, ruta(contexto, "subscriptions", continuacion)),
    );
    contexto.registrar("Pagina de contratos leida", {
      contratos: cuerpo.subscriptions.length,
    });
    return {
      registros: cuerpo.subscriptions.map((suscripcion) => ({
        idExterno: suscripcion.id,
        producto: suscripcion.product,
        plan: suscripcion.plan,
        puestosTotales: suscripcion.seats,
        // Un importe sin moneda no es un importe: se descarta entero en vez de
        // suponer la moneda de la organizacion.
        precioPorPuesto:
          suscripcion.unit_price && suscripcion.currency
            ? {
                cantidad: suscripcion.unit_price,
                moneda: suscripcion.currency,
              }
            : null,
        cicloDeFacturacion:
          suscripcion.billing_cycle === "monthly"
            ? "mensual"
            : suscripcion.billing_cycle === "yearly"
              ? "anual"
              : null,
        renovacion: suscripcion.renews_on,
      })),
      continuacion: cuerpo.next_cursor,
    };
  },

  async listarPuestos(
    contexto,
    continuacion,
  ): Promise<Pagina<PuestoDeLicencia, Continuacion>> {
    const obtenidaEn = new Date().toISOString();
    const cuerpo = respuestaDeMiembrosSchema.parse(
      await leerJson(contexto, ruta(contexto, "members", continuacion)),
    );
    // La traza cuenta puestos, nunca quien los ocupa ni cuando entro.
    contexto.registrar("Pagina de puestos leida", {
      puestos: cuerpo.members.length,
    });
    return {
      registros: cuerpo.members.map((miembro) => ({
        idExterno: miembro.id,
        idContratoExterno: miembro.subscription_id,
        correo: miembro.email,
        nombreMostrado: miembro.display_name,
        estado:
          miembro.status === "active"
            ? "activo"
            : miembro.status === "suspended"
              ? "suspendido"
              : "invitado",
        // Sin dato del proveedor no hay lectura. No se sustituye por la fecha
        // de sincronizacion ni por la de asignacion, y no se infiere que la
        // cuenta este inactiva.
        ultimaActividad: miembro.last_active_at
          ? { fechaDelProveedor: miembro.last_active_at, obtenidaEn }
          : null,
      })),
      continuacion: cuerpo.next_cursor,
    };
  },
};

export { ErrorDelProveedor };
