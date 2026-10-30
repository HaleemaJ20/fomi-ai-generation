import { NextResponse } from 'next/server';
import { modelCatalog } from '@/lib/mock-data';

export async function GET() {
  return NextResponse.json(modelCatalog);
}
