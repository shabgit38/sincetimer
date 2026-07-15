import { quotes } from '../data/quotes';

function QuoteSet({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={duplicate || undefined}>
      {quotes.map((quote) => (
        <span key={quote} className="flex shrink-0 items-center">
          <span className="mx-8 text-xs font-medium tracking-wide text-stone-700 dark:text-stone-300">
            {quote}
          </span>
          <span className="text-sky-500" aria-hidden="true">◆</span>
        </span>
      ))}
    </div>
  );
}

export default function QuoteRibbon() {
  return (
    <aside className="quote-ribbon overflow-hidden border-t border-stone-200 bg-sky-50/80 py-2 dark:border-white/10 dark:bg-sky-950/20" aria-label="Inspirational quotes">
      <div className="quote-ribbon-track flex w-max items-center">
        <QuoteSet />
        <QuoteSet duplicate />
      </div>
    </aside>
  );
}
