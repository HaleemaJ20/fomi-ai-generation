import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Page not found</h1>
      <p className="text-sm text-[var(--color-muted)]">The page you are looking for does not exist or has moved.</p>
      <Link
        href="/"
        className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-accent-strong)] focus-ring"
      >
        Back to generator
      </Link>
    </div>
  );
}