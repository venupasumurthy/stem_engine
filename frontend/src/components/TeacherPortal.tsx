import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import {
    collection, query, where, onSnapshot, doc, getDoc
} from 'firebase/firestore';
import {
    Users, Trophy, Copy, CheckCheck, Loader, Star, Hash
} from 'lucide-react';

interface TeacherPortalProps {
    user: { name: string; email: string; uid: string; community_id?: string; community_name?: string };
}

interface StudentData {
    uid: string; name: string; email: string; photoURL?: string;
    problems_solved: number; xp: number; streak: number;
}
interface CommunityData { id: string; name: string; passcode: string; createdAt?: string; }

// ─────────────────────────────────────────────────────────────────────────
export const TeacherPortal: React.FC<TeacherPortalProps> = ({ user }) => {
    const [students, setStudents] = useState<StudentData[]>([]);
    const [community, setCommunity] = useState<CommunityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [tab, setTab] = useState<'leaderboard' | 'all'>('leaderboard');

    // ── Firestore listeners
    useEffect(() => {
        if (!user.community_id) { setLoading(false); return; }

        const loadCommunity = async () => {
            const snap = await getDoc(doc(db, 'communities', user.community_id!));
            if (snap.exists()) setCommunity({ id: snap.id, ...snap.data() } as CommunityData);
        };
        loadCommunity();

        const membersQ = query(
            collection(db, 'community_members'),
            where('community_id', '==', user.community_id),
            where('role', '==', 'student')
        );
        const unsub = onSnapshot(membersQ, async snap => {
            const memberIds = snap.docs.map(d => d.data().user_id as string);
            if (memberIds.length === 0) { setStudents([]); setLoading(false); return; }
            const profilePromises = memberIds.map(uid => getDoc(doc(db, 'profiles', uid)));
            const profileSnaps = await Promise.all(profilePromises);
            setStudents(profileSnaps.filter(s => s.exists()).map(s => {
                const d = s.data()!;
                return { uid: s.id, name: d.name || 'Unknown', email: d.email || '', photoURL: d.photoURL || '', problems_solved: d.problems_solved || 0, xp: d.xp || 0, streak: d.streak || 0 };
            }));
            setLoading(false);
        });

        return () => { unsub(); };
    }, [user.community_id]);

    // ── Helpers
    const copyPasscode = () => {
        if (community?.passcode) { navigator.clipboard.writeText(community.passcode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };
    const sorted = [...students].sort((a, b) => b.xp - a.xp);
    const top3 = sorted.slice(0, 3);
    const totalProblems = students.reduce((s, st) => s + st.problems_solved, 0);
    const avgXP = students.length ? Math.round(students.reduce((s, st) => s + st.xp, 0) / students.length) : 0;
    const getBadge = (xp: number) => {
        if (xp >= 500) return { label: 'Expert', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
        if (xp >= 200) return { label: 'Advanced', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
        if (xp >= 50) return { label: 'Intermediate', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
        return { label: 'Beginner', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    };

    // ── Helpers

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-3">
                <Loader className="w-6 h-6 text-blue-400 animate-spin" />
                <p className="text-slate-400 text-sm">Loading teacher portal...</p>
            </div>
        </div>
    );

    if (!user.community_id) return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <Users className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-white font-bold text-lg mb-2">No Community Yet</p>
            <p className="text-slate-400 text-sm">Sign out and sign up again to create your community.</p>
        </div>
    );

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            {/* Community Card */}
            <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center space-x-2 mb-1">
                            <Users className="w-5 h-5 text-blue-400" />
                            <h2 className="text-xl font-bold text-white">{community?.name || user.community_name || 'Your Community'}</h2>
                        </div>
                        <p className="text-slate-400 text-sm">{students.length} students enrolled</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="bg-[#0b1121] border border-white/10 rounded-xl px-4 py-2 flex items-center space-x-2">
                            <Hash className="w-4 h-4 text-blue-400" />
                            <span className="text-white font-mono font-bold text-lg tracking-widest">{community?.passcode || '—'}</span>
                        </div>
                        <button onClick={copyPasscode} className="flex items-center space-x-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                            {copied ? <><CheckCheck className="w-4 h-4" /><span>Copied!</span></> : <><Copy className="w-4 h-4" /><span>Copy Code</span></>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Students', value: students.length, icon: Users, color: 'blue' },
                    { label: 'Problems Solved', value: totalProblems, icon: Trophy, color: 'emerald' },
                    { label: 'Avg XP', value: avgXP, icon: Star, color: 'yellow' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-[#0f172a] border border-white/5 rounded-2xl p-4">
                        <div className={`w-8 h-8 rounded-lg mb-3 flex items-center justify-center bg-${color}-500/15`}>
                            <Icon className={`w-4 h-4 text-${color}-400`} />
                        </div>
                        <p className="text-2xl font-bold text-white">{value}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Tab selector */}
            <div className="flex flex-wrap gap-1 bg-[#0f172a] border border-white/5 rounded-xl p-1 w-fit">
                {([
                    { id: 'leaderboard', label: 'Leaderboard' },
                    { id: 'all', label: 'All Students' },
                ] as const).map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── LEADERBOARD ── */}
            {tab === 'leaderboard' && (
                <div className="space-y-3">
                    {top3.length === 0 ? (
                        <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-8 text-center">
                            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-400">No students enrolled yet.</p>
                        </div>
                    ) : top3.map((s, i) => {
                        const badge = getBadge(s.xp);
                        return (
                            <div key={s.uid} className={`flex items-center gap-4 p-4 rounded-2xl border ${i === 0 ? 'bg-yellow-500/5 border-yellow-500/15' : 'bg-[#0f172a] border-white/5'}`}>
                                <div className="relative shrink-0">
                                    {s.photoURL ? <img src={s.photoURL} alt={s.name} className="w-12 h-12 rounded-full object-cover border-2 border-white/10" /> : (
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : 'bg-orange-500/20 text-orange-400'}`}>{i + 1}</div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-semibold text-sm truncate">{s.name}</p>
                                    <p className="text-slate-500 text-xs truncate">{s.email}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-white font-bold">{s.xp} XP</p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>
                                </div>
                                {i === 0 && <Trophy className="w-5 h-5 text-yellow-400 shrink-0" />}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── ALL STUDENTS ── */}
            {tab === 'all' && (
                <div className="bg-[#0f172a] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <h3 className="text-white font-semibold text-sm">All Enrolled Students ({students.length})</h3>
                    </div>
                    {sorted.length === 0 ? (
                        <div className="p-8 text-center"><p className="text-slate-400 text-sm">No students yet.</p></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">Student</th>
                                        <th className="px-4 py-3 text-center text-xs text-slate-500 font-semibold uppercase tracking-wider">XP</th>
                                        <th className="px-4 py-3 text-center text-xs text-slate-500 font-semibold uppercase tracking-wider">Solved</th>
                                        <th className="px-4 py-3 text-center text-xs text-slate-500 font-semibold uppercase tracking-wider">Level</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(s => {
                                        const badge = getBadge(s.xp);
                                        return (
                                            <tr key={s.uid} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center space-x-3">
                                                        {s.photoURL ? <img src={s.photoURL} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" /> : (
                                                            <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                                                                <span className="text-blue-300 text-xs font-bold">{s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                                                            </div>
                                                        )}
                                                        <div><p className="text-white font-medium">{s.name}</p><p className="text-slate-500 text-xs">{s.email}</p></div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center"><span className="text-white font-bold">{s.xp}</span></td>
                                                <td className="px-4 py-3 text-center"><span className="text-slate-300">{s.problems_solved}</span></td>
                                                <td className="px-4 py-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};
