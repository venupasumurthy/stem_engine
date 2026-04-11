import React, { useState } from 'react';
import { BookMarked, Search, Atom, Shell, Sigma, Trash2, Play, Microscope } from 'lucide-react';
import { PyqItem } from './Sidebar';
import { translations, Language } from '../translations';

interface PYQBankProps {
    pyqs: PyqItem[];
    onAddPyq?: (q: PyqItem) => void;
    onRemovePyq?: (idx: number | string) => void;
    onPractice?: (q: PyqItem) => void;
    language: Language;
}

export const PYQBank: React.FC<PYQBankProps> = ({ pyqs, onAddPyq, onRemovePyq, onPractice, language }) => {
    const t = translations[language];
    const [search, setSearch] = useState('');
    const [filterSubject, setFilterSubject] = useState<string>('All');

    // Add form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');
    const [newExam, setNewExam] = useState('');
    const [newYear, setNewYear] = useState('');
    const [newSubject, setNewSubject] = useState('Physics');

    const handleManualAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuestion.trim() || !onAddPyq) return;

        onAddPyq({
            question: newQuestion.trim(),
            exam: newExam.trim() || undefined,
            year: newYear.trim() || undefined,
            subject: newSubject,
            savedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        });

        setNewQuestion('');
        setNewExam('');
        setNewYear('');
        setShowAddForm(false);
    };

    const subjects = ['All', 'Physics', 'Chemistry', 'Biology', 'Mathematics'];

    const filtered = pyqs.filter(q => {
        const matchesSearch = q.question.toLowerCase().includes(search.toLowerCase()) ||
            (q.exam?.toLowerCase().includes(search.toLowerCase()) ?? false);
        const matchesSubject = filterSubject === 'All' || q.subject === filterSubject;
        return matchesSearch && matchesSubject;
    });

    const subjectIcon: Record<string, any> = {
        Physics: Atom, Chemistry: Shell, Mathematics: Sigma, Biology: Microscope,
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 max-w-5xl w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                    <BookMarked className="w-7 h-7 text-red-400" />
                    <div>
                        <h2 className="text-xl font-bold text-white leading-tight">{t.pyq.title}</h2>
                        <p className="text-brand-muted text-xs mt-0.5">{pyqs.length} question{pyqs.length !== 1 ? 's' : ''} saved</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t.pyq.search}
                                className="bg-[#0b1121] border border-brand-muted/20 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent placeholder-brand-muted/40 w-48 lg:w-64"
                            />
                        </div>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="bg-red-600/20 hover:bg-red-600/30 text-red-100 px-4 py-2 rounded-xl text-sm font-semibold border border-red-500/30 transition-all flex items-center space-x-2 shadow-lg shadow-red-500/10"
                        >
                            <Play className="w-3.5 h-3.5 rotate-90" />
                            <span>{showAddForm ? 'Cancel' : 'Add Question'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Manual Add Form */}
            {showAddForm && (
                <form onSubmit={handleManualAdd} className="mb-8 p-6 bg-[#0b1121] rounded-2xl border border-white/5 animate-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1.5 block">Question Text</label>
                            <textarea
                                value={newQuestion}
                                onChange={e => setNewQuestion(e.target.value)}
                                placeholder="Paste or type the entrance exam question here..."
                                className="w-full bg-[#080e1a] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/40 min-h-[100px] resize-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1.5 block">Entrance Exam</label>
                            <input
                                value={newExam}
                                onChange={e => setNewExam(e.target.value)}
                                placeholder="e.g. JEE Main, NEET"
                                className="w-full bg-[#080e1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/40"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1.5 block">Year</label>
                                <input
                                    value={newYear}
                                    onChange={e => setNewYear(e.target.value)}
                                    placeholder="2024"
                                    className="w-full bg-[#080e1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/40"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1.5 block">Subject</label>
                                <select
                                    value={newSubject}
                                    onChange={e => setNewSubject(e.target.value)}
                                    className="w-full bg-[#080e1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/40"
                                >
                                    {subjects.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!newQuestion.trim()}
                        className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-95 disabled:opacity-50"
                    >
                        Save to PYQ Bank
                    </button>
                </form>
            )}

            {/* Subject Filter */}
            <div className="flex space-x-2 mb-6">
                {subjects.map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterSubject(s)}
                        className={`px-4 py-1.5 rounded-lg text-sm transition-colors border ${filterSubject === s
                            ? 'bg-[#1e293b] border-brand-muted/30 text-white'
                            : 'border-transparent text-brand-muted hover:text-white'
                            }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* Empty State */}
            {filtered.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-brand-muted/50 border-2 border-dashed border-brand-muted/10 rounded-2xl p-12">
                    <BookMarked className="w-12 h-12 mb-4 opacity-30" />
                    <p className="text-base font-medium mb-1">{t.pyq.empty}</p>
                    <p className="text-sm">
                        {pyqs.length === 0
                            ? 'Go to Problem Solver, enter a question, and click "Add to PYQ Bank".'
                            : 'No questions match your filter.'}
                    </p>
                </div>
            )}

            {/* Questions List */}
            <div className="space-y-3">
                {filtered.map((q, i) => {
                    const SubIcon = q.subject ? (subjectIcon[q.subject] ?? BookMarked) : BookMarked;
                    return (
                        <div
                            key={i}
                            className="bg-[#0b1121] border border-brand-muted/10 rounded-xl p-5 hover:border-brand-muted/30 transition-colors group"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start space-x-4 flex-1 min-w-0">
                                    <div className="mt-1 p-2 rounded-lg bg-brand-surface border border-brand-muted/10 shrink-0">
                                        <SubIcon className="w-4 h-4 text-brand-muted" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white text-sm font-medium leading-relaxed break-words">{q.question}</p>
                                        <div className="flex items-center space-x-3 mt-2">
                                            {q.exam && (
                                                <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded">
                                                    {q.exam}
                                                </span>
                                            )}
                                            {q.year && (
                                                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded">
                                                    {q.year}
                                                </span>
                                            )}
                                            {q.subject && (
                                                <span className="text-brand-muted/50 text-[11px]">{q.subject}</span>
                                            )}
                                            <span className="text-brand-muted/30 text-[11px]">{q.savedAt}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    {onPractice && (
                                        <button
                                            onClick={() => onPractice(q)}
                                            className="p-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg transition-colors"
                                            title="Practice this question"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                    )}
                                    {onRemovePyq && (
                                        <button
                                            onClick={() => onRemovePyq((q as any).id ?? pyqs.indexOf(q))}
                                            className="p-2 bg-red-600/10 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                                            title="Remove from PYQ Bank"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
