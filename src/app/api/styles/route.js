import { NextResponse } from 'next/server';
import { styleCatalog } from '@/lib/mock-data';

export async function GET() {
  return NextResponse.json(styleCatalog);
}
