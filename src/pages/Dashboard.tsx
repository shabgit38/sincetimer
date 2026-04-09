export default function Dashboard() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Entry list</h2>
        <p className="mt-2 text-sm text-stone-500">
          Your tracked items will show up here once we wire up IndexedDB.
        </p>
      </div>
    </section>
  );
}
