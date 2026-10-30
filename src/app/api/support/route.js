import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const payload = await request.json();
    const errors = {};

    if (!payload?.name || !String(payload.name).trim()) {
      errors.name = 'Please enter your name.';
    }

    if (!payload?.email || !/\S+@\S+\.\S+/.test(String(payload.email))) {
      errors.email = 'Please enter a valid email.';
    }

    if (!payload?.message || !String(payload.message).trim()) {
      errors.message = 'Please tell us what we can help with.';
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        {
          error: 'Please correct the highlighted fields.',
          details: errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Support request sent successfully.',
      ticket: `support-${Date.now()}`,
    });
  } catch {
    return NextResponse.json(
      { error: 'The support request body must be valid JSON.' },
      { status: 400 },
    );
  }
}
