import { NextResponse } from 'next/server';
import { historyItems } from '@/lib/mock-data';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor');
  const rawLimit = Number(searchParams.get('limit') || '8');
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 20) : 8;

  const sortedItems = [...historyItems].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  let startIndex = 0;

  if (cursor) {
    const cursorIndex = sortedItems.findIndex((item) => item.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const page = sortedItems.slice(startIndex, startIndex + limit);
  const lastItem = page[page.length - 1];
  const nextCursor = page.length === limit && startIndex + limit < sortedItems.length ? lastItem.id : null;

  return NextResponse.json({
    items: page,
    nextCursor,
    hasMore: Boolean(nextCursor),
  });
}
