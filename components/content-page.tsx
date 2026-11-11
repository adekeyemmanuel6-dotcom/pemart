export function ContentPage({ title, kicker, intro, children }: { title: string; kicker?: string; intro?: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <header className="mb-8 max-w-2xl">
        {kicker && <p className="font-script text-2xl text-mocha">{kicker}</p>}
        <h1 className="display text-5xl sm:text-7xl">{title}</h1>
        {intro && <p className="mt-4 text-xl text-muted">{intro}</p>}
      </header>
      <div className="prose-pemart">{children}</div>
    </article>
  );
}
