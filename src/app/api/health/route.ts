import { NextResponse } from 'next/server';
import { pingDatabase } from '@/lib/db';

export async function GET() {
  const status = await pingDatabase();
  return NextResponse.json(status);
}
