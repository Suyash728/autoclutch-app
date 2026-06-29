import React from 'react';
import { ClipboardList, Sparkles, Calendar as CalendarIcon, Settings, User, LogOut, Mail } from 'lucide-react';

interface NavShellProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
  children: React.ReactNode;
  user: {
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  } | null;
  onSignOut: () => void;
}

export const NavShell: React.FC<NavShellProps> = ({
  currentTab,
  onChangeTab,
  children,
  user,
  onSignOut,
}) => {
  const menuItems = [
    { id: 'tasks', label: 'Tasks', icon: ClipboardList },
    { id: 'agent', label: 'Agent', icon: Sparkles },
    { id: 'gmail', label: 'Inbox Scan', icon: Mail },
    { id: 'schedule', label: 'Schedule', icon: CalendarIcon },
  ];

  const userDisplayName = user?.displayName || 'AutoClutch User';
  const userEmail = user?.email || 'user@autoclutch.ai';

  return (
    <div className="min-h-screen bg-bg-base text-on-surface flex flex-col lg:flex-row font-sans selection:bg-primary/30 select-none">
      
      {/* ========================================== */}
      {/* DESKTOP SIDEBAR (visible on lg screens only) */}
      {/* ========================================== */}
      <aside className="hidden lg:flex flex-col w-[280px] h-screen fixed left-0 top-0 bg-surface-container border-r border-white/5 p-6 z-20">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 mb-10 mt-2 px-2">
          {/* Brand dark logo in squircle shape */}
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-[0_4px_15px_rgba(91,79,227,0.4)] bg-transparent">
            <img src="/shared/assets/autoclutch_icon_dark.png" alt="AutoClutch" className="w-full h-full object-cover scale-110 rounded-xl" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">AutoClutch</h1>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest -mt-1">Autonomous Sync</p>
          </div>
        </div>

        {/* Navigation Menus */}
        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`w-full h-12 px-4 rounded-full flex items-center gap-4 transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white shadow-[0_4px_15px_rgba(91,79,227,0.35)] font-bold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-on-surface-variant'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer - Settings and User Account Profile */}
        <div className="pt-6 border-t border-white/5 space-y-4">
          {/* Settings Nav Item */}
          <button
            onClick={() => onChangeTab('settings')}
            className={`w-full h-12 px-4 rounded-full flex items-center gap-4 transition-all duration-300 cursor-pointer ${
              currentTab === 'settings'
                ? 'bg-primary text-white shadow-[0_4px_15px_rgba(91,79,227,0.35)] font-bold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5 font-medium'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>

          {/* User Profile Info with Sign Out option */}
          <div className="flex items-center justify-between gap-2 px-2 pt-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border border-primary/40 bg-surface-container-high flex items-center justify-center">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-5 h-5 text-primary" />
                )}
                {/* Micro green online indicator */}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-surface-container" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-on-surface truncate">{userDisplayName}</h4>
                <p className="text-xs text-on-surface-variant truncate">{userEmail}</p>
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="p-2 rounded-full hover:bg-urgent/10 text-on-surface-variant hover:text-urgent transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================== */}
      {/* MOBILE TOP BAR (visible on <= 480px) */}
      {/* ========================================== */}
      <header className="lg:hidden flex items-center justify-between h-16 px-6 bg-surface-container/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-transparent">
            <img src="/shared/assets/autoclutch_icon_dark.png" alt="AutoClutch" className="w-full h-full object-cover scale-110 rounded-lg" />
          </div>
          <span className="text-lg font-extrabold text-white tracking-tight">AutoClutch</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/40 bg-surface-container-high flex items-center justify-center">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User className="w-4 h-4 text-primary" />
            )}
          </div>
          <button
            onClick={onSignOut}
            className="p-1.5 rounded-full hover:bg-urgent/10 text-on-surface-variant hover:text-urgent transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================== */}
      {/* CONTENT AREA */}
      {/* ========================================== */}
      <main className="flex-1 lg:pl-[280px] min-h-[calc(100vh-4rem)] lg:min-h-screen pb-24 lg:pb-8">
        <div className="w-full max-w-7xl mx-auto p-4 md:p-8 lg:p-10">
          {children}
        </div>
      </main>

      {/* ========================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {/* ========================================== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container/95 backdrop-blur-lg border-t border-white/5 flex items-center justify-around z-30 px-2 pb-safe">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 cursor-pointer"
            >
              <div className={`p-1 rounded-full transition-all duration-300 ${isActive ? 'bg-primary/20 text-primary px-4' : 'text-on-surface-variant'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-semibold mt-1 tracking-wider ${isActive ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
        {/* Mobile Settings button */}
        <button
          onClick={() => onChangeTab('settings')}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 cursor-pointer"
        >
          <div className={`p-1 rounded-full transition-all duration-300 ${currentTab === 'settings' ? 'bg-primary/20 text-primary px-4' : 'text-on-surface-variant'}`}>
            <Settings className="w-5 h-5" />
          </div>
          <span className={`text-[10px] font-semibold mt-1 tracking-wider ${currentTab === 'settings' ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
            Settings
          </span>
        </button>
      </nav>

    </div>
  );
};
