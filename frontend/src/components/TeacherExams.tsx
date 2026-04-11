import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import {
    collection, query, where, onSnapshot, getDocs, doc, getDoc,
    addDoc, updateDoc, serverTimestamp, orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    FileText, Loader, Users, Plus, Trash2, Image,
    StopCircle, BarChart3, AlertCircle, Send, XCircle, CheckCircle2, Clock
} from 'lucide-react';

interface TeacherExamsProps {
    user: { name: string; email: string; uid: string; community_id?: string; community_name?: string };
}

interface StudentData {
    uid: string; name: string; email: string;
}

interface ExamResult {
    id: string; studentName: string; studentEmail: string; studentUid?: string;
    subject: string; difficulty: string; score: number; totalQuestions: number;
    terminated: boolean; terminationReason?: string; timestamp: string; mode: string;
    tabSwitches?: number;
    // teacher exam fields
    examId?: string; answered?: number; skipped?: number; notViewed?: number;
}

interface QuestionDraft {
    id: string; text: string; options: string[]; correctIndex: number; imageFile?: File | null; imageURL?: string;
}
interface SectionDraft { id: string; title: string; questions: QuestionDraft[]; }
interface TeacherExam {
    id: string; title: string; durationMin: number; communityId: string;
    teacherUid: string; teacherName: string; sections: SectionDraft[];
    status: 'active' | 'ended'; createdAt: any; endedAt?: any; totalQuestions: number;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const defaultQuestion = (): QuestionDraft => ({ id: uid(), text: '', options: ['', '', '', ''], correctIndex: 0, imageFile: null });
const defaultSection = (): SectionDraft => ({ id: uid(), title: 'Section 1', questions: [defaultQuestion()] });

export const TeacherExams: React.FC<TeacherExamsProps> = ({ user }) => {
    const [students, setStudents] = useState<StudentData[]>([]);
    const [examResults, setExamResults] = useState<ExamResult[]>([]);
    const [teacherExams, setTeacherExams] = useState<TeacherExam[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'create' | 'live' | 'monitor'>('create');

    const [examTitle, setExamTitle] = useState('');
    const [examDuration, setExamDuration] = useState(45);
    const [sections, setSections] = useState<SectionDraft[]>([defaultSection()]);
    const [publishing, setPublishing] = useState(false);
    const [publishError, setPublishError] = useState('');

    const [reportExam, setReportExam] = useState<TeacherExam | null>(null);
    const [reportData, setReportData] = useState<ExamResult[]>([]);
    const [reportLoading, setReportLoading] = useState(false);

    const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useEffect(() => {
        if (!user.community_id) { setLoading(false); return; }

        const membersQ = query(collection(db, 'community_members'), where('community_id', '==', user.community_id), where('role', '==', 'student'));
        const unsub = onSnapshot(membersQ, async snap => {
            const memberIds = snap.docs.map(d => d.data().user_id as string);
            if (memberIds.length === 0) { setStudents([]); setLoading(false); return; }
            const profilePromises = memberIds.map(id => getDoc(doc(db, 'profiles', id)));
            const profileSnaps = await Promise.all(profilePromises);
            setStudents(profileSnaps.filter(s => s.exists()).map(s => ({ uid: s.id, name: s.data()!.name || 'Unknown', email: s.data()!.email || '' })));
            setLoading(false);
        });

        const examsQ = query(collection(db, 'exam_results'), where('community_id', '==', user.community_id));
        const unsubExams = onSnapshot(examsQ, snap => {
            setExamResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        });

        const teacherExamsQ = query(collection(db, 'teacher_exams'), where('communityId', '==', user.community_id), orderBy('createdAt', 'desc'));
        const unsubTE = onSnapshot(teacherExamsQ, snap => {
            setTeacherExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherExam)));
        });

        return () => { unsub(); unsubExams(); unsubTE(); };
    }, [user.community_id]);

    const addSection = () => setSections(p => [...p, { ...defaultSection(), title: `Section ${p.length + 1}` }]);
    const removeSection = (sid: string) => setSections(p => p.filter(s => s.id !== sid));
    const updateSection = (sid: string, title: string) => setSections(p => p.map(s => s.id === sid ? { ...s, title } : s));

    const addQuestion = (sid: string) => setSections(p => p.map(s => s.id === sid ? { ...s, questions: [...s.questions, defaultQuestion()] } : s));
    const removeQuestion = (sid: string, qid: string) => setSections(p => p.map(s => s.id === sid ? { ...s, questions: s.questions.filter(q => q.id !== qid) } : s));
    const updateQuestion = (sid: string, qid: string, patch: Partial<QuestionDraft>) =>
        setSections(p => p.map(s => s.id === sid ? { ...s, questions: s.questions.map(q => q.id === qid ? { ...q, ...patch } : q) } : s));
    const updateOption = (sid: string, qid: string, oi: number, val: string) =>
        setSections(p => p.map(s => s.id === sid ? { ...s, questions: s.questions.map(q => q.id === qid ? { ...q, options: q.options.map((o, i) => i === oi ? val : o) } : q) } : s));

    const handleImagePick = (sid: string, qid: string, file: File | null) => {
        if (!file || !file.type.startsWith('image/')) return;
        const url = URL.createObjectURL(file);
        updateQuestion(sid, qid, { imageURL: url, imageFile: file });

        // Compress image in background to speed up publish
        const img = new window.Image();
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(blob => {
                if (blob) {
                    const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                    updateQuestion(sid, qid, { imageFile: compressedFile });
                }
            }, 'image/jpeg', 0.7); // 70% quality JPEG
        };
    };

    const handlePublish = async () => {
        if (!examTitle.trim()) { setPublishError('Please enter an exam title.'); return; }
        if (!user.community_id) return;
        const allQs = sections.flatMap(s => s.questions);
        if (allQs.some(q => !q.text.trim())) { setPublishError('All questions must have text.'); return; }
        if (allQs.some(q => q.options.some(o => !o.trim()))) { setPublishError('All options must be filled.'); return; }

        setPublishing(true); setPublishError('');
        try {
            const sectionsForDB: any[] = await Promise.all(sections.map(async sec => ({
                id: sec.id, title: sec.title,
                questions: await Promise.all(sec.questions.map(async q => {
                    let imageURL = q.imageURL || '';
                    if (q.imageFile) {
                        const storageRef = ref(storage, `exam_images/${uid()}_${q.imageFile.name}`);
                        await uploadBytes(storageRef, q.imageFile);
                        imageURL = await getDownloadURL(storageRef);
                    }
                    return { id: q.id, text: q.text, options: q.options, correctIndex: q.correctIndex, imageURL };
                }))
            })));

            await addDoc(collection(db, 'teacher_exams'), {
                title: examTitle.trim(), durationMin: examDuration, communityId: user.community_id,
                teacherUid: user.uid, teacherName: user.name, sections: sectionsForDB,
                status: 'active', createdAt: serverTimestamp(), totalQuestions: allQs.length,
            });

            setExamTitle(''); setExamDuration(45); setSections([defaultSection()]);
            setTab('live');
        } catch (e: any) { setPublishError('Failed to publish: ' + e.message); }
        setPublishing(false);
    };

    const handleEndExam = async (examId: string) => {
        await updateDoc(doc(db, 'teacher_exams', examId), { status: 'ended', endedAt: serverTimestamp() });
    };

    const openReport = async (exam: TeacherExam) => {
        setReportExam(exam); setReportLoading(true); setReportData([]);
        const q = query(collection(db, 'exam_submissions'), where('examId', '==', exam.id));
        const snap = await getDocs(q);
        setReportData(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult)));
        setReportLoading(false);
    };

    const whoDidntWrite = (exam: TeacherExam) => {
        const wroteUids = new Set(reportData.map(r => r.studentUid));
        return students.filter(s => !wroteUids.has(s.uid));
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64"><Loader className="w-6 h-6 text-emerald-400 animate-spin" /></div>
    );
    if (!user.community_id) return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <Users className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-white font-bold text-lg mb-2">No Community Yet</p>
        </div>
    );

    const activeExams = teacherExams.filter(e => e.status === 'active');
    const endedExams = teacherExams.filter(e => e.status === 'ended');

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            <div className="flex flex-col h-full max-w-5xl mx-auto px-4 w-full">
                <h2 className="text-2xl font-bold text-white mb-2">Exam Management</h2>
                <p className="text-brand-muted mb-8">Create assessments, monitor live exams, and view detailed reports.</p>

                <div className="flex flex-wrap gap-1 bg-[#0f172a] border border-white/5 rounded-xl p-1 w-fit mb-6">
                    {([
                        { id: 'create', label: '+ Create Exam' },
                        { id: 'live', label: `Live Exams ${activeExams.length > 0 ? `(${activeExams.length})` : ''}` },
                        { id: 'monitor', label: 'Exam Reports' },
                    ] as const).map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'create' && (
                    <div className="space-y-6">
                        <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 space-y-5">
                            <h3 className="text-white font-bold text-base flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-400" /> New Exam
                            </h3>

                            {publishError && (
                                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" /> {publishError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 block">Exam Title</label>
                                    <input value={examTitle} onChange={e => setExamTitle(e.target.value)}
                                        placeholder="e.g. Kinematics Mid-Term Test"
                                        className="w-full bg-[#0b1121] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/40" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 block">Duration (minutes)</label>
                                    <input type="number" min={5} max={180} value={examDuration} onChange={e => setExamDuration(Number(e.target.value))}
                                        className="w-full bg-[#0b1121] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40" />
                                </div>
                            </div>
                        </div>

                        {sections.map((sec, si) => (
                            <div key={sec.id} className="bg-[#0f172a] border border-white/5 rounded-2xl overflow-hidden">
                                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-white/[0.01]">
                                    <input value={sec.title} onChange={e => updateSection(sec.id, e.target.value)}
                                        className="flex-1 bg-transparent text-white font-bold text-sm focus:outline-none border-b border-transparent focus:border-emerald-500/40 pb-0.5" />
                                    <span className="text-xs text-slate-500">{sec.questions.length} Q</span>
                                    {sections.length > 1 && (
                                        <button onClick={() => removeSection(sec.id)} className="text-red-400 hover:text-red-300 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                </div>

                                <div className="divide-y divide-white/[0.03]">
                                    {sec.questions.map((q, qi) => (
                                        <div key={q.id} className="p-5 space-y-4">
                                            <div className="flex items-start gap-3">
                                                <span className="text-xs font-black text-slate-500 w-6 pt-2.5 shrink-0">Q{qi + 1}</span>
                                                <div className="flex-1 space-y-3">
                                                    <textarea value={q.text} onChange={e => updateQuestion(sec.id, q.id, { text: e.target.value })}
                                                        placeholder="Enter question text..." rows={2}
                                                        className="w-full bg-[#0b1121] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 resize-none" />

                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => fileRefs.current[q.id]?.click()}
                                                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 px-3 py-1.5 rounded-lg transition-all">
                                                            <Image className="w-3.5 h-3.5" /> {q.imageURL ? 'Change Image' : 'Add Image'}
                                                        </button>
                                                        <input ref={el => { fileRefs.current[q.id] = el; }} type="file" accept="image/*" className="hidden"
                                                            onChange={e => handleImagePick(sec.id, q.id, e.target.files?.[0] ?? null)} />
                                                        {q.imageURL && <img src={q.imageURL} alt="q" className="h-12 w-auto rounded-lg border border-white/10 object-cover" />}
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {q.options.map((opt, oi) => (
                                                            <div key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${q.correctIndex === oi ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/10'}`}>
                                                                <button onClick={() => updateQuestion(sec.id, q.id, { correctIndex: oi })}
                                                                    className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${q.correctIndex === oi ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600 hover:border-emerald-500/50'}`}>
                                                                    {q.correctIndex === oi && <div className="w-2 h-2 rounded-full bg-white" />}
                                                                </button>
                                                                <span className="text-xs text-slate-500 font-bold shrink-0">{String.fromCharCode(65 + oi)}.</span>
                                                                <input value={opt} onChange={e => updateOption(sec.id, q.id, oi, e.target.value)}
                                                                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                                                    className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-600" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                {sec.questions.length > 1 && (
                                                    <button onClick={() => removeQuestion(sec.id, q.id)} className="text-slate-600 hover:text-red-400 transition-colors mt-2"><Trash2 className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-5 py-3 border-t border-white/[0.03]">
                                    <button onClick={() => addQuestion(sec.id)} className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                                        <Plus className="w-3.5 h-3.5" /> Add Question
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={addSection}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-300 text-sm font-semibold transition-all">
                                <Plus className="w-4 h-4" /> Add Section
                            </button>
                            <button onClick={handlePublish} disabled={publishing}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-2xl text-sm font-bold transition-all shadow-xl shadow-emerald-500/20">
                                {publishing ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {publishing ? 'Publishing...' : 'Publish Exam'}
                            </button>
                        </div>
                    </div>
                )}

                {tab === 'live' && (
                    <div className="space-y-4">
                        {activeExams.length === 0 ? (
                            <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-12 text-center">
                                <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-40" />
                                <p className="text-slate-400">No active exams.</p>
                            </div>
                        ) : activeExams.map(exam => (
                            <div key={exam.id} className="bg-[#0f172a] border border-emerald-500/20 rounded-2xl p-5">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                            <h4 className="text-white font-bold">{exam.title}</h4>
                                            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">LIVE</span>
                                        </div>
                                        <p className="text-slate-500 text-xs">{exam.sections.length} sections · {exam.totalQuestions} questions · {exam.durationMin} min</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openReport(exam)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-semibold transition-all">
                                            <BarChart3 className="w-3.5 h-3.5" /> Live Report
                                        </button>
                                        <button onClick={() => handleEndExam(exam.id)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold transition-all">
                                            <StopCircle className="w-3.5 h-3.5" /> End Exam
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'monitor' && (
                    <div className="space-y-4">
                        <div className="bg-[#0f172a] border border-white/5 rounded-2xl overflow-hidden">
                            <div className="p-4 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-white font-semibold text-sm">All Exam Results (Free Practice)</h3>
                            </div>
                            {examResults.length === 0 ? (
                                <div className="p-12 text-center text-slate-500"><BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>No exam data recorded yet.</p></div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-white/5 bg-white/[0.01]">
                                                <th className="px-5 py-4 text-left text-xs text-slate-500 font-bold uppercase tracking-widest">Student</th>
                                                <th className="px-5 py-4 text-left text-xs text-slate-500 font-bold uppercase tracking-widest">Test</th>
                                                <th className="px-5 py-4 text-center text-xs text-slate-500 font-bold uppercase tracking-widest">Score</th>
                                                <th className="px-5 py-4 text-center text-xs text-slate-500 font-bold uppercase tracking-widest">Tab Switches</th>
                                                <th className="px-5 py-4 text-center text-xs text-slate-500 font-bold uppercase tracking-widest">Status</th>
                                                <th className="px-5 py-4 text-right text-xs text-slate-500 font-bold uppercase tracking-widest">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {examResults.map(res => (
                                                <tr key={res.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs font-black">{res.studentName?.charAt(0)}</div>
                                                            <div>
                                                                <p className="text-white font-bold">{res.studentName}</p>
                                                                <p className="text-slate-500 text-[10px]">{res.studentEmail}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="text-white font-semibold">{res.subject}</p>
                                                        <p className="text-slate-500 text-[10px]">{res.difficulty} · {res.mode}</p>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <span className={`font-black ${res.score / res.totalQuestions >= 0.7 ? 'text-emerald-400' : 'text-slate-200'}`}>{res.score}/{res.totalQuestions}</span>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <span className={`font-bold text-sm ${(res.tabSwitches ?? 0) > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{res.tabSwitches ?? 0}</span>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {res.terminated ? (
                                                            <span className="flex items-center justify-center gap-1 text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded-md font-black">TERMINATED</span>
                                                        ) : (
                                                            <span className="flex items-center justify-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-md font-black">CLEAN</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <p className="text-slate-400 text-[10px] font-bold">{new Date(res.timestamp).toLocaleDateString()}</p>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {endedExams.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ended Teacher Exams</h4>
                                {endedExams.map(exam => (
                                    <div key={exam.id} className="bg-[#0f172a] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-bold text-sm">{exam.title}</p>
                                            <p className="text-slate-500 text-xs">{exam.totalQuestions} questions · {exam.durationMin} min</p>
                                        </div>
                                        <button onClick={() => openReport(exam)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl text-xs font-semibold">
                                            <FileText className="w-3.5 h-3.5" /> View Report
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {reportExam && (
                <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur flex items-center justify-center p-4">
                    <div className="bg-[#0b1121] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                            <div>
                                <h3 className="text-white font-bold">{reportExam.title}</h3>
                                <p className="text-slate-500 text-xs">{reportExam.totalQuestions} questions</p>
                            </div>
                            <button onClick={() => setReportExam(null)} className="text-slate-500 hover:text-white"><XCircle className="w-5 h-5" /></button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-6 space-y-6">
                            {reportLoading ? <div className="flex justify-center"><Loader className="w-6 h-6 text-emerald-400 animate-spin" /></div> : (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Total', val: students.length, color: 'blue' },
                                            { label: 'Attempted', val: reportData.length, color: 'emerald' },
                                            { label: "Didn't", val: students.length - reportData.length, color: 'red' },
                                            { label: 'Avg', val: reportData.length ? `${Math.round(reportData.reduce((s, r) => s + (r.score / r.totalQuestions) * 100, 0) / reportData.length)}%` : '—', color: 'yellow' },
                                        ].map(({ label, val, color }) => (
                                            <div key={label} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-xl p-3 text-center`}>
                                                <p className={`text-xl font-black text-${color}-400`}>{val}</p>
                                                <p className="text-xs text-slate-500">{label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div>
                                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Submissions</h4>
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-white/5">
                                                    <th className="px-3 py-2 text-left text-slate-500">Student</th>
                                                    <th className="px-3 py-2 text-center text-slate-500">Score</th>
                                                    <th className="px-3 py-2 text-center text-slate-500">Viewed</th>
                                                    <th className="px-3 py-2 text-center text-slate-500">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.map(r => (
                                                    <tr key={r.id}>
                                                        <td className="px-3 py-2 text-white font-semibold">{r.studentName}</td>
                                                        <td className="px-3 py-2 text-center font-bold">{r.score}/{r.totalQuestions}</td>
                                                        <td className="px-3 py-2 text-center">{r.answered ?? r.score}</td>
                                                        <td className="px-3 py-2 text-center">{r.terminated ? <span className="text-red-400">TERM</span> : <span className="text-emerald-400">DONE</span>}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {whoDidntWrite(reportExam).length > 0 && (
                                        <div>
                                            <h4 className="text-red-400 text-xs font-bold uppercase tracking-widest mb-3">Didn't Attempt</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {whoDidntWrite(reportExam).map(s => (
                                                    <div key={s.uid} className="bg-red-500/5 px-3 py-1.5 rounded-xl border border-red-500/15 text-slate-300 text-xs">{s.name}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
