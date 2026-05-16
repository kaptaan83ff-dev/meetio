import { LucideIcon } from 'lucide-react';

import { AppShell } from '@/components/navigation/AppShell';

type AppPlaceholderPageProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export default function AppPlaceholderPage({ title, description, icon: Icon }: AppPlaceholderPageProps) {
  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
        <section className="border-[3px] border-ink-black bg-ghost-white p-6 shadow-hard lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-display text-[11px] font-black uppercase tracking-[0.24em] text-ink-black/55">
                Protected App Placeholder
              </p>
              <h1 className="mt-3 font-display text-4xl uppercase tracking-[-0.05em] text-ink-black sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-black/65">{description}</p>
            </div>
            <div className="grid h-16 w-16 place-items-center border-2 border-ink-black bg-sun-yellow shadow-hard">
              <Icon className="h-7 w-7" aria-hidden="true" />
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
