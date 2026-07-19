export function LoadingSkeleton() {
  return (
    <div className="card p-6 animate-pulse space-y-4">
      <div className="h-6 w-2/3 rounded bg-zinc-800" />
      <div className="h-4 w-1/2 rounded bg-zinc-800" />
      <div className="h-10 w-full rounded bg-zinc-800" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-24 rounded bg-zinc-800" />
        <div className="h-24 rounded bg-zinc-800" />
      </div>
    </div>
  );
}