import { z } from "zod";

// Configuracion que rellena la organizacion, validada antes de cualquier
// peticion. Los campos declarados en el manifiesto y este esquema tienen que
// coincidir: la prueba de manifiesto lo comprueba.
export const configuracionSchema = z.object({
  espacio: z.string().min(1).max(64),
});
export type Configuracion = z.infer<typeof configuracionSchema>;

// Respuestas del proveedor. Se validan siempre antes de que su contenido llegue
// a ninguna otra parte del conector: una respuesta que cambia de forma tiene
// que fallar aqui, no producir datos incorrectos mas adelante.
export const respuestaDeSuscripcionesSchema = z.object({
  subscriptions: z.array(
    z.object({
      id: z.string().min(1),
      product: z.string().min(1),
      plan: z.string().min(1).nullable(),
      seats: z.number().int().nonnegative().nullable(),
      unit_price: z.string().nullable(),
      currency: z.string().length(3).nullable(),
      billing_cycle: z.enum(["monthly", "yearly"]).nullable(),
      renews_on: z.iso.date().nullable(),
    }),
  ),
  next_cursor: z.string().min(1).nullable(),
});

export const respuestaDeMiembrosSchema = z.object({
  members: z.array(
    z.object({
      id: z.string().min(1),
      subscription_id: z.string().min(1),
      email: z.email().nullable(),
      display_name: z.string().min(1).nullable(),
      status: z.enum(["active", "suspended", "invited"]),
      last_active_at: z.iso.datetime({ offset: true }).nullable(),
    }),
  ),
  next_cursor: z.string().min(1).nullable(),
});
