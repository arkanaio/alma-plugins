import { readFile } from "node:fs/promises";

import type { ContextoDeEjecucion } from "@alma/contrato-conector";

import type { Configuracion } from "../src/esquemas.ts";
import { manifiesto } from "../src/manifiesto.ts";

type Traza = { mensaje: string; datos?: Record<string, string | number> };

type Anfitrion = {
  contexto: ContextoDeEjecucion<Configuracion>;
  urlesPedidas: string[];
  trazas: Traza[];
};

async function cargar(fichero: string): Promise<Record<string, unknown>> {
  const ruta = new URL(`../datos-de-ejemplo/${fichero}`, import.meta.url);
  return JSON.parse(await readFile(ruta, "utf8"));
}

/**
 * Anfitrion de pruebas: hace lo mismo que hara ALMA al ejecutar el conector.
 * Sirve los datos de ejemplo, rechaza cualquier dominio no declarado en el
 * manifiesto y deja a la vista las peticiones y las trazas para poder
 * comprobarlas. Ningun test de este repositorio habla con un proveedor real.
 */
export async function crearAnfitrion(
  opciones: { estado?: number } = {},
): Promise<Anfitrion> {
  const suscripciones = await cargar("suscripciones.json");
  const miembros = await cargar("miembros.json");
  const urlesPedidas: string[] = [];
  const trazas: Traza[] = [];
  const dominios = new Set(manifiesto.dominios);

  const contexto: ContextoDeEjecucion<Configuracion> = {
    configuracion: { espacio: "arkana" },
    credencial: { token: "token-de-pruebas" },
    cancelacion: new AbortController().signal,
    registrar: (mensaje, datos) => {
      trazas.push(datos === undefined ? { mensaje } : { mensaje, datos });
    },
    solicitar: async ({ url }) => {
      urlesPedidas.push(url);
      const destino = new URL(url);
      if (!dominios.has(destino.hostname)) {
        throw new Error(
          `El conector intento hablar con ${destino.hostname}, que no esta en su manifiesto.`,
        );
      }
      if (opciones.estado && opciones.estado !== 200) {
        return new Response("", { status: opciones.estado });
      }
      const cursor = destino.searchParams.get("cursor") ?? "";
      const catalogo = destino.pathname.endsWith("/subscriptions")
        ? suscripciones
        : miembros;
      const pagina = catalogo[cursor];
      if (pagina === undefined) {
        return new Response("", { status: 404 });
      }
      return Response.json(pagina);
    },
  };

  return { contexto, urlesPedidas, trazas };
}
