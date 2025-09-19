import {
  PlusCircleIcon,
  AdjustmentsHorizontalIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';

interface MobileNavBarProps {
  onNewChat: () => void;
  onOpenSettings: () => void;
  onToggleDrawer: () => void;
}

export function MobileNavBar({ onNewChat, onOpenSettings, onToggleDrawer }: MobileNavBarProps) {
  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#141414]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-around px-6 py-3 text-white/70">
        <button
          onClick={onToggleDrawer}
          className="flex flex-col items-center text-xs font-medium gap-1"
        >
          <Squares2X2Icon className="h-6 w-6" />
          Übersicht
        </button>
        <button
          onClick={onNewChat}
          className="flex -translate-y-6 flex-col items-center rounded-full bg-gradient-to-r from-brand-gold via-brand-deep to-brand-gold p-4 text-xs font-semibold text-surface-base shadow-glow"
        >
          <PlusCircleIcon className="h-6 w-6" />
          Neu
        </button>
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center text-xs font-medium gap-1"
        >
          <AdjustmentsHorizontalIcon className="h-6 w-6" />
          Settings
        </button>
      </div>
    </nav>
  );
}
