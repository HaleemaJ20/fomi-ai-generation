'use client';

import Link from 'next/link';

export default function AppError({ reset }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Something went wrong</h1>
      <p className="text-sm text-[var(--color-muted)]">An unexpected error occurred. You can try again or go back to the generator.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-accent-strong)] focus-ring"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition focus-ring"
        >
          Home
        </Link>
      </div>
    </div>
  );
}