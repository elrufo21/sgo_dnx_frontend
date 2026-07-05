# Contexto Funcional - POS Carrito Temporal (IDB)

## Objetivo
Persistir el carrito del POS en una "tabla" temporal (IndexedDB) para evitar perdida de datos si:
- el usuario cierra la app
- se recarga la pagina
- se apaga la PC

## Reglas de negocio definidas
1. El carrito activo debe guardarse temporalmente en IDB.
2. Al **confirmar pago**, el registro del carrito debe quedar asociado a ese proceso de pago confirmado.
3. Al hacer **Nuevo Registro**, se debe limpiar el carrito temporal actual y crear un nuevo contexto de pago vacio.
4. La persistencia es temporal (no historica permanente de ventas).

## Flujo esperado (alto nivel)
1. Usuario agrega/edita/quita items en POS.
2. Cada cambio actualiza el borrador de carrito en IDB (autosave).
3. Usuario pasa a Payment y mantiene el mismo borrador.
4. Usuario confirma pago:
- el estado del borrador pasa a `confirmed` (o se marca como finalizado)
- deja de tratarse como carrito editable
5. Usuario pulsa "Nuevo Registro":
- se borra/archiva el borrador confirmado actual
- se crea un nuevo borrador `draft` vacio para una nueva venta

## Modelo sugerido de la tabla temporal (IDB)
Store: `pos_cart_drafts`

Campos minimos:
- `draftId` (string, PK)
- `companyId` (number)
- `userId` (string o number)
- `status` (`draft` | `confirmed`)
- `items` (array de carrito)
- `totals` (subTotal, total, itemCount)
- `paymentMeta` (metodo de pago, cliente, descuentos, etc. si aplica)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `confirmedAt` (timestamp nullable)

Indices recomendados:
- `by_user_company_status` -> (`userId`, `companyId`, `status`)
- `by_updatedAt`

## Criterios de aceptacion
1. Si la app se cierra y se abre, el carrito `draft` vuelve exactamente como estaba.
2. Si se apaga la PC y luego se ingresa, el carrito `draft` sigue disponible.
3. Al confirmar pago, el carrito deja de estar editable como borrador activo.
4. Al hacer "Nuevo Registro", no quedan items del pago anterior en el nuevo flujo.
5. No se mezclan carritos entre usuarios distintos ni entre companias distintas.

## Consideraciones funcionales importantes
- Evitar limpiar carrito automaticamente al montar pantalla si existe `draft` activo.
- Definir claramente que boton o evento representa "Nuevo Registro".
- Agregar expiracion de borradores viejos (por ejemplo 24-72 horas) para no crecer indefinidamente.
- Manejar concurrencia basica (dos pestañas): ultima actualizacion gana.

## Proximo paso de implementacion
1. Crear servicio `idb` para `pos_cart_drafts`.
2. Conectar `usePosStore` con hydrate inicial + autosave.
3. Ajustar reglas en POS/Payment para respetar `draft` y `confirmed`.
4. Implementar accion explicita de "Nuevo Registro" que reinicie correctamente el ciclo.
