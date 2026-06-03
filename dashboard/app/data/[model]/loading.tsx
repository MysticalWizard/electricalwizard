export default function ModelLoading() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="h-7 w-32 bg-surface-alt rounded animate-pulse" />
        <div className="flex gap-3">
          <div className="h-8 w-48 bg-surface-alt rounded animate-pulse" />
          <div className="h-8 w-20 bg-surface-alt rounded animate-pulse" />
        </div>
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-surface-alt h-10 border-b border-border" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-10 border-b border-border flex items-center gap-4 px-4"
          >
            <div className="h-4 w-24 bg-surface-hover rounded animate-pulse" />
            <div className="h-4 w-32 bg-surface-hover rounded animate-pulse" />
            <div className="h-4 w-20 bg-surface-hover rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
