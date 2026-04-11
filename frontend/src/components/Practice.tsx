import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Atom, Shell, Sigma, Play, CheckCircle2, XCircle, Bookmark, ChevronDown, Wifi, WifiOff, Clock, BookOpen, AlertCircle, Loader } from 'lucide-react';
import { questionBank, Question } from '../data/questionBank';
import { Language } from '../translations';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

type Subject = 'Physics' | 'Chemistry' | 'Mathematics';
type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Advanced';
type Mode = 'Free Practice' | 'Timed Challenge' | 'JEE Style' | 'NEET Style' | 'SAT Style';

// ─── helpers ───────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');

const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

// answer states
type AnswerState = 'answered' | 'bookmarked' | 'skipped' | 'not-viewed';

// ── Teacher exam types
interface TeacherQuestion { id: string; text: string; options: string[]; correctIndex: number; imageURL?: string; }
interface TeacherSection  { id: string; title: string; questions: TeacherQuestion[]; }
interface TeacherExam {
    id: string; title: string; durationMin: number;
    communityId: string; teacherName: string;
    sections: TeacherSection[];
    status: 'active' | 'ended';
    totalQuestions: number;
    createdAt?: any;
}

export const Practice: React.FC<{
    onSolveProblem?: (problem: string) => void;
    language: Language;
    user: { uid: string; name: string; email: string; community_id?: string };
    onAddExamResult?: (result: any) => Promise<void>;
}> = ({ onSolveProblem, language, user, onAddExamResult }) => {
    const [subject, setSubject] = useState<Subject>('Physics');
    const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
    const [mode, setMode] = useState<Mode>('Free Practice');

    // ── Teacher exams
    const [teacherExams, setTeacherExams] = useState<TeacherExam[]>([]);
    const [examsLoading, setExamsLoading] = useState(true);
    const [activeTeacherExam, setActiveTeacherExam] = useState<TeacherExam | null>(null);
    const [configTab, setConfigTab] = useState<'available' | 'self'>('available');

    // ── phases: 'config' | 'countdown' | 'exam' | 'terminated' | 'results'
    const [phase, setPhase] = useState<'config' | 'countdown' | 'exam' | 'terminated' | 'results'>('config');

    const [countdown, setCountdown] = useState(10);
    const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
    const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
    const [viewedQuestions, setViewedQuestions] = useState<Set<number>>(new Set([0]));
    const [score, setScore] = useState(0);
    const [tabSwitches, setTabSwitches] = useState(0);
    const [warningMsg, setWarningMsg] = useState<string | null>(null);
    const [attemptNo] = useState(Math.floor(Math.random() * 3) + 1);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [savedToServer, setSavedToServer] = useState(0);

    const TAB_SWITCH_LIMIT = 3; // warn on each switch; terminate after limit

    // timer (seconds) – 45 min default
    const EXAM_DURATION = 45 * 60;
    const [timeLeft, setTimeLeft] = useState(EXAM_DURATION);

    const strikeRef = useRef(0);
    const phaseRef = useRef<'config' | 'countdown' | 'exam' | 'terminated' | 'results'>('config');
    phaseRef.current = phase;

    // ── Online monitor
    useEffect(() => {
        const on = () => setIsOnline(true);
        const off = () => setIsOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    // ── Teacher exams listener
    useEffect(() => {
        if (!user.community_id) { setExamsLoading(false); return; }
        const q = query(
            collection(db, 'teacher_exams'),
            where('communityId', '==', user.community_id),
            where('status', '==', 'active')
        );
        const unsub = onSnapshot(q, snap => {
            setTeacherExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherExam)));
            setExamsLoading(false);
        }, () => setExamsLoading(false));
        return () => unsub();
    }, [user.community_id]);

    // ── Countdown timer
    useEffect(() => {
        if (phase !== 'countdown') return;
        if (countdown <= 0) {
            setPhase('exam');
            return;
        }
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [phase, countdown]);

    // ── Exam timer (counts down)
    useEffect(() => {
        if (phase !== 'exam') return;
        if (timeLeft <= 0) {
            submitExam(true);
            return;
        }
        const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [phase, timeLeft]);

    // ── Tab / focus / fullscreen guard
    const terminateExam = useCallback((reason: string) => {
        if (phaseRef.current !== 'exam') return;
        strikeRef.current += 1;
        setTabSwitches(strikeRef.current);

        let currentScore = 0;
        setCurrentQuestions(qs => {
            setUserAnswers(ans => {
                qs.forEach(q => { if (ans[q.id] === q.correctAnswer) currentScore++; });
                return ans;
            });
            return qs;
        });

        setPhase('terminated');

        if (onAddExamResult) {
            onAddExamResult({
                subject, difficulty, mode,
                score: currentScore,
                totalQuestions: currentQuestions.length,
                tabSwitches: strikeRef.current,
                terminated: true, terminationReason: reason,
                timestamp: new Date().toISOString(),
                studentName: user.name, studentEmail: user.email,
                studentUid: user.uid, community_id: user.community_id || 'none'
            });
        }
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    }, [subject, difficulty, mode, currentQuestions, onAddExamResult, user]);

    // ── Strike handler: warn first, terminate after limit
    const handleStrike = useCallback((reason: string) => {
        if (phaseRef.current !== 'exam') return;
        strikeRef.current += 1;
        const count = strikeRef.current;
        setTabSwitches(count);

        if (count > TAB_SWITCH_LIMIT) {
            terminateExam(reason);
        } else {
            const remaining = TAB_SWITCH_LIMIT - count;
            setWarningMsg(
                `⚠️ Warning ${count}/${TAB_SWITCH_LIMIT}: ${reason}. ` +
                (remaining > 0
                    ? `${remaining} warning${remaining > 1 ? 's' : ''} left before termination.`
                    : `Next violation will terminate your exam!`)
            );
            // Auto-dismiss warning after 4 s
            setTimeout(() => setWarningMsg(null), 4000);
        }
    }, [terminateExam]);

    useEffect(() => {
        if (phase !== 'exam' || mode === 'Free Practice') return;

        // ── Fullscreen on exam start
        document.documentElement.requestFullscreen?.().catch(() => { });

        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') handleStrike('Tab Switch Detected');
        };
        const handleBlur = () => handleStrike('Window Lost Focus (Alt+Tab / Minimize)');
        const handleFSChange = () => {
            if (!document.fullscreenElement && phaseRef.current === 'exam') {
                handleStrike('Exited Fullscreen');
            }
        };
        const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };

        // ── Right-click disabled
        const blockContextMenu = (e: MouseEvent) => e.preventDefault();

        // ── Copy / cut / paste disabled
        const blockClipboard = (e: ClipboardEvent) => e.preventDefault();

        // ── Keyboard shortcuts disabled (Ctrl+C/V/X/A, F12, etc.)
        const blockKeys = (e: KeyboardEvent) => {
            const ctrl = e.ctrlKey || e.metaKey;
            if (ctrl && ['c', 'v', 'x', 'a', 'u', 's'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
            // Block F12, Ctrl+Shift+I, Ctrl+Shift+J (DevTools)
            if (e.key === 'F12') e.preventDefault();
            if (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) e.preventDefault();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('fullscreenchange', handleFSChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('contextmenu', blockContextMenu);
        document.addEventListener('copy', blockClipboard);
        document.addEventListener('cut', blockClipboard);
        document.addEventListener('paste', blockClipboard);
        document.addEventListener('keydown', blockKeys);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('fullscreenchange', handleFSChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('contextmenu', blockContextMenu);
            document.removeEventListener('copy', blockClipboard);
            document.removeEventListener('cut', blockClipboard);
            document.removeEventListener('paste', blockClipboard);
            document.removeEventListener('keydown', blockKeys);
        };
    }, [phase, mode, handleStrike]);

    // ── Fake "saved" counter
    useEffect(() => {
        if (phase !== 'exam') return;
        const t = setInterval(() => setSavedToServer(Object.values(userAnswers).filter(Boolean).length), 3000);
        return () => clearInterval(t);
    }, [phase, userAnswers]);

    // ── Actions
    const handleStart = () => {
        const filtered = questionBank.filter(q => q.subject === subject && q.difficulty === difficulty);
        const shuffled = [...filtered].sort(() => 0.5 - Math.random()).slice(0, 25);
        setCurrentQuestions(shuffled.length ? shuffled : questionBank.slice(0, 25));
        setActiveTeacherExam(null);
        setCurrentIndex(0);
        setUserAnswers({});
        setBookmarks(new Set());
        setViewedQuestions(new Set([0]));
        setScore(0);
        setTabSwitches(0);
        strikeRef.current = 0;
        setTimeLeft(EXAM_DURATION);
        setSavedToServer(0);
        setCountdown(10);
        setPhase('countdown');
    };

    // Launch a teacher-posted exam
    const handleStartTeacherExam = (exam: TeacherExam) => {
        // Flatten all sections into Question[] (reuse existing shape)
        const qs: Question[] = exam.sections.flatMap(sec =>
            sec.questions.map(tq => ({
                id: tq.id,
                subject: 'Physics' as any,
                difficulty: 'Medium' as any,
                question: tq.text,
                options: tq.options,
                correctAnswer: tq.options[tq.correctIndex],
                imageURL: tq.imageURL,
            } as Question & { imageURL?: string }))
        );
        setCurrentQuestions(qs);
        setActiveTeacherExam(exam);
        setCurrentIndex(0);
        setUserAnswers({});
        setBookmarks(new Set());
        setViewedQuestions(new Set([0]));
        setScore(0);
        setTabSwitches(0);
        strikeRef.current = 0;
        setTimeLeft(exam.durationMin * 60);
        setSavedToServer(0);
        setCountdown(10);
        setPhase('countdown');
    };

    const submitExam = useCallback((timedOut = false) => {
        let currentScore = 0;
        const answeredCount = Object.keys(userAnswers).length;
        currentQuestions.forEach(q => { if (userAnswers[q.id] === q.correctAnswer) currentScore++; });
        setScore(currentScore);
        setPhase('results');

        const baseResult = {
            score: currentScore,
            totalQuestions: currentQuestions.length,
            answered: answeredCount,
            skipped: currentQuestions.length - answeredCount,
            notViewed: currentQuestions.length - viewedQuestions.size,
            tabSwitches: strikeRef.current,
            terminated: false, timedOut,
            timestamp: new Date().toISOString(),
            studentName: user.name, studentEmail: user.email,
            studentUid: user.uid, community_id: user.community_id || 'none'
        };

        if (activeTeacherExam) {
            // Save to exam_submissions (teacher-posted exam)
            try {
                addDoc(collection(db, 'exam_submissions'), {
                    ...baseResult,
                    examId: activeTeacherExam.id,
                    examTitle: activeTeacherExam.title,
                    teacherUid: activeTeacherExam.teacherName,
                });
            } catch (_) { }
        } else {
            if (onAddExamResult) {
                onAddExamResult({ ...baseResult, subject, difficulty, mode });
            }
        }
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    }, [currentQuestions, userAnswers, viewedQuestions, subject, difficulty, mode, onAddExamResult, user, activeTeacherExam]);

    const handleReset = () => {
        setPhase('config');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    };

    const handleAnswerSelect = (opt: string) => {
        if (phase !== 'exam') return;
        const qId = currentQuestions[currentIndex].id;
        setUserAnswers(prev => ({ ...prev, [qId]: opt }));
    };

    const toggleBookmark = () => {
        const qId = currentQuestions[currentIndex].id;
        setBookmarks(prev => {
            const next = new Set(prev);
            next.has(qId) ? next.delete(qId) : next.add(qId);
            return next;
        });
    };

    const goToQuestion = (idx: number) => {
        setCurrentIndex(idx);
        setViewedQuestions(prev => new Set([...prev, idx]));
    };

    // ── Question status colour
    const qStatus = (idx: number): AnswerState => {
        const q = currentQuestions[idx];
        if (!q) return 'not-viewed';
        if (userAnswers[q.id]) return 'answered';
        if (bookmarks.has(q.id)) return 'bookmarked';
        if (viewedQuestions.has(idx) && idx !== currentIndex) return 'skipped';
        return 'not-viewed';
    };

    const statusColor: Record<AnswerState, string> = {
        'answered': 'bg-green-500 text-white',
        'bookmarked': 'bg-yellow-400 text-black',
        'skipped': 'bg-red-500 text-white',
        'not-viewed': 'bg-gray-200 text-gray-700',
    };

    const subjects: { id: Subject, icon: any }[] = [
        { id: 'Physics', icon: Atom },
        { id: 'Chemistry', icon: Shell },
        { id: 'Mathematics', icon: Sigma },
    ];
    const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Advanced'];
    const modes: { id: Mode, label: string, desc: string }[] = [
        { id: 'Free Practice', label: 'Free Practice', desc: 'No time limit' },
        { id: 'Timed Challenge', label: 'Timed Challenge', desc: 'Timer tracking' },
        { id: 'JEE Style', label: 'JEE Style', desc: 'Competitive exam' },
        { id: 'NEET Style', label: 'NEET Style', desc: 'Medical entrance' },
    ];

    // ════════════════════════════════════════════════════════
    //  COUNTDOWN SCREEN
    // ════════════════════════════════════════════════════════
    if (phase === 'countdown') {
        const total = currentQuestions.length;
        const pct = ((10 - countdown) / 10) * 100;
        const displayTitle = activeTeacherExam ? activeTeacherExam.title : `${subject} Practice — ${difficulty}`;
        const durationMin = activeTeacherExam ? activeTeacherExam.durationMin : 45;
        
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050c1a] backdrop-blur-sm">
                <div className="bg-[#0b1121] border border-blue-500/20 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
                    {/* Header */}
                    <div className="px-8 pt-8 pb-4">
                        <h2 className="text-xl font-bold text-white">
                            {displayTitle}
                        </h2>
                    </div>

                    {/* Meta row */}
                    <div className="px-8 pb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-xs">
                                {attemptNo}
                            </span>
                            <span>Attempt : {attemptNo}</span>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-blue-400 font-semibold mb-1">Test starts in&nbsp;&nbsp;
                                <span className="text-blue-300 font-black text-sm">{countdown}S</span>
                            </p>
                            {/* progress bar */}
                            <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="px-8 pb-8">
                        <table className="w-full text-sm border border-white/10 rounded-xl overflow-hidden">
                            <thead>
                                <tr className="bg-blue-500/10">
                                    <th className="text-left px-4 py-3 font-semibold text-blue-200 border-b border-white/10">Sections</th>
                                    <th className="text-left px-4 py-3 font-semibold text-blue-200 border-b border-white/10">Questions</th>
                                    <th className="text-left px-4 py-3 font-semibold text-blue-200 border-b border-white/10">Duration (Min)</th>
                                    <th className="text-left px-4 py-3 font-semibold text-blue-200 border-b border-white/10">Marks</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-white/[0.05]">
                                    <td className="px-4 py-3 text-slate-300">MCQ</td>
                                    <td className="px-4 py-3 text-slate-300">{total}</td>
                                    <td className="px-4 py-3 text-slate-300">{durationMin} m</td>
                                    <td className="px-4 py-3 text-slate-300">{total}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-blue-400 font-semibold">total</td>
                                    <td className="px-4 py-3 text-white font-bold">{total}</td>
                                    <td className="px-4 py-3 text-white font-bold">{durationMin} m</td>
                                    <td className="px-4 py-3 text-white font-bold">{total}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════
    //  TERMINATED SCREEN
    // ════════════════════════════════════════════════════════
    if (phase === 'terminated') {
        return (
            <div className="fixed inset-0 z-[9999] bg-[#050c1a] flex flex-col items-center justify-center p-12 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                    <XCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Exam Terminated</h2>
                <p className="text-red-400 font-bold mb-4 text-xl">Focus Mode Violation</p>
                <p className="text-slate-400 mb-8 max-w-lg mx-auto leading-relaxed text-lg">
                    This session was immediately terminated because you attempted to switch tabs, lost window focus, or exited full-screen mode.
                    Your current score and this incident have been reported to your teacher.
                </p>
                <button onClick={handleReset}
                    className="px-10 py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-white font-bold transition-all shadow-2xl backdrop-blur-md">
                    Return to Main Dashboard
                </button>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════
    //  RESULTS SCREEN
    // ════════════════════════════════════════════════════════
    if (phase === 'results') {
        const pct = Math.round((score / currentQuestions.length) * 100);
        return (
            <div className="fixed inset-0 z-[9999] bg-[#080e1a] flex flex-col items-center justify-center p-12 text-center overflow-y-auto">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Exam Completed</h2>
                <p className="text-2xl font-bold text-blue-400 mb-8">
                    Score: {score} / {currentQuestions.length} &nbsp;({pct}%)
                </p>
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8 max-w-md w-full">
                    <div className="flex justify-between mb-3">
                        <span className="text-slate-400">Status</span>
                        <span className="text-green-400 font-bold">COMPLETED</span>
                    </div>
                    <div className="flex justify-between mb-3">
                        <span className="text-slate-400">Tab Switches</span>
                        <span className="text-white">{tabSwitches}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Time Remaining</span>
                        <span className="text-white">{fmt(timeLeft)}</span>
                    </div>
                </div>
                <button onClick={handleReset}
                    className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl">
                    Return to Practice Menu
                </button>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════
    //  EXAM SCREEN (phase === 'exam')
    // ════════════════════════════════════════════════════════
    if (phase === 'exam' && currentQuestions.length > 0) {
        const q = currentQuestions[currentIndex];
        const selectedOpt = userAnswers[q.id];
        const isBookmarked = bookmarks.has(q.id);
        const isSeriousMode = mode !== 'Free Practice';
        const displayTitle = activeTeacherExam ? activeTeacherExam.title : `${subject} Practice — ${difficulty}`;

        // sidebar stats
        const answeredCount = Object.keys(userAnswers).length;
        const bookmarkedCount = bookmarks.size;
        const skippedCount = [...viewedQuestions].filter(i => {
            const qq = currentQuestions[i]; return qq && !userAnswers[qq.id] && !bookmarks.has(qq.id);
        }).length;
        const notViewedCount = currentQuestions.length - viewedQuestions.size;

        return (
            <div className="fixed inset-0 z-[1000] flex flex-col bg-[#050c1a] exam-locked text-slate-300" style={{ fontFamily: 'Inter, sans-serif' }}>

                {/* ── Internet status bar */}
                <div className={`flex items-center justify-center gap-2 py-1 text-xs font-semibold border-b border-white/5 ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    Internet Status:&nbsp;{isOnline ? 'Online' : 'Offline'}
                </div>

                {/* ── Top bar */}
                <div className="flex items-center bg-[#0b1121] border-b border-white/10 px-4 py-2 gap-3 shrink-0 shadow-lg">
                    {/* Exam title */}
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-white truncate block">
                            {displayTitle}
                        </span>
                    </div>

                    {/* Section selector */}
                    <div className="flex items-center text-sm border border-white/10 rounded px-3 py-1 gap-2 bg-white/5">
                        <span className="text-slate-400 text-xs">Section 1/1</span>
                        <span className="font-semibold text-white">MCQ ({currentQuestions.length})</span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    </div>

                    {/* Name */}
                    <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                        <span className="text-xs text-slate-400">Name :</span>
                        <span className="text-xs font-bold text-blue-400 uppercase">{user.name}</span>
                    </div>

                    <div className="w-px h-5 bg-white/10" />

                    <div className="flex items-center gap-1 text-gray-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="9" strokeWidth="2" /><path strokeWidth="2" d="M12 6v6l4 2" />
                        </svg>
                        <span className={`font-mono font-bold text-sm ${timeLeft < 300 ? 'text-red-600' : 'text-gray-800'}`}>
                            {fmt(timeLeft)}
                        </span>
                    </div>

                    <button
                        onClick={() => submitExam()}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold transition-colors ml-2">
                        Submit Test
                    </button>
                </div>

                {/* ── Body */}
                <div className="flex flex-1 overflow-hidden">

                    {/* Left: Question number sidebar */}
                    <div className="w-16 shrink-0 flex flex-col border-r border-white/5 overflow-y-auto bg-[#080e1a] py-3 gap-1.5 items-center">
                        {currentQuestions.map((_, idx) => {
                            const st = qStatus(idx);
                            const isActive = idx === currentIndex;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => goToQuestion(idx)}
                                    className={`w-9 h-9 rounded text-xs font-bold transition-all border
                                        ${isActive ? 'ring-2 ring-blue-500 scale-110 shadow-lg' : ''}
                                        ${statusColor[st]}`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}

                        {/* Legend */}
                        <div className="mt-4 w-full px-2 space-y-2 text-[10px] text-slate-500">
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-emerald-500">{answeredCount}/{currentQuestions.length}</span>
                                <span className="text-center leading-tight">Answered</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-amber-500">{bookmarkedCount}/{currentQuestions.length}</span>
                                <span className="text-center leading-tight">Bookmarked</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-slate-400">{skippedCount}/{currentQuestions.length}</span>
                                <span className="text-center leading-tight">Skipped</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-slate-600">{notViewedCount}/{currentQuestions.length}</span>
                                <span className="text-center leading-tight">Not Viewed</span>
                            </div>
                        </div>
                    </div>

                    {/* Centre: Question panel */}
                    <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5 bg-[#0b1121]">
                        {/* Question header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.02] bg-white/[0.01] shrink-0">
                            <span className="text-sm font-semibold text-slate-400">
                                Question No : {currentIndex + 1} / {currentQuestions.length}
                            </span>
                            <button onClick={toggleBookmark}
                                className={`p-1.5 rounded border transition-all ${isBookmarked ? 'bg-yellow-100 border-yellow-300' : 'border-gray-200 hover:bg-gray-50'}`}
                                title="Bookmark">
                                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-yellow-400 text-yellow-500' : 'text-gray-400'}`} />
                            </button>
                        </div>

                        {/* Question body */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <h3 className="text-base font-bold text-gray-900 mb-3">Multi Choice Type Question</h3>

                            {q.question && (
                                <div className="mb-5">
                                    <p className="text-sm font-semibold text-gray-800 mb-2">Question</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{q.question}</p>
                                </div>
                            )}
                        </div>

                        {/* Bottom bar */}
                        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0 text-sm text-gray-600">
                            <span>Marks : 1 &nbsp;&nbsp; Negative Marks : 0</span>
                        </div>
                    </div>

                    {/* Right: Answer panel */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Panel header */}
                        <div className="px-5 py-3 border-b border-gray-100 bg-white shrink-0">
                            <span className="text-sm font-semibold text-gray-700">Answer here</span>
                        </div>

                        {/* Options */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                            {q.options.map((opt, i) => {
                                const isSelected = selectedOpt === opt;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleAnswerSelect(opt)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded border text-left text-sm transition-all
                                            ${isSelected
                                                ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-medium'
                                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 flex items-center justify-center rounded-full border-2 shrink-0 transition-all
                                            ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'}`}>
                                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                        <span>{opt}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Navigation footer */}
                        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-white shrink-0">
                            <button
                                onClick={() => handleAnswerSelect('')}
                                className="px-5 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 transition-colors">
                                Clear
                            </button>
                            <div className="flex gap-2">
                                <button
                                    disabled={currentIndex === 0}
                                    onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
                                    className={`px-5 py-2 rounded border text-sm font-medium transition-all
                                        ${currentIndex === 0 ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                                    Prev
                                </button>
                                {currentIndex === currentQuestions.length - 1 ? (
                                    <button
                                        onClick={() => submitExam()}
                                        className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-bold transition-colors">
                                        Submit
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => goToQuestion(Math.min(currentQuestions.length - 1, currentIndex + 1))}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors">
                                        Next
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Warning toast (tab switch / blur / fullscreen) */}
                {warningMsg && (
                    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9998] flex items-start gap-3
                        bg-amber-50 border-2 border-amber-400 text-amber-900 px-5 py-4 rounded-xl shadow-2xl
                        max-w-lg w-full mx-4 animate-bounce-once"
                        style={{ animation: 'slideDown 0.3s ease' }}>
                        <span className="text-2xl shrink-0">⚠️</span>
                        <div>
                            <p className="font-bold text-sm">Security Warning</p>
                            <p className="text-xs mt-0.5 leading-relaxed">{warningMsg}</p>
                        </div>
                        <button onClick={() => setWarningMsg(null)}
                            className="ml-auto text-amber-600 hover:text-amber-900 font-bold text-lg leading-none shrink-0">×</button>
                    </div>
                )}

                {/* ── Tab-switch counter badge */}
                {isSeriousMode && (
                    <div className="fixed bottom-4 left-4 flex items-center gap-2 bg-gray-900/90 border border-gray-700
                        px-3 py-2 rounded-full shadow-lg z-50 backdrop-blur">
                        <span className={`text-xs font-bold ${tabSwitches === 0 ? 'text-green-400' : tabSwitches < TAB_SWITCH_LIMIT ? 'text-amber-400' : 'text-red-400'}`}>
                            Violations: {tabSwitches}/{TAB_SWITCH_LIMIT}
                        </span>
                    </div>
                )}

                {/* ── Strict mode live badge */}
                {isSeriousMode && (
                    <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-red-900 px-3 py-2 rounded-full shadow-lg z-50">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-ping" />
                        <span className="text-[10px] text-red-200 font-bold uppercase tracking-wider">Strict Focus Active</span>
                    </div>
                )}
            </div>
        );
    }

    // ════════════════════════════════════════════════════════
    //  CONFIG UI
    // ════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════
    //  CONFIG UI
    // ════════════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 max-w-5xl mx-auto px-4 w-full">
            <h2 className="text-2xl font-bold text-white mb-2">Practice Module</h2>
            <p className="text-brand-muted mb-8">Take live class exams or hone your skills in self practice.</p>

            {/* Config Tabs */}
            <div className="flex border-b border-white/5 mb-8">
                <button
                    onClick={() => setConfigTab('available')}
                    className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${configTab === 'available' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex justify-center items-center gap-2">
                        <BookOpen className="w-4 h-4" /> Available Exams
                        {teacherExams.length > 0 && (
                            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{teacherExams.length}</span>
                        )}
                    </div>
                </button>
                <button
                    onClick={() => setConfigTab('self')}
                    className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${configTab === 'self' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex justify-center items-center gap-2">
                        <Atom className="w-4 h-4" /> Self Practice
                    </div>
                </button>
            </div>

            {configTab === 'available' ? (
                // ── Available Exams Tab
                <div className="space-y-4">
                    {examsLoading ? (
                        <div className="py-12 flex justify-center"><Loader className="w-6 h-6 text-emerald-500 animate-spin" /></div>
                    ) : teacherExams.length === 0 ? (
                        <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-12 text-center max-w-2xl mx-auto">
                            <CheckCircle2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                            <h3 className="text-white font-bold text-lg mb-2">You're all caught up!</h3>
                            <p className="text-slate-500">No active exams assigned by your teacher. Use <strong className="text-blue-400">Self Practice</strong> to keep learning.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teacherExams.map(exam => (
                                <div key={exam.id} className="bg-[#0f172a] border border-emerald-500/20 rounded-2xl p-6 hover:border-emerald-500/40 transition-colors flex flex-col group relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">Live Test</span>
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-1">{exam.title}</h3>
                                    <p className="text-slate-500 text-xs mb-4">By: {exam.teacherName}</p>
                                    
                                    <div className="flex gap-4 mb-6 mt-auto">
                                        <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                                            <FileText className="w-4 h-4" /> {exam.totalQuestions} Q
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                                            <Clock className="w-4 h-4" /> {exam.durationMin} Min
                                        </div>
                                    </div>
                                    <button onClick={() => handleStartTeacherExam(exam)}
                                        className="w-full py-3 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl font-bold transition-all">
                                        Start Exam
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                // ── Self Practice Tab
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4">Subject</h3>
                        <div className="grid grid-cols-1 gap-3 mb-8">
                            {subjects.map(s => {
                                const Icon = s.icon;
                                const isActive = subject === s.id;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => setSubject(s.id)}
                                        className={`flex items-center space-x-3 px-5 py-4 rounded-xl text-left transition-all duration-200 ${isActive
                                            ? 'bg-blue-900/40 text-white shadow-lg border border-blue-500/30'
                                            : 'bg-brand-surface text-brand-muted hover:bg-brand-surface/80 hover:text-white border border-transparent'
                                            }`}
                                    >
                                        <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-brand-muted'}`} />
                                        <span className="font-medium text-base">{s.id}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4">Difficulty</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {difficulties.map(d => {
                                const isActive = difficulty === d;
                                return (
                                    <button
                                        key={d}
                                        onClick={() => setDifficulty(d)}
                                        className={`px-4 py-3 rounded-xl text-center transition-all duration-200 ${isActive
                                            ? 'bg-blue-900/40 text-white shadow-lg border border-blue-500/30'
                                            : 'bg-brand-surface text-brand-muted hover:bg-brand-surface/80 hover:text-white border border-transparent'
                                            }`}
                                    >
                                        <span className="font-medium">{d}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4">Mode</h3>
                        <div className="grid grid-cols-1 gap-4 mb-10">
                            {modes.map(m => {
                                const isActive = mode === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setMode(m.id)}
                                        className={`flex flex-col text-left px-5 py-4 rounded-xl transition-all duration-200 border ${isActive
                                            ? 'bg-blue-900/10 border-blue-500/40 text-white shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                            : 'bg-brand-surface border-white/5 text-brand-muted hover:border-blue-500/20 hover:text-white'
                                            }`}
                                    >
                                        <span className="font-semibold text-sm mb-1">{m.label}</span>
                                        <span className={`text-xs ${isActive ? 'text-blue-300/70' : 'text-brand-muted/50'}`}>{m.desc}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-6 bg-blue-950/20 border border-blue-500/10 rounded-2xl text-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-50 group-hover:opacity-100 transition-opacity" />
                            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Play className="w-5 h-5 text-blue-400 fill-blue-400 ml-1 group-hover:scale-110 transition-transform" />
                            </div>
                            <h4 className="text-white font-medium mb-2">Ready to begin?</h4>
                            <p className="text-sm text-brand-muted mb-6">
                                You will be tested with questions from your selected configuration.
                            </p>
                            <button
                                onClick={handleStart}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/20">
                                Start Practice Session
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
