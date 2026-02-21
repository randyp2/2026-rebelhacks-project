export default function AlertsLoading() {
  return (
    <div className="h-full overflow-auto p-4">
      <h1 className="mb-4 text-2xl font-bold">Alerts</h1>

      <div className="rounded-lg border border-white/10 bg-[#0f1623] p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-full animate-pulse rounded-md bg-white/10 sm:w-72" />
          <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
        </div>

        <div className="rounded-lg border border-white/10 p-4">
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-white/10" />
            <div className="h-4 w-full animate-pulse rounded bg-white/10" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  )
}
