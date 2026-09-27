// Tests del parser de boletas: npm test (usa node:test, sin dependencias).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceipt, parseAmount } from './receiptParser.ts';

const parse = (text: string) =>
  parseReceipt(text.split('\n').map((t) => ({ text: t, confidence: 90 })));
const items = (text: string) => parse(text).items.map((i) => [i.quantity, i.name, i.price]);

test('montos chilenos y OCR', () => {
  assert.equal(parseAmount('12.990'), 12990);
  assert.equal(parseAmount('$28.270'), 28270);
  assert.equal(parseAmount('1.234.567'), 1234567);
  assert.equal(parseAmount('-1.000'), -1000);
  assert.equal(parseAmount('12,50'), 12.5);
  assert.equal(parseAmount('0671'), null); // número de calle
  assert.equal(parseAmount('12'), null);
});

test('restaurant: cantidad al inicio, el monto es el total de la línea', () => {
  const r = parse(`RESTAURANT EL FOGON SPA
RUT: 76.543.210-K
BOLETA ELECTRONICA N° 184523
Fecha: 26/09/2026  Hora: 21:43
Mesa: 12   Mesero: Camila
Cant Descripcion             Total
 2   Pisco Sour Catedral    11.980
 3   Cerveza Kunstmann      13.470
 1   Jugo de Frutilla        3.200
 1   Pizza Olivas           10.900
SUBTOTAL                    39.550
Propina sugerida 10%         3.955
TOTAL                       39.550
TOTAL CON PROPINA           43.505`);
  assert.deepEqual(r.items.map((i) => [i.quantity, i.name, i.price]), [
    [2, 'Pisco Sour Catedral', 11980],
    [3, 'Cerveza Kunstmann', 13470],   // no se multiplica por 3
    [1, 'Jugo de Frutilla', 3200],     // "frutilla" no es "rut"
    [1, 'Pizza Olivas', 10900],        // "olivas" no es "iva"
  ]);
  assert.equal(r.meta.merchant, 'RESTAURANT EL FOGON SPA');
  assert.equal(r.meta.rut, '76.543.210-K');
  assert.equal(r.meta.folio, '184523');
  assert.equal(r.meta.fecha, '2026-09-26');
  assert.equal(r.meta.hora, '21:43');
  assert.equal(r.meta.total, 39550);
  assert.equal(r.meta.totalWithTip, 43505);
  assert.equal(r.meta.tipPercent, 10);
  assert.equal(r.check.status, 'ok');
});

test('columnas cantidad / unitario / total y neto-IVA', () => {
  const r = parse(`CAFETERIA LA ESQUINA LTDA
Descripcion      Cant P.Unit  Total
Cafe Americano     2   2.500  5.000
Chivas Regal 12    1   6.500  6.500
TOTAL                       $11.500
NETO 9.664          IVA 1.836
EFECTIVO                     20.000
VUELTO                        8.500`);
  assert.deepEqual(r.items.map((i) => [i.quantity, i.name, i.price]), [
    [2, 'Cafe Americano', 5000],
    [1, 'Chivas Regal 12', 6500],      // el 12 es parte del nombre
  ]);
  assert.equal(r.meta.neto, 9664);
  assert.equal(r.meta.iva, 1836);
  assert.equal(r.check.status, 'ok');
});

test('supermercado: códigos de barra, "2 x 1.290" y descuentos', () => {
  const r = parse(`HIPERMERCADO SUR S.A.
RUT 96.439.000-2
7802900001234 LECHE ENTERA 1L  1.090
        2 x 1.290
7802820600152 YOGHURT FRUTILLA 2.580
7804620000123 ESPUMANTE BRUT   5.990
DESCUENTO ESPUMANTE           -1.000
TOTAL                          8.660`);
  assert.deepEqual(r.items.map((i) => [i.quantity, i.name, i.price]), [
    [1, 'LECHE ENTERA 1L', 1090],
    [2, 'YOGHURT FRUTILLA', 2580],
    [1, 'ESPUMANTE BRUT', 5990],
    [1, 'DESCUENTO ESPUMANTE', -1000],
  ]);
  assert.equal(r.meta.rutValid, true);
  assert.equal(r.check.status, 'ok');
});

test('precuenta: el total incluye propina, cuadra con el subtotal', () => {
  const r = parse(`BAR LOCAL CERVECERO
PRECUENTA - NO VALIDO COMO BOLETA
1 Cerveza Local IPA          4.500
2 Papas Rusticas             9.800
Subtotal                    14.300
Propina (10%)                1.430
Total a pagar               15.730`);
  assert.equal(r.meta.docType, 'precuenta');
  assert.equal(r.items[0].name, 'Cerveza Local IPA'); // "local" no se descarta
  assert.equal(r.check.status, 'ok');
  assert.equal(r.check.targetLabel, 'Subtotal');
});

test('errores típicos del OCR', () => {
  assert.deepEqual(items(`Lomo a lo Pobre   l4.5OO
2. Kuchen de Nuez 2 3.490 6.980
Pizza Olivas. .   10 900
Chorrillana
16.900`), [
    [1, 'Lomo a lo Pobre', 14500],      // l→1, O→0
    [2, 'Kuchen de Nuez', 6980],
    [1, 'Pizza Olivas', 10900],         // monto partido en dos
    [1, 'Chorrillana', 16900],          // precio en la línea siguiente
  ]);
});

test('lo que viene después del total no son ítems', () => {
  assert.deepEqual(items(`Pisco Sour 5.990
TOTAL 5.990
Res. 80 de 2014 Verifique en sii.cl
Gracias por su visita 2026`), [[1, 'Pisco Sour', 5990]]);
});

test('cantidad × unitario ≠ total: el total impreso decide', () => {
  // El OCR leyó "17.990" en vez de "7.990" en el unitario
  const r = parse(`Sandwich Chacarero 1 17.990 7.990
Cafe 1 2.500 2.500
TOTAL 10.490`);
  assert.equal(r.items[0].price, 7990);
  assert.equal(r.check.status, 'ok');
  // Y al revés: el total perdió dígitos ("990"), vale cantidad × unitario
  const r2 = parse(`Sandwich Chacarero 1 7.990 990
Cafe 1 2.500 2.500
TOTAL 10.490`);
  assert.equal(r2.items[0].price, 7990);
  assert.equal(r2.items[0].altPrice, 990);
  assert.equal(r2.check.status, 'ok');
});

test('neto/IVA no se confunden con el total; folio sin fecha', () => {
  const r = parse(`Boleta 12345 27/09/2026
Pisco Sour 5.950
MONTO NETO 5.000
IVA 950
TOTAL 5.950`);
  assert.equal(r.meta.folio, '12345');
  assert.equal(r.meta.total, 5950);
  assert.equal(r.meta.neto, 5000);
  assert.equal(r.check.status, 'ok');
});

test('no cuadra → avisa la diferencia exacta', () => {
  const r = parse(`Pisco Sour 5.996
TOTAL 5.990`);
  assert.equal(r.check.status, 'mismatch');
  assert.equal(r.check.diff, -6);
});
