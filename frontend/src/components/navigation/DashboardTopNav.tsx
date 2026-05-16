import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, CalendarCheck, CheckSquare, Grid3X3, LogOut, Menu, MessageCircle, Settings, UserRound, Video, X } from 'lucide-react';

import { showToast } from '@/lib/toast';
import { useAuthStore, type User } from '@/stores/authStore';

type NavItem = {
  label: string;
  to: string;
  icon: typeof Grid3X3;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: Grid3X3 },
  { label: 'Calendar', to: '/calendar', icon: CalendarCheck },
  { label: 'Messenger', to: '/messenger', icon: MessageCircle },
  { label: 'Tasks', to: '/action-items', icon: CheckSquare },
  { label: 'Meetings', to: '/meeting/demo/lobby', icon: Video },
];

function getUserInitials(user: User | null): string {
  const source = user?.display_name || user?.email || 'MeetIO User';
  const words = source
    .replace(/@.*/, '')
    .split(/\s+|[._-]+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .padEnd(2, 'M')
    .slice(0, 2);
}

function navButtonClass({ isActive }: { isActive: boolean }) {
  return [
    'inline-flex items-center gap-2 border-2 border-ink-black bg-cream-canvas px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.06em] text-ink-black shadow-hard transition-all duration-200',
    'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-electric-pink hover:shadow-hard-hover',
    'active:translate-x-0.5 active:translate-y-0.5 active:bg-electric-pink active:text-white active:shadow-hard-active',
    isActive ? 'translate-x-0.5 translate-y-0.5 bg-electric-pink text-white shadow-hard-active' : '',
  ].join(' ');
}

function actionButtonClass(extra = '') {
  return [
    'relative grid h-[42px] w-[42px] place-items-center border-2 border-ink-black bg-ink-black text-cream-canvas shadow-hard transition-all duration-200',
    'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-cream-canvas hover:text-ink-black hover:shadow-[6px_6px_0_0_#0a0a0a]',
    'active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-active',
    extra,
  ].join(' ');
}

export function DashboardTopNav({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const initials = getUserInitials(user);

  const handleSignOut = async () => {
    await logout();
    showToast({
      tone: 'success',
      title: 'Signed Out',
      message: 'You have been signed out on this device.',
    });
    navigate('/signin', { replace: true });
  };

  const closeMobileMenu = () => setIsMobileOpen(false);

  return (
    <>
      <nav className="sticky top-0 z-40 flex h-20 items-center justify-between border-b-[4px] border-ink-black bg-ghost-white px-4 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex w-auto items-center gap-4 lg:w-64"
          aria-label="Go to dashboard"
        >
          <span className="grid h-10 w-10 place-items-center bg-ink-black text-white shadow-[3px_3px_0_0_#0a0a0a] transition-transform duration-200 hover:animate-[logoJiggle_0.5s_ease-in-out_infinite]">
            <Video className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl uppercase tracking-[-0.05em] text-ink-black">MeetIO</span>
        </button>

        <div className="hidden flex-1 items-center justify-center gap-4 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={navButtonClass}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden xl:inline">{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="hidden w-64 items-center justify-end gap-4 md:flex">
          <button type="button" className={actionButtonClass('notification-ping')} title="Notifications">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => navigate('/settings')} className={actionButtonClass()} title="Settings">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => navigate('/profile')} className={actionButtonClass()} title="User Profile">
            <span className="font-display text-[10px] font-black">{initials}</span>
          </button>
          <button type="button" onClick={handleSignOut} className={actionButtonClass('bg-electric-pink text-ink-black')} title="Sign Out">
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileOpen((value) => !value)}
          className={actionButtonClass('md:hidden')}
          aria-expanded={isMobileOpen}
          aria-controls="mobile-dashboard-menu"
          aria-label="Toggle navigation menu"
        >
          {isMobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </nav>

      <div
        id="mobile-dashboard-menu"
        className={[
          'fixed left-0 right-0 top-20 z-30 border-b-[4px] border-ink-black bg-ghost-white px-5 transition-[max-height,padding] duration-300 md:hidden',
          isMobileOpen ? 'max-h-[620px] overflow-y-auto py-6' : 'max-h-0 overflow-hidden py-0',
        ].join(' ')}
      >
        <div className="mb-6">
          <p className="mb-3 border-b-2 border-ink-black pb-2 font-display text-xs font-black uppercase tracking-[0.1em] text-ink-black">
            Navigation
          </p>
          <div className="flex flex-col gap-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} onClick={closeMobileMenu} className={navButtonClass}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-3 border-b-2 border-ink-black pb-2 font-display text-xs font-black uppercase tracking-[0.1em] text-ink-black">
            Quick Actions
          </p>
          <div className="flex items-center gap-3 border-t-2 border-dashed border-ink-black pt-4">
            <button type="button" className={actionButtonClass('notification-ping')} title="Notifications">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => navigate('/settings')} className={actionButtonClass()} title="Settings">
              <Settings className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => navigate('/profile')} className={actionButtonClass()} title="User Profile">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={handleSignOut} className={actionButtonClass('bg-electric-pink text-ink-black')} title="Sign Out">
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
