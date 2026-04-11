import React, { useState, FormEvent, useEffect } from 'react';
import { StepByStepView } from './StepByStepView';
import { GraphView } from './GraphView';
import { solveEquation, plotEquation, scanImage } from '../services/api';
import { solveWithAI } from '../services/aiService';
import { SolveResult, PlotData } from '../types';
import {
    Atom, Shell, Sigma, Microscope, Dna,
    Lightbulb, Zap, List, BookOpen, GraduationCap,
    Upload, Sparkles, BookMarked, RefreshCw, X, Mic, MicOff, FileText,
    Calculator
} from 'lucide-react';
import { PyqItem } from './Sidebar';
import { MathCalculator } from './MathCalculator';
import { CheatSheet } from './CheatSheet';
import { translations, Language } from '../translations';


type Subject = 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology';
type ExplanationLevel = 'Quick' | 'Step by Step' | 'Detailed' | 'Proof' | 'ELI10';

interface ProblemSolverProps {
    onAddPyq?: (q: PyqItem) => void;
    language: Language;
    onSolveSuccess?: () => void;
}

export const ProblemSolver: React.FC<ProblemSolverProps> = ({ onAddPyq, language, onSolveSuccess }) => {
    const t = translations[language];
    const [subject, setSubject] = useState<Subject>('Biology');
    const [problemText, setProblemText] = useState('');
    const [hintMode, setHintMode] = useState(false);
    const [expLevel, setExpLevel] = useState<ExplanationLevel>('Step by Step');

    // PYQ state
    const [markAsPyq, setMarkAsPyq] = useState(false);
    const [pyqExam, setPyqExam] = useState('');
    const [pyqYear, setPyqYear] = useState('');
    const [pyqSaved, setPyqSaved] = useState(false);

    // Solve state
    const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
    const [plotData, setPlotData] = useState<PlotData | null>(null);
    const [isSolving, setIsSolving] = useState(false);
    const [isPlotting, setIsPlotting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [showSolution, setShowSolution] = useState(true);
    const [showCalculator, setShowCalculator] = useState(false);
    const [showCheatSheet, setShowCheatSheet] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);

    // Specialized Solvers State
    const [circuitVoltage, setCircuitVoltage] = useState('');
    const [circuitResistance1, setCircuitResistance1] = useState('');
    const [circuitResistance2, setCircuitResistance2] = useState('');
    const [circuitType, setCircuitType] = useState<'Series' | 'Parallel'>('Series');
    const [showCircuitSolver, setShowCircuitSolver] = useState(false);
    const [showOrganicSolver, setShowOrganicSolver] = useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const recognitionRef = React.useRef<any>(null);

    // Variable inputs state
    const [detectedVars, setDetectedVars] = useState<string[]>([]);
    const [varValues, setVarValues] = useState<Record<string, string>>({});
    const [solveFor, setSolveFor] = useState<string>('');

    // Listen for "Practice this PYQ" event from PYQBank
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as string;
            if (detail) {
                setProblemText(detail);
                setSolveResult(null);
                setPlotData(null);
                setMarkAsPyq(false);
                setPyqSaved(false);
                // Atomic solve trigger:
                setTimeout(() => {
                    const btn = document.getElementById('solve-trigger-btn');
                    if (btn) btn.click();
                }, 150);
            }
        };
        window.addEventListener('pyq-practice', handler);
        return () => window.removeEventListener('pyq-practice', handler);
    }, []);

    // Detect variables in formula
    useEffect(() => {
        if (!problemText.trim()) {
            setDetectedVars([]);
            setVarValues({});
            return;
        }

        // Simple heuristic: find single letters or greek characters that aren't functions
        // Excluding common math constants/functions if needed, but SymPy handles them.
        const matches = problemText.match(/\b([a-zA-Z]|[\u0370-\u03FF])\b/g);
        if (matches) {
            const uniqueVars = Array.from(new Set(matches)).sort();
            setDetectedVars(uniqueVars);

            // Re-sync varValues if variables changed
            setVarValues(prev => {
                const next = { ...prev };
                // Remove keys no longer present
                Object.keys(next).forEach(k => {
                    if (!uniqueVars.includes(k)) delete next[k];
                });
                return next;
            });

            // Set default solveFor if not set or not in uniqueVars
            if (!solveFor || !uniqueVars.includes(solveFor)) {
                // Heuristic: pick the one on LHS if it's like "F = ..."
                const parts = problemText.split('=');
                if (parts.length > 1) {
                    const lhsVars = parts[0].match(/\b([a-zA-Z]|[\u0370-\u03FF])\b/g);
                    if (lhsVars && lhsVars.length === 1) {
                        setSolveFor(lhsVars[0]);
                    } else {
                        setSolveFor(uniqueVars[0]);
                    }
                } else {
                    setSolveFor(uniqueVars[0]);
                }
            }
        } else {
            setDetectedVars([]);
        }
    }, [problemText, solveFor]);

    const subjects: { id: Subject; icon: any; label?: string }[] = [
        { id: 'Physics', icon: Atom },
        { id: 'Chemistry', icon: Shell },
        { id: 'Biology', icon: Microscope },
        { id: 'Mathematics', icon: Sigma },
    ];

    const expLevels: { id: ExplanationLevel; icon: any }[] = [
        { id: 'Quick', icon: Zap },
        { id: 'Step by Step', icon: List },
        { id: 'Detailed', icon: BookOpen },
        { id: 'Proof', icon: Sigma },
        { id: 'ELI10', icon: GraduationCap },
    ];

    const tryExamples: Record<Subject, { label: string; val: string }[]> = {
        Biology: [
            { label: 'DNA Base Pairing', val: 'Explain DNA base pairing rules and calculate percentage of Cytosine if Adenine is 30%' },
            { label: 'Photosynthesis Rate', val: 'How does light intensity affect the rate of photosynthesis in Elodea plants?' },
            { label: 'Mendelian Genetics', val: 'Predict the offspring ratios for a cross between two heterozygous (Aa) pea plants' },
        ],
        Physics: [
            { label: 'Ball thrown up at 20 m/s — max height?', val: 'A ball is thrown vertically upward with initial velocity 20 m/s, find maximum height' },
            { label: 'Force on 5 kg object at 3 m/s²', val: 'Calculate the force needed to accelerate a 5 kg mass at 3 m/s²' },
            { label: 'Voltage across 10Ω with 2A current', val: 'Calculate the voltage across a 10 ohm resistor with 2 ampere current' },
        ],
        Chemistry: [
            { label: 'Balance: Fe + O2 → Fe2O3', val: 'Fe + O2 = Fe2O3' },
            { label: 'Molar mass of H2SO4', val: 'molar mass H2SO4' },
            { label: 'pH of 0.01M HCl solution', val: 'pH of 0.01M HCl' },
        ],
        Mathematics: [
            { label: 'Solve x² + 5x + 6 = 0', val: 'x**2 + 5*x + 6 = 0' },
            { label: 'Integral of sin(x)', val: 'integrate sin(x)' },
            { label: 'Derivative of x³', val: 'diff(x**3)' },
        ],
    };

    const handleSolve = async (e?: FormEvent) => {
        if (e) e.preventDefault();
        if (!problemText.trim()) return;
        setIsSolving(true);
        setIsPlotting(true);
        setSolveResult(null);
        setPlotData(null);
        setShowSolution(true);
        setPyqSaved(false);

        try {
            const provider = localStorage.getItem('ai_provider') || 'gemini';
            let result = await solveWithAI(problemText, subject, expLevel, language, provider);

            // If AI failed or returned an empty successful result, try local fallback
            if (!result.success || (!result.steps && !result.final_answer && !result.final_values)) {
                console.log("[AI] Falling back to local symbolic solver...");
                try {
                    const localRes = await solveEquation(problemText, undefined, undefined, expLevel);
                    if (localRes.success) {
                        result = localRes;
                    }
                } catch (localErr) {
                    console.error("Local solver fallback failed:", localErr);
                }
            }

            setSolveResult(result);
            if (result.success && onSolveSuccess) onSolveSuccess();

            // Still try to plot mathematical expressions if it looks like one
            if (subject === 'Mathematics' || problemText.includes('=') || problemText.includes('x')) {
                try {
                    const plotRes = await plotEquation(problemText);
                    setPlotData(plotRes);
                } catch { /* plotting optional */ }
            }
        } catch (err: any) {
            console.error("Solve error:", err);
            setSolveResult({
                success: false,
                error: err.message || 'AI Solver encountered an error. Ensure the local Python backend is running on port 8000.'
            });
        } finally {
            setIsSolving(false);
            setIsPlotting(false);
        }
    };

    const handleSolveCircuit = () => {
        const v = parseFloat(circuitVoltage);
        const r1 = parseFloat(circuitResistance1);
        const r2 = parseFloat(circuitResistance2);

        if (isNaN(v) || isNaN(r1) || isNaN(r2)) {
            alert("Please enter valid numbers for Voltage and Resistance.");
            return;
        }

        let eq = "";
        if (circuitType === 'Series') {
            eq = `circuit series voltage ${v}V R1 ${r1}ohm R2 ${r2}ohm`;
            // Temporary simple solving logic to feed to backend
            setProblemText(`Calculate total resistance and current for a series circuit with V=${v}, R1=${r1}, R2=${r2}`);
        } else {
            eq = `circuit parallel voltage ${v}V R1 ${r1}ohm R2 ${r2}ohm`;
            setProblemText(`Calculate total resistance and current for a parallel circuit with V=${v}, R1=${r1}, R2=${r2}`);
        }

        // Wait a tick for state to update, then solve
        setTimeout(() => handleSolve(), 50);
    };

    const handleSolveOrganic = () => {
        if (!problemText.trim()) {
            alert("Please describe the organic chemistry problem (e.g., 'Name CH3-CH2-OH' or 'Reaction of benzene and Br2').");
            return;
        }
        // Prefix to help backend route it
        if (!problemText.toLowerCase().includes('organic')) {
            setProblemText(`Organic Chemistry: ${problemText}`);
        }
        setTimeout(() => handleSolve(), 50);
    };

    const handleNewProblem = () => {
        setProblemText('');
        setSolveResult(null);
        setPlotData(null);
        setMarkAsPyq(false);
        setPyqExam('');
        setPyqYear('');
        setPyqSaved(false);
    };

    const handleCalculatorInput = (val: string) => {
        const textarea = document.getElementById('problem-textarea') as HTMLTextAreaElement;
        if (!textarea) {
            setProblemText(prev => prev + val);
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = problemText;
        const newText = text.substring(0, start) + val + text.substring(end);
        setProblemText(newText);

        // Reset cursor position after render
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + val.length, start + val.length);
        }, 0);
    };

    const handleCalculatorDelete = () => {
        const textarea = document.getElementById('problem-textarea') as HTMLTextAreaElement;
        if (!textarea) {
            setProblemText(prev => prev.slice(0, -1));
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = problemText;

        if (start === end) {
            if (start === 0) return;
            const newText = text.substring(0, start - 1) + text.substring(end);
            setProblemText(newText);
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start - 1, start - 1);
            }, 0);
        } else {
            const newText = text.substring(0, start) + text.substring(end);
            setProblemText(newText);
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start, start);
            }, 0);
        }
    };

    const toggleListening = () => {
        if (isListening) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice recognition is not supported in this browser. Please try Chrome or Edge.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        const originalText = problemText;

        recognition.onstart = () => setIsListening(true);

        recognition.onresult = (e: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = e.resultIndex; i < e.results.length; ++i) {
                if (e.results[i].isFinal) {
                    finalTranscript += e.results[i][0].transcript;
                } else {
                    interimTranscript += e.results[i][0].transcript;
                }
            }
            const sep = originalText.trim() ? " " : "";
            setProblemText(originalText + sep + finalTranscript + interimTranscript);
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);

        try {
            recognition.start();
        } catch (err) {
            console.error(err);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setScanError(null);

        try {
            const result = await scanImage(file);
            console.log("OCR Result:", result);
            if (result.success) {
                // Determine the best text to show
                const questions: string[] = (result as any).questions ?? [];
                const textToShow = questions.length > 0
                    ? questions[0]
                    : ((result as any).text || "No text detected in image.");

                setProblemText(textToShow);

                // Auto-solve if it's a substantive question
                if (textToShow.length > 10) {
                    setTimeout(() => handleSolve(), 200);
                }

                if ((result as any).is_paper && questions.length > 1) {
                    // Also add all to bank if multiple
                    if (onAddPyq) {
                        questions.forEach((q: string) => {
                            onAddPyq({
                                question: q,
                                subject,
                                exam: 'Extracted from Image',
                                savedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                            });
                        });
                        alert(`Extracted ${questions.length} questions and added them to your PYQ Bank!`);
                    }
                }
            } else {
                setScanError(result.error || 'Failed to scan image.');
            }
        } catch (err) {
            console.error("OCR Error:", err);
            setScanError('An error occurred during scanning. Make sure the backend server is running with OCR support.');
        } finally {
            setIsScanning(false);
            if (e.target) e.target.value = ''; // Reset input
        }
    };

    const handleAddToPyqBank = () => {
        if (!problemText.trim() || !onAddPyq) return;
        onAddPyq({
            question: problemText,
            exam: pyqExam.trim() || undefined,
            year: pyqYear.trim() || undefined,
            subject,
            savedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        });
        setPyqSaved(true);
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 max-w-5xl w-full">

            {/* Subject Pills */}
            <div className="flex flex-wrap gap-2 mb-7">
                {subjects.map(s => {
                    const Icon = s.icon;
                    const isActive = subject === s.id;
                    return (
                        <button
                            key={s.id}
                            onClick={() => setSubject(s.id)}
                            className={`flex items-center space-x-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${isActive
                                ? 'bg-blue-600/30 text-white shadow-md'
                                : 'bg-brand-surface text-brand-muted hover:text-white'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-brand-muted'}`} />
                            <span>{s.label || s.id}</span>
                        </button>
                    );
                })}
            </div>

            {/* Enter Problem */}
            <div className="mb-3 flex justify-between items-center">
                <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest">Enter Your Problem</h3>
                <button
                    onClick={() => setHintMode(!hintMode)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hintMode
                        ? 'bg-yellow-900/30 text-yellow-400 shadow-md'
                        : 'bg-brand-surface text-brand-muted hover:text-white'
                        }`}
                >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Hint Mode</span>
                </button>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setShowCheatSheet(true)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 shadow-md"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Cheat Sheet</span>
                    </button>
                    <button
                        onClick={toggleListening}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isListening
                            ? 'bg-red-900/40 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                            : 'bg-brand-surface text-brand-muted hover:text-white'
                            }`}
                    >
                        {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                        <span>{isListening ? 'Listening...' : 'Dictate'}</span>
                    </button>
                    <button
                        onClick={() => setShowCalculator(!showCalculator)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showCalculator
                            ? 'bg-blue-600/30 text-blue-400 shadow-md'
                            : 'bg-brand-surface text-brand-muted hover:text-white'
                            }`}
                    >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Calculator</span>
                    </button>
                </div>
            </div>

            <form onSubmit={handleSolve} className="relative group">
                <textarea
                    id="problem-textarea"
                    value={problemText}
                    onChange={e => setProblemText(e.target.value)}
                    placeholder={t.solver.placeholder}
                    className="w-full h-44 bg-[#0b1121] rounded-2xl p-6 text-white placeholder-brand-muted/40 focus:outline-none transition-all text-sm resize-none custom-scrollbar shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]"
                />
            </form>

            {scanError && (
                <div className="mb-4 p-3 bg-red-900/20 rounded-xl text-red-400 text-xs flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 shadow-md">
                    <X className="w-3.5 h-3.5 cursor-pointer" onClick={() => setScanError(null)} />
                    <span>{scanError}</span>
                </div>
            )}

            {showCalculator && (
                <div className="mb-6">
                    <MathCalculator
                        onInput={handleCalculatorInput}
                        onDelete={handleCalculatorDelete}
                        onClear={handleNewProblem}
                        onSolve={(e?: any) => handleSolve(e || { preventDefault: () => { } } as any)}
                        onClose={() => setShowCalculator(false)}
                    />
                </div>
            )}

            {/* Variable Inputs */}
            {detectedVars.length > 0 && subject === 'Mathematics' && (
                <div className="mb-6 animate-in slide-in-from-top-4 duration-300">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4 flex items-center space-x-2">
                        <Sigma className="w-3.5 h-3.5 text-blue-400" />
                        <span>Variable Inputs</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {detectedVars.map(v => (
                            <div key={v} className={`relative group p-3 rounded-xl transition-all shadow-md ${solveFor === v ? 'bg-blue-600/15' : 'bg-brand-surface'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-brand-muted uppercase tracking-wider">{v}</label>
                                    <button
                                        type="button"
                                        onClick={() => setSolveFor(v)}
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${solveFor === v ? 'bg-blue-500 text-white' : 'bg-brand-muted/10 text-brand-muted hover:bg-brand-muted/20 hover:text-white'}`}
                                    >
                                        {solveFor === v ? 'Solving' : 'Solve for'}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={varValues[v] || ''}
                                    placeholder={solveFor === v ? 'Unknown' : 'Value'}
                                    disabled={solveFor === v}
                                    onChange={e => setVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                                    className={`w-full bg-[#0b1121] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder-brand-muted/30 shadow-inner ${solveFor === v ? 'opacity-50 cursor-not-allowed' : ''}`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Try examples */}
            <div className="flex items-center flex-wrap gap-2 mb-6">
                <span className="text-xs text-brand-muted shrink-0">Try:</span>
                {tryExamples[subject].map((ex, i) => (
                    <button
                        key={i}
                        onClick={() => setProblemText(ex.val)}
                        className="px-3 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] rounded-lg text-xs text-brand-muted hover:text-white transition-colors shadow-sm"
                    >
                        {ex.label}
                    </button>
                ))}
            </div>

            {/* Circuit Solver — Physics */}
            {subject === 'Physics' && (
                <div className="mb-6">
                    <button
                        onClick={() => setShowCircuitSolver(v => !v)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${showCircuitSolver
                            ? 'bg-blue-900/25 text-white shadow-lg'
                            : 'bg-[#0f172a] text-brand-muted hover:text-white hover:bg-brand-surface/50'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center space-x-3">
                                <Sparkles className="w-7 h-7 text-brand-accent animate-pulse" />
                                <h2 className="text-xl font-bold text-white tracking-tight">{t.solver.title}</h2>
                            </div>
                            <span className="text-xs text-brand-muted">(Series / Parallel)</span>
                        </div>
                        <span className="text-xs text-brand-muted font-mono">{showCircuitSolver ? '▲ collapse' : '▼ expand'}</span>
                    </button>

                    {showCircuitSolver && (
                        <div className="mt-2 p-5 bg-[#0f172a] rounded-2xl animate-in slide-in-from-top-2 duration-200 shadow-xl">
                            <div className="flex flex-wrap gap-4 mb-4">
                                <div className="flex items-center space-x-2 bg-[#0b1121] p-1 rounded-lg">
                                    {(['Series', 'Parallel'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setCircuitType(type)}
                                            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${circuitType === type ? 'bg-blue-600 text-white shadow-sm' : 'text-brand-muted hover:text-white'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Voltage (V)</label>
                                    <input type="number" value={circuitVoltage} onChange={e => setCircuitVoltage(e.target.value)} placeholder="e.g. 12" className="w-full bg-[#0b1121] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 shadow-inner" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">R1 (Ω)</label>
                                    <input type="number" value={circuitResistance1} onChange={e => setCircuitResistance1(e.target.value)} placeholder="e.g. 4" className="w-full bg-[#0b1121] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 shadow-inner" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">R2 (Ω)</label>
                                    <input type="number" value={circuitResistance2} onChange={e => setCircuitResistance2(e.target.value)} placeholder="e.g. 6" className="w-full bg-[#0b1121] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 shadow-inner" />
                                </div>
                            </div>

                            <button onClick={handleSolveCircuit} className="w-full sm:w-auto px-6 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-sm">
                                <Zap className="w-4 h-4" />
                                <span>Calculate Circuit</span>
                            </button>

                            {(circuitVoltage && circuitResistance1 && circuitResistance2) && (
                                <div className="mt-4 p-4 border border-dashed border-blue-500/10 rounded-xl bg-[#0b1121] flex flex-col items-center justify-center italic text-brand-muted text-xs">
                                    <span className="mb-2 font-mono text-blue-400 not-italic border border-blue-500/20 p-2 rounded-lg bg-blue-900/10">
                                        {circuitType === 'Series'
                                            ? `[+]--(${circuitVoltage}V)--[R1:${circuitResistance1}Ω]--[R2:${circuitResistance2}Ω]--[-]`
                                            : `[+]--(${circuitVoltage}V)--+--[R1:${circuitResistance1}Ω]--+--[-]\n                   |--[R2:${circuitResistance2}Ω]--|`}
                                    </span>
                                    Circuit Diagram Preview
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Organic Chemistry Solver — Chemistry */}
            {subject === 'Chemistry' && (
                <div className="mb-6">
                    <button
                        onClick={() => setShowOrganicSolver(v => !v)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${showOrganicSolver
                            ? 'bg-emerald-900/25 text-white shadow-lg'
                            : 'bg-[#0f172a] text-brand-muted hover:text-white hover:bg-brand-surface/50'
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            <Shell className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-semibold">Organic Chemistry Solver</span>
                            <span className="text-xs text-brand-muted">(nomenclature, reactions, mechanisms)</span>
                        </div>
                        <span className="text-xs text-brand-muted font-mono">{showOrganicSolver ? '▲ collapse' : '▼ expand'}</span>
                    </button>

                    {showOrganicSolver && (
                        <div className="mt-2 p-5 bg-[#0f172a] rounded-2xl animate-in slide-in-from-top-2 duration-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                            <p className="text-xs text-brand-muted">Type your organic chemistry problem in the box above (e.g. &quot;Name CH3-CH2-OH&quot; or &quot;Reaction of benzene and Br2&quot;), then click Solve Organic.</p>
                            <button
                                onClick={handleSolveOrganic}
                                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 shrink-0 shadow-sm"
                            >
                                <Shell className="w-4 h-4" />
                                <span>Solve Organic</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Explanation Level */}
            <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-3">Explanation Level</h3>
            <div className="flex flex-wrap gap-2 mb-6">
                {expLevels.map(lvl => {
                    const Icon = lvl.icon;
                    const isActive = expLevel === lvl.id;
                    return (
                        <button
                            key={lvl.id}
                            onClick={() => setExpLevel(lvl.id)}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm transition-all ${isActive
                                ? 'bg-[#1e293b] text-white shadow-md'
                                : 'bg-brand-surface text-brand-muted hover:text-white'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-brand-muted'}`} />
                            <span className="font-medium">{lvl.id}</span>
                        </button>
                    );
                })}
            </div>

            {/* PYQ Toggle Row */}
            <div className="flex items-center gap-4 mb-5 flex-wrap">
                <button
                    type="button"
                    onClick={() => { setMarkAsPyq(!markAsPyq); setPyqSaved(false); }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${markAsPyq
                        ? 'bg-red-600/25 text-red-400 shadow-md'
                        : 'bg-brand-surface text-brand-muted hover:text-white'
                        }`}
                >
                    <BookMarked className="w-4 h-4" />
                    <span>Mark as PYQ</span>
                </button>
                {markAsPyq && (
                    <span className="text-brand-muted/60 text-xs italic">Fill optional details below</span>
                )}
            </div>


            {showCheatSheet && (
                <CheatSheet onClose={() => setShowCheatSheet(false)} />
            )}

            {/* PYQ metadata fields */}
            {markAsPyq && (
                <div className="flex gap-3 mb-5 flex-wrap items-center">
                    <input
                        value={pyqExam}
                        onChange={e => setPyqExam(e.target.value)}
                        placeholder="Exam (e.g. JEE 2023)"
                        className="flex-1 min-w-[180px] bg-[#0b1121] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder-brand-muted/40 shadow-inner"
                    />
                    <input
                        value={pyqYear}
                        onChange={e => setPyqYear(e.target.value)}
                        placeholder="Year (e.g. 2025)"
                        className="w-40 bg-[#0b1121] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder-brand-muted/40 shadow-inner"
                    />
                    {onAddPyq && (
                        pyqSaved ? (
                            <span className="flex items-center space-x-2 bg-emerald-600/20 text-emerald-400 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm">
                                <BookMarked className="w-4 h-4" />
                                <span>Saved to PYQ Bank ✓</span>
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={handleAddToPyqBank}
                                disabled={!problemText.trim()}
                                className="flex items-center space-x-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-red-500/20"
                            >
                                <BookMarked className="w-4 h-4" />
                                <span>Add to PYQ Bank</span>
                            </button>
                        )
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-8">
                <button
                    type="button"
                    id="solve-trigger-btn"
                    onClick={() => handleSolve()}
                    disabled={isSolving || !problemText.trim()}
                    className="bg-brand-accent hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-6 rounded-xl flex items-center space-x-2 transition-all shadow-lg shadow-brand-accent/20 active:scale-95 text-sm"
                >
                    {isSolving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{t.solver.solve_btn}</span>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="flex items-center space-x-2 bg-white/90 hover:bg-white text-gray-900 px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                >
                    <Upload className="w-4 h-4" />
                    <span>{isScanning ? 'Scanning…' : 'Upload Image'}</span>
                </button>
                <button
                    type="button"
                    onClick={handleNewProblem}
                    className="flex items-center space-x-2 bg-brand-surface hover:bg-brand-surface/80 text-brand-muted hover:text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm"
                >
                    <RefreshCw className="w-4 h-4" />
                    <span>New Problem</span>
                </button>
            </div>

            {/* Solution Panel */}
            {(solveResult || isSolving) && (
                <div className="shadow-[0_-1px_0_0_rgba(255,255,255,0.03)] pt-8">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                            <span>Solution</span>
                        </h3>
                        <button
                            onClick={() => setShowSolution(!showSolution)}
                            className="text-xs text-brand-muted hover:text-white transition-colors flex items-center space-x-1"
                        >
                            <X className="w-3 h-3" />
                            <span>{showSolution ? 'Hide' : 'Show'}</span>
                        </button>
                    </div>
                    {showSolution && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <StepByStepView result={solveResult} loading={isSolving} />
                            <div className="h-[400px]">
                                {(plotData || isPlotting) && <GraphView data={plotData} loading={isPlotting} />}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
