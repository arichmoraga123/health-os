export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse px-4 md:px-8 py-6">
      <div className="skeleton h-40 w-full rounded-[var(--radius-card)]" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-36 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="skeleton h-24 w-full rounded-[var(--radius-card)]" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="skeleton h-64 rounded-[var(--radius-card)]" />
        <div className="skeleton h-64 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
