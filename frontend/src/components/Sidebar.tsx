import React from 'react';
import {
    LayoutDashboard,
    Atom,
    Compass,
    Target,
    BarChart2,
    Trophy,
    BookMarked,
    ChevronRight,
    Settings,
    Youtube,
    GraduationCap,
} from 'lucide-react';
import { translations, Language } from '../translations';

export interface PyqItem {
    question: string;
    exam?: string;
    year?: string;
    subject?: string;
    savedAt: string;
}

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    pyqs?: PyqItem[];
    language: Language;
    userRole?: 'teacher' | 'student';
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, pyqs = [], language, userRole }) => {
    const t = translations[language];
    const isTeacher = userRole === 'teacher';

    const menuItems = [
        { id: 'dashboard', label: t.sidebar.dashboard, icon: LayoutDashboard },
        { id: 'solver', label: t.sidebar.solver, icon: Atom, hasArrow: true },
        { id: 'concepts', label: t.sidebar.concepts, icon: Compass },
        ...(!isTeacher ? [{ id: 'practice', label: t.sidebar.practice, icon: Target }] : []),
        { id: 'pyqbank', label: t.sidebar.pyqbank, icon: BookMarked, badge: pyqs.length > 0 ? pyqs.length : undefined },
        { id: 'videos', label: 'Video Library', icon: Youtube },
        ...(!isTeacher ? [{ id: 'analytics', label: t.sidebar.analytics, icon: BarChart2 }] : []),
        { id: 'achievements', label: t.sidebar.achievements, icon: Trophy },
    ];

    // Teacher-only item
    const teacherItems = isTeacher
        ? [
            { id: 'teacher', label: 'Teacher Portal', icon: GraduationCap },
            { id: 'teacher_exams', label: 'Exams', icon: Target }
          ]
        : [];

    const bottomItems = [
        { id: 'settings', label: t.sidebar.settings, icon: Settings },
    ];

    const allItems = [...menuItems, ...teacherItems];

    return (
        <div className="w-64 bg-[#0b1121] h-screen flex flex-col hidden md:flex shadow-2xl z-20">
            {/* Logo */}
            <div className="p-6 flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 flex-shrink-0">
                    <img src="/logo.png" alt="STEM Engine Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 className="text-white font-bold text-lg tracking-wide leading-tight">STEM Engine</h1>
                    <p className="text-brand-muted text-[10px] uppercase font-semibold tracking-wider">AI · Google Powered</p>
                </div>
            </div>

            {/* Role badge */}
            {userRole && (
                <div className="px-4 mb-3">
                    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border ${isTeacher ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-purple-500/10 border-purple-500/20 text-purple-400'}`}>
                        {isTeacher ? <GraduationCap className="w-3.5 h-3.5" /> : <Trophy className="w-3.5 h-3.5" />}
                        <span className="text-xs font-semibold capitalize">{userRole}</span>
                    </div>
                </div>
            )}

            {/* Nav */}
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
                {allItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const isTeacherOnly = item.id === 'teacher';
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                ? isTeacherOnly
                                    ? 'bg-blue-500/15 text-blue-400 font-medium'
                                    : 'bg-brand-accent/10 text-brand-accent font-medium shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)]'
                                : 'text-brand-muted hover:bg-brand-surface/50 hover:text-brand-text'
                                }`}
                        >
                            <div className="flex items-center space-x-3">
                                <Icon
                                    className={`w-5 h-5 ${isActive ? (isTeacherOnly ? 'text-blue-400' : 'text-brand-accent') : 'text-brand-muted group-hover:text-brand-text'}`}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                <span className="text-sm">{item.label}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                {(item as any).badge && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent">
                                        {(item as any).badge}
                                    </span>
                                )}
                                {(item as any).hasArrow && isActive && (
                                    <ChevronRight className="w-3.5 h-3.5 text-brand-accent opacity-70" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </nav>

            {/* Bottom items */}
            <div className="px-4 pb-6 space-y-1">
                <div className="h-px bg-white/5 mb-3" />
                {bottomItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-brand-accent/10 text-brand-accent font-medium'
                                : 'text-brand-muted hover:bg-brand-surface/50 hover:text-brand-text'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-brand-accent' : 'text-brand-muted group-hover:text-brand-text'}`}
                                strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-sm">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
