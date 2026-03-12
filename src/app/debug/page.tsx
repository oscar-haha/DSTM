export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getDebug() {
  const response = await fetch('http://localhost:3000/api/debug', { cache: 'no-store' });
  if (!response.ok) {
    return { error: `status ${response.status}` };
  }
  return response.json();
}

export default async function DebugPage() {
  const data = await getDebug();

  return (
    <main className="px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Debug</h1>
        <pre className="rounded-xl border border-stone bg-white/80 p-4 text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </main>
  );
}
