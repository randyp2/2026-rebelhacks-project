export default function AlertsLoading() {
	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
			<h1 className="mb-4 text-2xl font-bold">Alerts</h1>

			<div className="rounded-lg border border-border bg-card p-4">
				<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div className="h-9 w-full animate-pulse rounded-md bg-accent/40 sm:w-72" />
					<div className="h-5 w-40 animate-pulse rounded bg-accent/40" />
				</div>

				<div className="rounded-lg border border-border p-4">
					<div className="space-y-3">
						<div className="h-4 w-full animate-pulse rounded bg-accent/40" />
						<div className="h-4 w-full animate-pulse rounded bg-accent/40" />
						<div className="h-4 w-5/6 animate-pulse rounded bg-accent/40" />
						<div className="h-4 w-4/6 animate-pulse rounded bg-accent/40" />
					</div>
				</div>
			</div>
		</div>
	);
}
