import { CalendarCheck, CheckSquare, MessageCircle, Sparkles, Video } from 'lucide-react';

import { AppShell } from '@/components/navigation/AppShell';
import { useAuthStore } from '@/stores/authStore';

const cards = [
  {
    title: 'Meetings',
    description: 'Meeting room and scheduling work starts in the next feature slices.',
    icon: Video,
    tone: 'bg-sun-yellow',
  },
  {
    title: 'Calendar',
    description: 'Calendar sync will attach agenda, reminders, and event context.',
    icon: CalendarCheck,
    tone: 'bg-neon-lime',
  },
  {
    title: 'Messenger',
    description: 'Team messages and meeting follow-ups will live here.',
    icon: MessageCircle,
    tone: 'bg-electric-pink',
  },
  {
    title: 'Tasks',
    description: 'Action items and due-date reminders will be tracked from meetings.',
    icon: CheckSquare,
    tone: 'bg-royal-blue text-white',
  },
];

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
        <section className="mb-8 border-[3px] border-ink-black bg-ghost-white p-6 shadow-hard lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-display text-[11px] font-black uppercase tracking-[0.24em] text-ink-black/55">
                Dashboard Placeholder
              </p>
              <h1 className="mt-3 font-display text-4xl uppercase tracking-[-0.05em] text-ink-black sm:text-5xl">
                Welcome{user?.display_name ? `, ${user.display_name}` : ''}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-black/65">
                Auth is live. This dashboard shell exists so successful login has a real app surface while Feature 3+ fills in the actual product modules.
              </p>
            </div>
            <div className="inline-flex items-center gap-3 border-2 border-ink-black bg-neon-lime px-4 py-3 shadow-hard">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <span className="font-display text-[11px] font-black uppercase tracking-[0.12em]">Session Active</span>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="border-[3px] border-ink-black bg-ghost-white p-5 shadow-hard transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-hover">
                <div className={['mb-5 grid h-12 w-12 place-items-center border-2 border-ink-black shadow-[3px_3px_0_0_#0a0a0a]', card.tone].join(' ')}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="font-display text-lg uppercase tracking-[-0.03em]">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-ink-black/65">{card.description}</p>
              </article>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
