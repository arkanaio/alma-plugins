import assert from "node:assert/strict";
import { test } from "node:test";

import {
  lecturaDeActividadSchema,
  type Manifiesto,
  validarManifiesto,
} from "../src/index.ts";

const base: Manifiesto = {
  id: "proveedor-ejemplo",
  nombre: "Proveedor de ejemplo",
  descripcion: "Conector de referencia del repositorio.",
  documentacion:
    "https://github.com/arkanaio/alma-plugins/tree/main/conectores/ejemplo",
  capacidades: ["licencias"],
  soporte: "oficial",
  dominios: ["api.ejemplo.test"],
  configuracion: [],
  exponePrecioPorPuesto: true,
  actividad: { soportada: false },
};

test("acepta un manifiesto de licencias sin actividad", () => {
  assert.equal(validarManifiesto(base).id, "proveedor-ejemplo");
});

test("rechaza un identificador que no es un slug", () => {
  assert.throws(() => validarManifiesto({ ...base, id: "Proveedor Ejemplo" }));
});

test("exige al menos un dominio declarado", () => {
  assert.throws(() => validarManifiesto({ ...base, dominios: [] }));
});

test("exige explicar que mide la actividad cuando se declara soportada", () => {
  assert.throws(() =>
    validarManifiesto({ ...base, actividad: { soportada: true } }),
  );
});

test("rechaza la actividad en un conector que no sincroniza licencias", () => {
  assert.throws(() =>
    validarManifiesto({
      ...base,
      capacidades: ["dispositivos"],
      exponePrecioPorPuesto: false,
      actividad: {
        soportada: true,
        queMide: "Ultimo acceso registrado por el proveedor.",
        limitaciones: "Granularidad diaria.",
      },
    }),
  );
});

test("separa la fecha del proveedor del momento en que se leyo", () => {
  const lectura = lecturaDeActividadSchema.parse({
    fechaDelProveedor: "2026-09-01T00:00:00Z",
    obtenidaEn: "2026-09-18T06:30:00Z",
  });
  assert.notEqual(lectura.fechaDelProveedor, lectura.obtenidaEn);
});
