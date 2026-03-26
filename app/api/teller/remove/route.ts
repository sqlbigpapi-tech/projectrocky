import { NextResponse } from 'next/server';

export async function POST() {
  // Enrollment removal is handled client-side (remove from DB only).
  // To fully revoke access, visit the Teller dashboard.
  return NextResponse.json({ removed: true });
}
