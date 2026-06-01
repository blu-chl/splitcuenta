// El OCR se procesa directamente en el browser con Tesseract.js.
// Este endpoint ya no se usa — se conserva por si en el futuro
// se quiere agregar un motor OCR alternativo server-side.

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { message: 'OCR procesado en el cliente con Tesseract.js' },
    { status: 200 }
  );
}
