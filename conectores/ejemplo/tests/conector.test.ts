import assert from "node:assert/strict";
import { test } from "node:test";

import { validarManifiesto } from "@alma/contrato-conector";

import { conectorDeEjemplo, ErrorDelProveedor } from "../src/conector.ts";
import { configuracionSchema } from "../src/esquemas.ts";
import { manifiesto } from "../src/manifiesto.ts";
import { crearAnfitrion } from "./anfitrion.ts";

test("el manifiesto cumple el contrato", () => {
  assert.equal(validarManifiesto(manifiesto).id, "ejemplo");
});

test("cada campo declarado en el manifiesto existe en el esquema", () => {
  const declarados = manifiesto.configuracion.map((campo) => campo.clave);
  const validados = Object.keys(configuracionSchema.shape);
  assert.deepEqual([...declarados].sort(), [...validados].sort());
});

test("recorre todas las paginas de contratos", async () => {
  const { contexto } = await crearAnfitrion();
  const primera = await conectorDeEjemplo.listarContratos(contexto, null);
  assert.equal(primera.registros.length, 2);
  assert.equal(primera.continuacion, "pagina-2");

  const segunda = await conectorDeEjemplo.listarContratos(
    contexto,
    primera.continuacion,
  );
  assert.equal(segunda.registros.length, 1);
  assert.equal(segunda.continuacion, null);
});

test("descarta un precio sin moneda en vez de suponerla", async () => {
  const { contexto } = await crearAnfitrion();
  const pagina = await conectorDeEjemplo.listarContratos(contexto, "pagina-2");
  assert.equal(pagina.registros[0]?.precioPorPuesto, null);
});

test("traduce el ciclo de facturacion del proveedor", async () => {
  const { contexto } = await crearAnfitrion();
  const pagina = await conectorDeEjemplo.listarContratos(contexto, null);
  assert.equal(pagina.registros[0]?.cicloDeFacturacion, "mensual");
  assert.equal(pagina.registros[1]?.cicloDeFacturacion, "anual");
});

test("entrega los puestos tal cual, sin decidir si son huerfanos", async () => {
  const { contexto } = await crearAnfitrion();
  const pagina = await conectorDeEjemplo.listarPuestos(contexto, null);
  assert.deepEqual(
    pagina.registros.map((puesto) => puesto.estado),
    ["activo", "activo", "invitado"],
  );
});

test("un puesto sin dato de actividad devuelve ausencia de informacion", async () => {
  const { contexto } = await crearAnfitrion();
  const pagina = await conectorDeEjemplo.listarPuestos(contexto, null);
  const invitado = pagina.registros.find(
    (puesto) => puesto.estado === "invitado",
  );
  assert.equal(invitado?.ultimaActividad, null);
});

test("separa la fecha del proveedor del momento de la lectura", async () => {
  const { contexto } = await crearAnfitrion();
  const pagina = await conectorDeEjemplo.listarPuestos(contexto, null);
  const actividad = pagina.registros[0]?.ultimaActividad;
  assert.equal(actividad?.fechaDelProveedor, "2026-09-16T08:12:00Z");
  assert.ok(actividad?.obtenidaEn);
  assert.notEqual(actividad?.obtenidaEn, actividad?.fechaDelProveedor);
});

test("solo habla con los dominios declarados", async () => {
  const { contexto, urlesPedidas } = await crearAnfitrion();
  await conectorDeEjemplo.listarPuestos(contexto, null);
  assert.ok(urlesPedidas.length > 0);
  for (const url of urlesPedidas) {
    assert.equal(new URL(url).hostname, "api.ejemplo.test");
  }
});

test("la traza no contiene datos personales ni actividad", async () => {
  const { contexto, trazas } = await crearAnfitrion();
  await conectorDeEjemplo.listarPuestos(contexto, null);
  const texto = JSON.stringify(trazas);
  for (const prohibido of [
    "ana.torres@ejemplo.test",
    "Ana Torres",
    "2026-09-16",
    "token-de-pruebas",
  ]) {
    assert.ok(!texto.includes(prohibido), `La traza filtro ${prohibido}.`);
  }
});

test("una credencial rechazada no se reintenta", async () => {
  const { contexto } = await crearAnfitrion({ estado: 401 });
  await assert.rejects(
    conectorDeEjemplo.verificarAcceso(contexto),
    (error: unknown) =>
      error instanceof ErrorDelProveedor && error.reintentable === false,
  );
});

test("un fallo temporal del proveedor si es reintentable", async () => {
  const { contexto } = await crearAnfitrion({ estado: 503 });
  await assert.rejects(
    conectorDeEjemplo.verificarAcceso(contexto),
    (error: unknown) =>
      error instanceof ErrorDelProveedor && error.reintentable === true,
  );
});

test("una respuesta con otra forma falla en vez de producir datos incorrectos", async () => {
  const { contexto } = await crearAnfitrion();
  const roto = {
    ...contexto,
    solicitar: async () => Response.json({ subscriptions: [{ id: 1 }] }),
  };
  await assert.rejects(conectorDeEjemplo.listarContratos(roto, null));
});
