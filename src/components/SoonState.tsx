/* Calm "coming soon" body for a module that isn't part of the current
   build phase. Shaded, dashed, no fake data. */
export default function SoonState({ note }: { note: string }) {
  return (
    <div className="sw-soon flex min-h-56 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-medium text-peri-deep">In the build queue</p>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{note}</p>
    </div>
  );
}
