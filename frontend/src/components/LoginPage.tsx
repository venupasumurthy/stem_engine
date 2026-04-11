import React, { useState } from 'react';
import {
    Atom, Eye, EyeOff, Zap, Brain, FlaskConical, Sigma,
    GraduationCap, BookOpen, ChevronRight, Plus, Hash, Users
} from 'lucide-react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    signInWithPopup
} from 'firebase/auth';
import {
    collection, addDoc, getDocs, query, where, setDoc, doc, getDoc
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

interface LoginPageProps {
    onLogin: (user: { name: string; email: string; role: 'teacher' | 'student'; community_id?: string; community_name?: string; uid: string }) => void;
}

type AuthMode = 'login' | 'signup';
type RoleView = 'teacher' | 'student';

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [role, setRole] = useState<RoleView>('student');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [signupSuccess, setSignupSuccess] = useState(false);

    // Teacher signup extras
    const [communityName, setCommunityName] = useState('');
    const [communityPasscode, setCommunityPasscode] = useState('');

    // Student login extras
    const [communityCode, setCommunityCode] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email.trim() || !password.trim()) { setError('Please fill in all required fields.'); return; }
        if (mode === 'signup' && !name.trim()) { setError('Please enter your name.'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        if (mode === 'signup' && role === 'teacher' && (!communityName.trim() || !communityPasscode.trim())) {
            setError('Please enter a Community Name and Passcode.'); return;
        }
        if (mode === 'login' && role === 'student' && !communityCode.trim()) {
            setError('Please enter your Community Passcode.'); return;
        }

        setLoading(true);
        try {
            if (mode === 'signup') {
                // ── Sign up ─────────────────────────────────────────
                const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
                await updateProfile(cred.user, { displayName: name.trim() });
                const uid = cred.user.uid;

                // Save profile in Firestore
                await setDoc(doc(db, 'profiles', uid), {
                    name: name.trim(), email: email.trim(), role, uid, createdAt: new Date().toISOString()
                });

                // If teacher → create community
                if (role === 'teacher') {
                    const commRef = await addDoc(collection(db, 'communities'), {
                        name: communityName.trim(),
                        passcode: communityPasscode.trim().toUpperCase(),
                        teacher_id: uid,
                        teacher_name: name.trim(),
                        createdAt: new Date().toISOString()
                    });
                    // Add teacher as member
                    await addDoc(collection(db, 'community_members'), {
                        community_id: commRef.id, user_id: uid, role: 'teacher', joinedAt: new Date().toISOString()
                    });
                }

                setSignupSuccess(true);
                setMode('login');
                setPassword('');
                setName('');
            } else {
                // ── Sign in ─────────────────────────────────────────
                const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
                const uid = cred.user.uid;

                // Fetch profile
                const profileSnap = await getDoc(doc(db, 'profiles', uid));
                if (!profileSnap.exists()) throw new Error('Profile not found. Please sign up first.');
                const profile = profileSnap.data();

                // Verify role matches
                if (profile.role !== role) {
                    setError(`This account is registered as a ${profile.role}. Please switch role.`);
                    await auth.signOut();
                    setLoading(false);
                    return;
                }

                let community_id: string | undefined;
                let community_name: string | undefined;

                if (role === 'student') {
                    // Student must enter community passcode
                    const commQuery = query(collection(db, 'communities'), where('passcode', '==', communityCode.trim().toUpperCase()));
                    const commSnap = await getDocs(commQuery);
                    if (commSnap.empty) {
                        setError('Invalid community passcode. Ask your teacher for the correct code.');
                        await auth.signOut();
                        setLoading(false);
                        return;
                    }
                    const commDoc = commSnap.docs[0];
                    community_id = commDoc.id;
                    community_name = commDoc.data().name;

                    // Update student profile with community info
                    const profileRef = doc(db, 'profiles', uid);
                    await setDoc(profileRef, {
                        community_id,
                        community_name
                    }, { merge: true });

                    // Upsert membership
                    const memQuery = query(collection(db, 'community_members'),
                        where('community_id', '==', community_id),
                        where('user_id', '==', uid));
                    const memSnap = await getDocs(memQuery);
                    if (memSnap.empty) {
                        await addDoc(collection(db, 'community_members'), {
                            community_id, user_id: uid, role: 'student', joinedAt: new Date().toISOString()
                        });
                    }
                } else {
                    // Teacher — get their community
                    const commQuery = query(collection(db, 'communities'), where('teacher_id', '==', uid));
                    const commSnap = await getDocs(commQuery);
                    if (!commSnap.empty) {
                        community_id = commSnap.docs[0].id;
                        community_name = commSnap.docs[0].data().name;

                        // Ensure teacher profile also has community info (for easier lookups)
                        await setDoc(doc(db, 'profiles', uid), { community_id, community_name }, { merge: true });
                    }
                }

                const userData = {
                    name: profile.name, email: profile.email,
                    role: profile.role as 'teacher' | 'student',
                    community_id, community_name, uid
                };
                localStorage.setItem('stem_user', JSON.stringify(userData));
                onLogin(userData);
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            let msg = err.message || 'An error occurred.';
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
            else if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered. Please sign in.';
            else if (err.code === 'auth/network-request-failed') msg = 'Network error. Please check your connection.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            const uid = user.uid;

            // Check if profile exists
            const profileSnap = await getDoc(doc(db, 'profiles', uid));
            let profile: any;

            if (!profileSnap.exists()) {
                // New Google user — create with selected role
                profile = { name: user.displayName || user.email?.split('@')[0] || 'User', email: user.email || '', role, uid };
                await setDoc(doc(db, 'profiles', uid), { ...profile, createdAt: new Date().toISOString() });

                if (role === 'teacher' && communityName && communityPasscode) {
                    await addDoc(collection(db, 'communities'), {
                        name: communityName.trim(), passcode: communityPasscode.trim().toUpperCase(),
                        teacher_id: uid, teacher_name: profile.name, createdAt: new Date().toISOString()
                    });
                }
            } else {
                profile = profileSnap.data();
            }

            let community_id: string | undefined;
            let community_name: string | undefined;

            if (profile.role === 'teacher') {
                const commQuery = query(collection(db, 'communities'), where('teacher_id', '==', uid));
                const commSnap = await getDocs(commQuery);
                if (!commSnap.empty) { community_id = commSnap.docs[0].id; community_name = commSnap.docs[0].data().name; }
            }

            const userData = { name: profile.name, email: profile.email, role: profile.role, community_id, community_name, uid };
            localStorage.setItem('stem_user', JSON.stringify(userData));
            onLogin(userData);
        } catch (err: any) {
            console.error('Google Auth error:', err);
            setError('Failed to sign in with Google. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const features = [
        { icon: Brain, label: 'AI Problem Solver', desc: 'Step-by-step solutions powered by Gemini AI' },
        { icon: FlaskConical, label: 'Interactive Concepts', desc: 'Visual simulations for every topic' },
        { icon: Zap, label: 'Practice Exams', desc: '120+ questions with AI grading' },
        { icon: Sigma, label: 'Formula Cheat Sheets', desc: 'Downloadable PDF cheat sheets' },
    ];

    return (
        <div className="min-h-screen bg-[#050c1a] flex overflow-hidden">
            {/* ── Left Panel ── */}
            <div className="hidden lg:flex flex-col w-1/2 relative bg-gradient-to-br from-[#0b1530] via-[#0e1f45] to-[#080f22] p-14 justify-between overflow-hidden">
                <div className="absolute top-20 left-10 w-80 h-80 bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-20 right-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="flex items-center space-x-3 relative z-10">
                    <div className="w-12 h-12 flex-shrink-0">
                        <img src="/logo.png" alt="STEM Engine Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-xl tracking-wide">STEM Engine</h1>
                        <p className="text-blue-400/70 text-[10px] uppercase font-semibold tracking-widest">AI Intelligence · Google Powered</p>
                    </div>
                </div>

                <div className="relative z-10">
                    <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
                        Master Physics,<br />Chemistry &amp; Maths<br />
                        <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">with AI.</span>
                    </h2>
                    <p className="text-slate-400 text-base leading-relaxed mb-8 max-w-md">
                        AI-powered adaptive learning for students and teachers. Solve any problem, understand every concept, and connect with your class.
                    </p>

                    {/* Role cards */}
                    <div className="grid grid-cols-2 gap-3 mb-8">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                            <GraduationCap className="w-6 h-6 text-blue-400 mb-2" />
                            <p className="text-white text-sm font-bold">For Teachers</p>
                            <p className="text-slate-400 text-xs">Create communities, add videos, track performance</p>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                            <BookOpen className="w-6 h-6 text-purple-400 mb-2" />
                            <p className="text-white text-sm font-bold">For Students</p>
                            <p className="text-xs text-slate-400">Join class, solve problems, watch curated videos</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {features.map(({ icon: Icon, label, desc }) => (
                            <div key={label} className="flex items-start space-x-3 group">
                                <div className="mt-0.5 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors shrink-0">
                                    <Icon className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-white text-sm font-semibold">{label}</p>
                                    <p className="text-slate-500 text-xs">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-slate-600 text-xs relative z-10">© 2025 STEM Engine — Powered by Google AI &amp; Firebase</p>
            </div>

            {/* ── Right Panel ── */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-14 relative overflow-y-auto">
                {/* Mobile logo */}
                <div className="absolute top-6 left-6 flex items-center space-x-2 lg:hidden">
                    <div className="w-8 h-8 flex-shrink-0">
                        <img src="/logo.png" alt="STEM Engine Logo" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-white font-bold text-base">STEM Engine</span>
                </div>

                <div className="w-full max-w-md py-10 lg:py-0">
                    {/* Role Toggle */}
                    <div className="flex bg-[#0f1829] border border-white/5 rounded-xl p-1 mb-5">
                        {(['student', 'teacher'] as const).map(r => (
                            <button key={r} onClick={() => { setRole(r); setError(''); }}
                                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${role === r
                                    ? r === 'teacher' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                    : 'text-slate-400 hover:text-white'}`}>
                                {r === 'teacher' ? <GraduationCap className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                                <span>I am a {r === 'teacher' ? 'Teacher' : 'Student'}</span>
                            </button>
                        ))}
                    </div>

                    {/* Auth Mode Toggle */}
                    <div className="flex bg-[#0f1829] border border-white/5 rounded-xl p-1 mb-6">
                        {(['login', 'signup'] as const).map(m => (
                            <button key={m} onClick={() => { setMode(m); setError(''); setSignupSuccess(false); }}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === m ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
                                {m === 'login' ? 'Sign In' : 'Create Account'}
                            </button>
                        ))}
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-1">
                        {mode === 'login' ? `Welcome back, ${role === 'teacher' ? 'Teacher' : 'Student'}` : `Register as ${role === 'teacher' ? 'Teacher' : 'Student'}`}
                    </h2>

                    {signupSuccess && (
                        <div className="flex items-center space-x-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 my-3">
                            <span>✓</span><span>Account created! Please sign in.</span>
                        </div>
                    )}
                    <p className="text-slate-500 text-sm mb-6">
                        {mode === 'login'
                            ? role === 'student' ? 'Sign in and enter your class passcode to join.' : 'Sign in to manage your class and community.'
                            : role === 'teacher' ? 'Create your account and set up your class community.' : 'Create your account to get started.'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Full Name</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"
                                    className="w-full bg-[#0b1121] border border-white/8 hover:border-blue-500/30 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none transition-all" />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Email Address</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                                className="w-full bg-[#0b1121] border border-white/8 hover:border-blue-500/30 focus:border-blue-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none transition-all" />
                        </div>

                        <div>
                            <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Password</label>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters"
                                    className="w-full bg-[#0b1121] border border-white/8 hover:border-blue-500/30 focus:border-blue-500/60 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder-slate-600 focus:outline-none transition-all" />
                                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Teacher signup: Community setup */}
                        {mode === 'signup' && role === 'teacher' && (
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
                                <div className="flex items-center space-x-2 mb-1">
                                    <Users className="w-4 h-4 text-blue-400" />
                                    <span className="text-blue-300 text-sm font-semibold">Create Your Class Community</span>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Community Name</label>
                                    <input type="text" value={communityName} onChange={e => setCommunityName(e.target.value)} placeholder="e.g. Class 11 - MPC 2025"
                                        className="w-full bg-[#0b1121] border border-blue-500/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/60 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Community Passcode</label>
                                    <input type="text" value={communityPasscode} onChange={e => setCommunityPasscode(e.target.value.toUpperCase())} placeholder="e.g. STEM2025"
                                        className="w-full bg-[#0b1121] border border-blue-500/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/60 transition-all font-mono tracking-widest" />
                                    <p className="text-slate-600 text-[10px] mt-1">Share this passcode with students to let them join.</p>
                                </div>
                            </div>
                        )}

                        {/* Student login: Community passcode */}
                        {mode === 'login' && role === 'student' && (
                            <div>
                                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">
                                    <span className="flex items-center space-x-1"><Hash className="w-3 h-3" /><span>Community Passcode</span></span>
                                </label>
                                <input type="text" value={communityCode} onChange={e => setCommunityCode(e.target.value.toUpperCase())} placeholder="Enter your class passcode"
                                    className="w-full bg-[#0b1121] border border-purple-500/20 hover:border-purple-500/40 focus:border-purple-500/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none transition-all font-mono tracking-widest" />
                                <p className="text-slate-600 text-[10px] mt-1">Ask your teacher for the community passcode.</p>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center space-x-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                <span>⚠</span><span>{error}</span>
                            </div>
                        )}

                        <button type="submit" disabled={loading}
                            className={`w-full ${role === 'teacher' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/20'} disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 mt-2`}>
                            {loading
                                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Please wait…</span></>
                                : <><span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span><ChevronRight className="w-4 h-4" /></>
                            }
                        </button>
                    </form>

                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-slate-600 text-xs">or</span>
                        <div className="flex-1 h-px bg-white/5" />
                    </div>

                    <button onClick={handleGoogleSignIn} disabled={loading}
                        className="w-full flex items-center justify-center space-x-3 border border-white/10 hover:border-blue-500/30 text-slate-300 hover:text-white py-3 rounded-xl text-sm font-medium transition-all hover:bg-blue-500/5 group disabled:opacity-50">
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>Continue with Google</span>
                    </button>

                    <p className="text-center text-slate-600 text-xs mt-6">
                        By continuing, you agree to our{' '}
                        <span className="text-blue-400 cursor-pointer hover:underline">Terms</span>
                        {' & '}
                        <span className="text-blue-400 cursor-pointer hover:underline">Privacy Policy</span>
                    </p>
                </div>
            </div>
        </div>
    );
};
