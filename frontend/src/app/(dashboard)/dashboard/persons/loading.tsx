export default function PersonsLoading() {
  return (
    <div className="h-full overflow-auto p-4">
      <h1 className="mb-4 text-2xl font-bold">Persons</h1>

      <div className="rounded-lg border border-white/10 bg-[#0f1623] p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-full animate-pulse rounded-md bg-white/10 sm:w-80" />
          <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
        </div>

        <div className="rounded-lg border border-white/10 p-4">
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-white/10" />
            <div className="h-4 w-full animate-pulse rounded bg-white/10" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-8/12 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  )
}
