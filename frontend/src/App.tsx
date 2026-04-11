import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
    collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, getDoc, setDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Sidebar } from './components/Sidebar';
import type { PyqItem } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ProblemSolver } from './components/ProblemSolver';
import { Concepts } from './components/Concepts';
import { Practice } from './components/Practice';
import { Analytics } from './components/Analytics';
import { Achievements } from './components/Achievements';
import { PYQBank } from './components/PYQBank';
import { LoginPage } from './components/LoginPage';
import { SettingsPage } from './components/SettingsPage';
import { YouTubeVideos } from './components/YouTubeVideos';
import { TeacherPortal } from './components/TeacherPortal';
import { TeacherExams } from './components/TeacherExams';
import { translations, Language } from './translations';
import { Globe, GraduationCap, BookOpen } from 'lucide-react';

interface User {
    name: string;
    email: string;
    uid: string;
    role: 'teacher' | 'student';
    community_id?: string;
    community_name?: string;
    photoURL?: string;
}

export interface Activity {
    id: string;
    title: string;
    category: string;
    time: string;
    xp: string;
    type: 'solve' | 'concept' | 'achievement';
}

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [pyqs, setPyqs] = useState<PyqItem[]>([]);
    const [authLoading, setAuthLoading] = useState(true);
    const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('stem_lang') as Language) || 'English');
    const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(() => (localStorage.getItem('stem_theme') as any) || 'dark');
    const [accent, setAccent] = useState<'blue' | 'purple' | 'emerald' | 'orange'>(() => (localStorage.getItem('stem_accent') as any) || 'blue');
    const [activities, setActivities] = useState<Activity[]>(() => {
        try { return JSON.parse(localStorage.getItem('stem_activities') || '[]'); } catch { return []; }
    });

    const t = translations[language];

    useEffect(() => { localStorage.setItem('stem_lang', language); }, [language]);
    useEffect(() => {
        localStorage.setItem('stem_theme', theme);
        document.documentElement.classList.toggle('light-theme', theme === 'light');
    }, [theme]);
    useEffect(() => {
        localStorage.setItem('stem_accent', accent);
        const colors = { blue: '#3b82f6', purple: '#a855f7', emerald: '#10b981', orange: '#f97316' };
        document.documentElement.style.setProperty('--brand-accent', colors[accent]);
    }, [accent]);
    useEffect(() => { localStorage.setItem('stem_activities', JSON.stringify(activities)); }, [activities]);

    const updateUserStats = async (xpGain: number) => {
        if (!user) return;
        try {
            const profileRef = doc(db, 'profiles', user.uid);
            const snap = await getDoc(profileRef);
            if (snap.exists()) {
                const data = snap.data();
                const newXP = (data.xp || 0) + xpGain;
                const newSolved = (data.problems_solved || 0) + 1;
                await setDoc(profileRef, {
                    xp: newXP,
                    problems_solved: newSolved,
                    last_active: new Date().toISOString()
                }, { merge: true });

                // Update local state too
                setUser({ ...user, xp: newXP, problems_solved: newSolved } as any);
            }
        } catch (e) {
            console.error('Error updating stats:', e);
        }
    };

    const addActivity = (activity: Omit<Activity, 'id' | 'time'>) => {
        setActivities(prev => [{ ...activity, id: Math.random().toString(36).substr(2, 9), time: 'Just now' }, ...prev].slice(0, 10));
        if (activity.type === 'solve') {
            updateUserStats(20);
        } else if (activity.type === 'concept') {
            updateUserStats(5);
        }
    };

    // ── Firebase Auth Observer ───────────────────────────────────
    useEffect(() => {
        // Restore user from localStorage while Firebase loads
        const stored = localStorage.getItem('stem_user');
        if (stored) {
            try { setUser(JSON.parse(stored)); } catch { }
        }

        const unsub = onAuthStateChanged(auth, async firebaseUser => {
            if (!firebaseUser) {
                setUser(null);
                localStorage.removeItem('stem_user');
                setAuthLoading(false);
                return;
            }

            // If we already have user data in localStorage, use it right away
            // (avoids extra Firestore read on every page refresh)
            const storedUser = localStorage.getItem('stem_user');
            if (storedUser) {
                try {
                    const parsed = JSON.parse(storedUser);
                    if (parsed.uid === firebaseUser.uid) {
                        setUser(parsed);
                        setAuthLoading(false);
                        return;
                    }
                } catch { }
            }

            // Otherwise read from Firestore
            try {
                const profileSnap = await getDoc(doc(db, 'profiles', firebaseUser.uid));
                if (profileSnap.exists()) {
                    const data = profileSnap.data();
                    const userData: User = {
                        uid: firebaseUser.uid,
                        name: data.name,
                        email: data.email,
                        role: data.role,
                        community_id: data.community_id,
                        community_name: data.community_name,
                        photoURL: data.photoURL,
                    };
                    setUser(userData);
                    localStorage.setItem('stem_user', JSON.stringify(userData));
                }
            } catch (e) {
                console.error('Error loading profile:', e);
            }
            setAuthLoading(false);
        });

        return () => unsub();
    }, []);

    // ── Enforce Role Restrictions
    useEffect(() => {
        if (user && user.role === 'teacher' && (activeTab === 'practice' || activeTab === 'analytics')) {
            setActiveTab('teacher');
        }
    }, [user, activeTab]);

    // ── Firestore PYQ Bank (real-time) ─────────────────────────
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'universal_pyqs'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, snap => {
            setPyqs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        });
        return () => unsub();
    }, [user]);

    const handleLogin = (u: User) => { 
        setUser(u); 
        localStorage.setItem('stem_user', JSON.stringify(u)); 
        if (u.role === 'teacher') setActiveTab('teacher');
    };

    const handleLogout = async () => {
        await signOut(auth);
        localStorage.removeItem('stem_user');
        setUser(null);
        setActiveTab('dashboard');
    };

    const handleAddPyq = async (q: PyqItem) => {
        const isDupe = pyqs.some(p => p.question === q.question && p.exam === q.exam);
        if (!isDupe) {
            await addDoc(collection(db, 'universal_pyqs'), {
                ...q, createdAt: new Date().toISOString(), added_by: user?.email || 'unknown'
            });
        }
    };

    const handleRemovePyq = async (idxOrId: number | string) => {
        const item = typeof idxOrId === 'number' ? pyqs[idxOrId] : pyqs.find(p => (p as any).id === idxOrId);
        const id = (item as any)?.id;
        if (id) await deleteDoc(doc(db, 'universal_pyqs', id));
    };

    const handleAddExamResult = async (result: any) => {
        if (!user) return;
        try {
            await addDoc(collection(db, 'exam_results'), {
                ...result,
                studentUid: user.uid,
                studentName: user.name,
                studentEmail: user.email,
                community_id: user.community_id || 'none'
            });
        } catch (e) {
            console.error('Error saving exam result:', e);
        }
    };

    const handleUpdateProfile = async (data: Partial<{ name: string; photoURL: string }>) => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'profiles', user.uid), data, { merge: true });
            const newUser = { ...user, ...data };
            setUser(newUser);
            localStorage.setItem('stem_user', JSON.stringify(newUser));
        } catch (e) {
            console.error('Error updating profile:', e);
        }
    };

    const handlePractice = (q: PyqItem) => {
        setActiveTab('solver');
        window.dispatchEvent(new CustomEvent('pyq-practice', { detail: q.question }));
    };

    const handleUseFormula = (eq: string) => {
        setActiveTab('solver');
        setTimeout(() => window.dispatchEvent(new CustomEvent('pyq-practice', { detail: eq })), 80);
    };

    const tabLabel: Record<string, string> = {
        dashboard: t.sidebar.dashboard,
        solver: t.sidebar.solver,
        concepts: t.sidebar.concepts,
        practice: t.sidebar.practice,
        pyqbank: t.sidebar.pyqbank,
        analytics: t.sidebar.analytics,
        achievements: t.sidebar.achievements,
        settings: t.sidebar.settings,
        videos: 'Video Library',
        teacher: 'Teacher Portal',
        teacher_exams: 'Teacher Exams',
    };

    if (authLoading) {
        return (
            <div className="h-screen bg-[#050c1a] flex items-center justify-center">
                <div className="flex flex-col items-center space-y-6">
                    <div className="w-20 h-20 relative">
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
                        <img src="/logo.png" alt="STEM Engine Logo" className="w-full h-full object-contain relative z-10 animate-bounce" />
                    </div>
                    <div className="flex flex-col items-center space-y-2">
                        <p className="text-white text-lg font-bold tracking-widest uppercase">STEM Engine</p>
                        <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 animate-loading-bar" />
                        </div>
                        <p className="text-slate-500 text-[10px] font-medium tracking-tight">Initializing AI systems...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) return <LoginPage onLogin={handleLogin} />;

    const isTeacher = user.role === 'teacher';
    const langClass = language === 'Hindi' ? 'lang-hi' : language === 'Telugu' ? 'lang-te' : '';

    return (
        <div className={`flex h-screen bg-[#0b1121] text-brand-text font-sans overflow-hidden ${langClass}`}>
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} pyqs={pyqs} language={language} userRole={user.role} />

            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#080e1a]">
                {/* Top Bar */}
                <header className="px-6 md:px-8 py-4 flex items-center justify-between shrink-0 bg-[#0b1121]/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/[0.03]">
                    <div className="flex items-center space-x-3">
                        <h2 className="text-base md:text-lg font-semibold text-white tracking-wide">{tabLabel[activeTab] ?? activeTab}</h2>
                        {user.community_name && (
                            <span className={`hidden sm:inline text-xs font-semibold px-2.5 py-0.5 rounded-full border ${isTeacher ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                                {user.community_name}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-3">
                        {/* Language */}
                        <div className="hidden sm:flex items-center space-x-2 bg-brand-surface/50 border border-brand-muted/10 px-3 py-1.5 rounded-xl">
                            <Globe className="w-4 h-4 text-blue-400" />
                            <select value={language} onChange={e => setLanguage(e.target.value as Language)}
                                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-medium">
                                <option value="English" className="bg-[#0b1121]">English</option>
                                <option value="Hindi" className="bg-[#0b1121]">हिन्दी</option>
                                <option value="Telugu" className="bg-[#0b1121]">తెలుగు</option>
                            </select>
                        </div>

                        {/* Role badge */}
                        <div className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border ${isTeacher ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-purple-500/10 border-purple-500/20 text-purple-400'}`}>
                            {isTeacher ? <GraduationCap className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                            <span className="text-xs font-semibold capitalize">{user.role}</span>
                        </div>

                        {/* Avatar */}
                        <button onClick={() => setActiveTab('settings')}
                            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl hover:bg-brand-surface/50 transition-all group">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg overflow-hidden shrink-0 ${isTeacher ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-purple-600/20 border border-purple-500/30'}`}>
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className={`text-[11px] font-bold ${isTeacher ? 'text-blue-300' : 'text-purple-300'}`}>
                                        {user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                    </span>
                                )}
                            </div>
                            <span className="text-sm font-semibold text-brand-muted group-hover:text-white transition-colors hidden sm:block truncate max-w-[100px]">{user.name.split(' ')[0]}</span>
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="p-4 md:p-8 flex-1 overflow-y-auto">
                    {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} language={language} activities={activities} stats={user as any} />}
                    {activeTab === 'solver' && <ProblemSolver onAddPyq={handleAddPyq} language={language} onSolveSuccess={() => addActivity({ title: 'Solved a Problem', category: 'Solver', xp: '+20 XP', type: 'solve' })} />}
                    {activeTab === 'concepts' && <Concepts onUseFormula={handleUseFormula} language={language} onTopicSelect={topic => addActivity({ title: topic, category: 'Concepts', xp: '+5 XP', type: 'concept' })} role={user.role} />}
                    {activeTab === 'practice' && <Practice onSolveProblem={handleUseFormula} language={language} user={user} onAddExamResult={handleAddExamResult} />}
                    {activeTab === 'pyqbank' && <PYQBank pyqs={pyqs} onAddPyq={handleAddPyq} onRemovePyq={handleRemovePyq} onPractice={handlePractice} language={language} />}
                    {activeTab === 'analytics' && <Analytics language={language} />}
                    {activeTab === 'achievements' && <Achievements language={language} />}
                    {activeTab === 'videos' && <YouTubeVideos role={user.role} communityId={user.community_id} />}
                    {activeTab === 'teacher' && isTeacher && <TeacherPortal user={user} />}
                    {activeTab === 'teacher_exams' && isTeacher && <TeacherExams user={user} />}
                    {activeTab === 'settings' && (
                        <SettingsPage
                            user={user}
                            onLogout={handleLogout}
                            onUpdateProfile={handleUpdateProfile}
                            language={language}
                            onLanguageChange={setLanguage}
                            theme={theme}
                            setTheme={setTheme}
                            accent={accent}
                            setAccent={setAccent}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
