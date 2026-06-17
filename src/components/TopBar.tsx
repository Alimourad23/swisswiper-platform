import Link from "next/link";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-hairline bg-surface/80 px-5 backdrop-blur-md sm:px-8">
      <Link href="/dashboard" className="text-lg font-medium tracking-tight text-ink">
        SwissWiper
      </Link>

      {/* Placeholder avatar — real account details arrive with sign-in. */}
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted sm:inline">Ali</span>
        <div
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-peri-soft text-xs font-medium text-peri-deep ring-1 ring-hairline"
        >
          A
        </div>
      </div>
    </header>
  );
}
