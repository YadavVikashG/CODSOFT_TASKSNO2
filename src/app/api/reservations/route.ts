import { NextResponse } from 'next/server';

const reservations: Array<{
  id: string;
  name: string;
  date: string;
  time: string;
  guests: string;
  tableType: string;
}> = [];

export async function GET() {
  return NextResponse.json(reservations);
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name || '').trim();
  const date = String(body.date || '').trim();
  const time = String(body.time || '').trim();
  const guests = String(body.guests || '2 Guests');
  const tableType = String(body.tableType || 'Window');

  if (!name || !date || !time) {
    return NextResponse.json({ error: 'Name, date, and time are required for a reservation.' }, { status: 400 });
  }

  const reservation = {
    id: `RES-${Date.now()}`,
    name,
    date,
    time,
    guests,
    tableType,
  };

  reservations.push(reservation);

  return NextResponse.json({ success: true, reservation });
}
