import React from 'react';
import { Brain, Flame, Target, TrendingUp, Zap, ChevronRight, BookOpen, Atom, Shell, Sigma, CheckCircle2, Trophy, Sparkles, Microscope } from 'lucide-react';
import { translations, Language } from '../translations';
import { Activity } from '../App';

export const Dashboard: React.FC<{
    onNavigate?: (tab: string) => void;
    language: Language;
    activities: Activity[];
    stats?: { problems_solved: number; xp: number; streak: number };
}> = ({ onNavigate, language, activities, stats }) => {
    const t = translations[language];
    return (
        <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-brand-surface/80 to-brand-dark p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 max-w-2xl">
                    <h2 className="text-3xl font-bold text-white mb-3">{t.dashboard.welcome}</h2>
                    <p className="text-brand-muted text-lg mb-6 leading-relaxed">
                        {t.dashboard.subtitle}
                    </p>
                    <button
                        onClick={() => onNavigate?.('solver')}
                        className="bg-brand-accent hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-xl transition-all flex items-center space-x-2.5 shadow-lg shadow-brand-accent/25 hover:scale-[1.02] active:scale-[0.98]">
                        <img src="/logo.png" alt="" className="w-5 h-5 object-contain" />
                        <span>{t.dashboard.solve_btn}</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<Brain className="w-5 h-5 text-blue-400" />}
                    value={stats?.problems_solved || 0}
                    label={t.dashboard.stats.solved}
                    bgClass="bg-[#0f172a]"
                />
                <StatCard
                    icon={<Flame className="w-5 h-5 text-orange-400" />}
                    value={stats?.streak || 0}
                    label={t.dashboard.stats.streak}
                    subLabel="Keep it going!"
                    bgClass="bg-[#0f172a]"
                />
                <StatCard
                    icon={<Target className="w-5 h-5 text-emerald-400" />}
                    value="100%"
                    label={t.dashboard.stats.accuracy}
                    bgClass="bg-[#0f172a]"
                />
                <StatCard
                    icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
                    value={Math.floor((stats?.xp || 0) / 100)}
                    label={t.dashboard.stats.mastered}
                    bgClass="bg-[#0f172a]"
                />
            </div>

            {/* Level & Progress */}
            <div className="bg-[#0f172a] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-sm">
                <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-end">
                        <div className="flex items-center space-x-3">
                            <div className="bg-orange-500/20 p-2.5 rounded-xl relative">
                                <Zap className="w-6 h-6 text-orange-500 fill-orange-500" />
                                <span className="absolute -bottom-1 -right-1 bg-[#0b1121] text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                                    {Math.floor((stats?.xp || 0) / 100) + 1}
                                </span>
                            </div>
                            <div>
                                <p className="text-brand-muted text-sm font-medium">Level {Math.floor((stats?.xp || 0) / 100) + 1}</p>
                                <div className="flex items-center space-x-1.5">
                                    <Zap className="w-4 h-4 text-orange-500 fill-orange-500" />
                                    <span className="text-xl font-bold text-white">{stats?.xp || 0} XP</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-brand-muted text-xs font-medium">Next level</p>
                            <p className="text-white font-semibold">{(Math.floor((stats?.xp || 0) / 100) + 1) * 100} XP</p>
                        </div>
                    </div>
                    <div className="h-2 w-full bg-brand-surface rounded-full overflow-hidden">
                        <div
                            className="h-full bg-orange-500 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                            style={{ width: `${(stats?.xp || 0) % 100}%` }}
                        ></div>
                    </div>
                    <p className="text-brand-muted text-xs font-medium text-right">{(stats?.xp || 0) % 100}% to Next Level</p>
                </div>

                <div className="flex items-center space-x-6 shrink-0 pt-6 md:pt-0 md:pl-8">
                    <CircularProgress percentage={Math.min(100, (stats?.problems_solved || 0) * 10)} label="Mastery" subtitle={`${stats?.problems_solved || 0} solved`} color="text-blue-500" icon={<Atom className="w-4 h-4" />} />
                </div>
            </div>

            {/* Lists Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                <div>
                    <h3 className="text-sm font-bold text-brand-muted uppercase tracking-wider mb-4">{t.dashboard.quick_actions}</h3>
                    <div className="space-y-3">
                        <ActionCard icon={<Atom className="w-5 h-5" />} title="Solve Problem" subtitle="AI-powered solving" onClick={() => onNavigate?.('solver')} />
                        <ActionCard icon={<BookOpen className="w-5 h-5" />} title="Explore Concepts" subtitle="Browse topics" onClick={() => onNavigate?.('concepts')} />
                        <ActionCard icon={<Target className="w-5 h-5" />} title="Practice Exam" subtitle="Test your skills" onClick={() => onNavigate?.('practice')} />
                        <ActionCard icon={<Brain className="w-5 h-5" />} title="PYQ Bank" subtitle="Past year questions" onClick={() => onNavigate?.('pyqbank')} />
                    </div>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-brand-muted uppercase tracking-wider mb-4">{t.dashboard.recent_activity}</h3>
                    <div className="space-y-3">
                        {activities.map(activity => (
                            <ActivityCard
                                key={activity.id}
                                title={activity.title}
                                category={activity.category}
                                time={activity.time}
                                xp={activity.xp}
                                type={activity.type}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sub-components
const StatCard = ({ icon, value, label, subLabel, bgClass }: any) => (
    <div className={`${bgClass} p-5 rounded-xl flex flex-col space-y-3 hover:bg-brand-surface/80 transition-all shadow-sm`}>
        <div className="bg-brand-surface/50 w-10 h-10 rounded-lg flex items-center justify-center shadow-sm">
            {icon}
        </div>
        <div>
            <h3 className="text-2xl font-bold text-white leading-none mb-1">{value}</h3>
            <p className="text-brand-muted text-sm">{label}</p>
            {subLabel && <p className="text-brand-muted/50 text-xs mt-0.5">{subLabel}</p>}
        </div>
    </div>
);

const CircularProgress = ({ percentage, label, subtitle, color, icon }: any) => {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-16 h-16 flex items-center justify-center">
                {/* Background Track */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r={radius} fill="transparent" stroke="currentColor" strokeWidth="3" className="text-white/5" />
                    {/* Foreground Progress */}
                    <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className={`${color} transition-all duration-1000 ease-out`}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                    {percentage}%
                </div>
            </div>
            <div className="mt-3 text-center flex items-center space-x-1.5">
                <div className={`p-1 rounded bg-brand-surface ${color} opacity-80`}>
                    {icon}
                </div>
                <div className="text-left">
                    <p className="text-xs font-bold text-white leading-tight">{label}</p>
                    <p className="text-[10px] text-brand-muted leading-tight">{subtitle}</p>
                </div>
            </div>
        </div>
    );
};

const ActionCard = ({ icon, title, subtitle, onClick }: any) => (
    <div onClick={onClick} className="bg-[#0f172a] hover:bg-brand-surface/60 p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all group active:scale-[0.98] shadow-sm">
        <div className="flex items-center space-x-4">
            <div className="bg-brand-surface w-10 h-10 rounded-lg flex items-center justify-center text-brand-accent group-hover:text-blue-400 group-hover:bg-brand-accent/10 transition-colors">
                {icon}
            </div>
            <div>
                <h4 className="text-white font-medium text-sm">{title}</h4>
                <p className="text-brand-muted text-xs mt-0.5">{subtitle}</p>
            </div>
        </div>
        <ChevronRight className="w-4 h-4 text-brand-muted group-hover:text-white transition-colors" />
    </div>
);

const ActivityCard = ({ title, category, time, xp, type }: any) => {
    const getIcon = () => {
        switch (type) {
            case 'solve': return <Atom className="w-5 h-5" />;
            case 'achievement': return <Trophy className="w-5 h-5 text-yellow-500" />;
            default: return <Sparkles className="w-5 h-5 text-purple-400" />;
        }
    };

    return (
        <div className="bg-[#0f172a] p-4 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-4">
                <div className="bg-brand-surface w-10 h-10 rounded-lg flex items-center justify-center text-blue-400">
                    {getIcon()}
                </div>
                <div>
                    <h4 className="text-white font-medium text-sm">{title}</h4>
                    <div className="flex items-center space-x-2 mt-0.5">
                        <p className="text-brand-muted text-xs">{category}</p>
                        <span className="w-1 h-1 bg-brand-muted/30 rounded-full"></span>
                        <p className="text-brand-muted text-xs">{time}</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <span className="text-orange-400 text-xs font-bold">{xp}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
        </div>
    );
};
