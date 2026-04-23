import React from 'react';
import { useAuth } from '../App';
import { LogOut, Home, Briefcase, FileText, Plus, Settings } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Overview', icon: Home, path: '/' },
    { name: 'Daily Logs', icon: FileText, path: '/daily-logs/new' },
    { name: 'Projects', icon: Briefcase, path: '/projects' },
    { name: 'Parameters', icon: Settings, path: '/parameters' },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row">
      {/* Sidebar / Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 h-full flex flex-col md:fixed md:inset-y-0 text-slate-400">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-400 rounded-md flex items-center justify-center font-black text-slate-900 tracking-tighter">N</div>
          <span className="text-white font-bold text-xl tracking-tight uppercase">Nexum</span>
        </div>

        <nav className="flex-1 px-4 mt-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                location.pathname === item.path 
                  ? "bg-slate-800 text-amber-400" 
                  : "text-slate-400 hover:text-white"
              )}
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{profile?.name?.charAt(0)}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs text-white font-semibold truncate">{profile?.name}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">{profile?.role}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm uppercase tracking-widest font-bold text-[10px]">Projects</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold text-sm">Active Workspace</span>
          </div>
        </header>
        <div className="bg-slate-50 min-h-[calc(100vh-64px)]">
          {children}
        </div>
      </main>

      {/* Mobile Floating Action Button */}
      {profile?.role === 'inspector' && (
        <Link 
          to="/daily-logs/new"
          className="fixed bottom-6 right-6 h-14 w-14 bg-stone-900 text-white rounded-full shadow-lg flex items-center justify-center md:hidden"
        >
          <Plus size={24} />
        </Link>
      )}
    </div>
  );
}
