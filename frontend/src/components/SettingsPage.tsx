import React, { useState } from 'react';
import {
    Settings, User, Bell, Shield, Palette, Monitor, Moon, Sun,
    ChevronRight, Check, Volume2, VolumeX, Globe, BookOpen, Zap, Camera, Loader
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { translations, Language } from '../translations';

interface SettingsProps {
    user?: { name: string; email: string; uid: string; role?: 'teacher' | 'student'; community_name?: string; photoURL?: string };
    onLogout?: () => void;
    onUpdateProfile?: (data: Partial<{ name: string; photoURL: string }>) => Promise<void>;
    language: Language;
    onLanguageChange: (lang: Language) => void;
    theme: 'dark' | 'light' | 'system';
    setTheme: (theme: 'dark' | 'light' | 'system') => void;
    accent: 'blue' | 'purple' | 'emerald' | 'orange';
    setAccent: (accent: 'blue' | 'purple' | 'emerald' | 'orange') => void;
}

type Section = 'profile' | 'ai' | 'appearance' | 'notifications' | 'privacy' | 'learning';

export const SettingsPage: React.FC<SettingsProps> = ({ user, onLogout, language: globalLanguage, onLanguageChange, theme, setTheme, accent, setAccent }) => {
    const t = translations[globalLanguage];
    const [activeSection, setActiveSection] = useState<Section>('profile');
    const [notifications, setNotifications] = useState({ streaks: true, tips: true, updates: false });
    const [sounds, setSounds] = useState(true);
    const [defaultLevel, setDefaultLevel] = useState('Step by Step');
    const [saved, setSaved] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.uid || !onUpdateProfile) return;

        setUploading(true);
        try {
            const photoRef = ref(storage, `profiles/${user.uid}/avatar`);
            await uploadBytes(photoRef, file);
            const url = await getDownloadURL(photoRef);
            await onUpdateProfile({ photoURL: url });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Photo upload failed:", err);
            alert("Failed to upload photo. Check Firebase Storage rules.");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const sections: { id: Section | 'ai'; label: string; icon: any }[] = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'ai', label: 'AI Configuration', icon: Zap },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'learning', label: 'Learning Preferences', icon: BookOpen },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    ];

    const accentColors: { id: typeof accent; label: string; cls: string }[] = [
        { id: 'blue', label: 'Ocean Blue', cls: 'bg-blue-500' },
        { id: 'purple', label: 'Deep Purple', cls: 'bg-purple-500' },
        { id: 'emerald', label: 'Emerald', cls: 'bg-emerald-500' },
        { id: 'orange', label: 'Amber', cls: 'bg-orange-500' },
    ];

    const initials = (user?.name ?? 'G').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="flex flex-col space-y-6 animate-in fade-in duration-500 max-w-5xl">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1 flex items-center space-x-2">
                    <Settings className="w-6 h-6 text-blue-400" />
                    <span>{t.sidebar.settings}</span>
                </h2>
                <p className="text-sm text-slate-500">Manage your account, preferences, and app settings.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* ── Sidebar ── */}
                <div className="md:w-56 shrink-0">
                    <div className="bg-[#0f172a] rounded-2xl p-2 space-y-1 shadow-md">
                        {sections.map(s => {
                            const Icon = s.icon;
                            const active = activeSection === s.id;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveSection(s.id as Section)}
                                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{s.label}</span>
                                    {active && <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="flex-1 bg-[#0f172a] rounded-2xl p-6 space-y-8 shadow-sm">

                    {/* ─ Profile ─ */}
                    {activeSection === 'profile' && (
                        <div className="space-y-6">
                            <SectionHeader title="Profile Information" desc="Update your name and account details." />

                            <div className="flex items-center space-x-6">
                                <div className="relative group">
                                    <div className="w-20 h-20 rounded-2xl bg-blue-600/20 border-2 border-dashed border-blue-500/30 flex items-center justify-center overflow-hidden shrink-0 transition-all group-hover:border-blue-500/60 shadow-lg">
                                        {user?.photoURL ? (
                                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-2xl font-bold text-blue-300">{initials}</span>
                                        )}
                                        {uploading ? (
                                            <div className="absolute inset-0 bg-[#0f172a]/80 flex items-center justify-center">
                                                <Loader className="w-6 h-6 text-blue-400 animate-spin" />
                                            </div>
                                        ) : (
                                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                                <Camera className="w-6 h-6 text-white" />
                                                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                            </label>
                                        )}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-[#0f172a] rounded-full shadow-sm" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-lg leading-tight">{user?.name ?? 'Guest'}</h4>
                                    <p className="text-slate-400 text-sm mt-0.5">{user?.email ?? 'guest@stem.local'}</p>
                                    <div className="flex items-center space-x-2 mt-2">
                                        <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md uppercase tracking-wider border border-blue-500/20">
                                            {user?.role === 'teacher' ? 'Faculty Admin' : 'Scholar Student'}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-500 italic">ID: {user?.uid.slice(0, 8)}...</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Display Name" value={user?.name ?? 'Guest'} />
                                <Field label="Email" value={user?.email ?? 'guest@stem.local'} type="email" />
                                <Field label="Exam Target" placeholder="e.g. JEE 2026" />
                                <Field label="Grade / Year" placeholder="e.g. Class 12" />
                            </div>

                            <div className="flex items-center justify-between pt-4 shadow-[0_-1px_0_0_rgba(255,255,255,0.03)]">
                                <button
                                    onClick={onLogout}
                                    className="px-4 py-2 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-sm font-semibold transition-colors"
                                >
                                    Sign Out
                                </button>
                                <SaveButton saved={saved} onClick={handleSave} />
                            </div>
                        </div>
                    )}

                    {/* ─ AI Configuration ─ */}
                    {activeSection === 'ai' && (
                        <div className="space-y-6">
                            <SectionHeader title="AI Engine Configuration" desc="Configure which AI model powers your STEM calculations." />

                            <div>
                                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">AI Provider</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => { localStorage.setItem('ai_provider', 'huggingface'); handleSave(); }}
                                        className={`p-4 rounded-xl text-left transition-all ${localStorage.getItem('ai_provider') !== 'gemini'
                                            ? 'bg-blue-600/15 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                            : 'hover:bg-white/5 text-slate-400'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold text-white">Hugging Face</span>
                                            {localStorage.getItem('ai_provider') !== 'gemini' && <Check className="w-4 h-4 text-blue-400" />}
                                        </div>
                                        <p className="text-xs text-slate-400">Uses open-source models (Qwen/Mistral). No setup required.</p>
                                    </button>

                                    <button
                                        onClick={() => { localStorage.setItem('ai_provider', 'gemini'); handleSave(); }}
                                        className={`p-4 rounded-xl text-left transition-all ${localStorage.getItem('ai_provider') === 'gemini'
                                            ? 'bg-purple-600/15 shadow-[0_0_15px_rgba(147,51,234,0.1)]'
                                            : 'hover:bg-white/5 text-slate-400'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold text-white">Google Gemini</span>
                                            {localStorage.getItem('ai_provider') === 'gemini' && <Check className="w-4 h-4 text-purple-400" />}
                                        </div>
                                        <p className="text-xs text-slate-400">Best speed & reasoning. Add your key to .env file in backend.</p>
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 bg-blue-900/10 rounded-xl space-y-2">
                                <h4 className="text-xs font-bold text-blue-300 uppercase tracking-widest flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5" />
                                    Engine Status
                                </h4>
                                <p className="text-[10px] text-slate-400">Default Model: <span className="font-mono text-blue-400">Qwen-2.5-7B</span></p>
                                <div className="flex gap-2 mt-2">
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">Token Valid</span>
                                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase">Ready</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-end pt-4 border-t border-white/5">
                                <SaveButton saved={saved} onClick={handleSave} />
                            </div>
                        </div>
                    )}

                    {/* ─ Appearance ─ */}
                    {activeSection === 'appearance' && (
                        <div className="space-y-6">
                            <SectionHeader title="Appearance" desc="Customise how STEM Engine looks." />

                            <div>
                                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Theme</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {([
                                        { id: 'dark', label: 'Dark', icon: Moon },
                                        { id: 'light', label: 'Light', icon: Sun },
                                        { id: 'system', label: 'System', icon: Monitor },
                                    ] as const).map(t => {
                                        const Icon = t.icon;
                                        return (
                                            <button
                                                key={t.id}
                                                onClick={() => setTheme(t.id)}
                                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${theme === t.id
                                                    ? 'border-blue-500/50 bg-blue-600/10 text-blue-300'
                                                    : 'border-white/5 hover:border-white/15 text-slate-400 hover:text-white'
                                                    }`}
                                            >
                                                <Icon className="w-5 h-5" />
                                                <span className="text-xs font-semibold">{t.label}</span>
                                                {theme === t.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Accent Colour</label>
                                <div className="flex gap-3 flex-wrap">
                                    {accentColors.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setAccent(c.id)}
                                            title={c.label}
                                            className={`w-9 h-9 rounded-full ${c.cls} flex items-center justify-center transition-transform hover:scale-110 ${accent === c.id ? 'ring-2 ring-white/40 ring-offset-2 ring-offset-[#0f172a]' : ''}`}
                                        >
                                            {accent === c.id && <Check className="w-4 h-4 text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-end pt-4 border-t border-white/5">
                                <SaveButton saved={saved} onClick={handleSave} />
                            </div>
                        </div>
                    )}

                    {/* ─ Learning ─ */}
                    {activeSection === 'learning' && (
                        <div className="space-y-6">
                            <SectionHeader title="Learning Preferences" desc="Configure your default solving and study settings." />

                            <div>
                                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Default Explanation Level</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {['Quick', 'Step by Step', 'Detailed', 'Proof', 'ELI10'].map(lvl => (
                                        <button
                                            key={lvl}
                                            onClick={() => setDefaultLevel(lvl)}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${defaultLevel === lvl
                                                ? 'border-blue-500/50 bg-blue-600/10 text-blue-300'
                                                : 'border-white/5 hover:border-white/15 text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            <span>{lvl}</span>
                                            {defaultLevel === lvl && <Check className="w-3.5 h-3.5 text-blue-400" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Interface Language</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {(['English', 'Hindi', 'Telugu'] as Language[]).map(lang => {
                                        const isActive = globalLanguage === lang;
                                        return (
                                            <button
                                                key={lang}
                                                onClick={() => onLanguageChange(lang)}
                                                className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${isActive
                                                    ? 'border-blue-500/50 bg-blue-600/10 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                                    : 'border-white/5 bg-[#0b1121] text-slate-400 hover:text-white hover:border-white/15'
                                                    }`}
                                            >
                                                <span>{lang}</span>
                                                {isActive ? (
                                                    <Check className="w-4 h-4 text-blue-400" />
                                                ) : (
                                                    <Globe className="w-4 h-4 text-slate-500/50" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-brand-muted mt-3">Select your preferred language for the entire platform.</p>
                            </div>

                            <div className="flex items-center justify-end pt-4 border-t border-white/5">
                                <SaveButton saved={saved} onClick={handleSave} />
                            </div>
                        </div>
                    )}

                    {/* ─ Notifications ─ */}
                    {activeSection === 'notifications' && (
                        <div className="space-y-6">
                            <SectionHeader title="Notifications" desc="Choose what you want to be notified about." />

                            <div className="space-y-3">
                                <Toggle label="Daily Streak Reminders" desc="Remind me to maintain my study streak" value={notifications.streaks} onChange={v => setNotifications(p => ({ ...p, streaks: v }))} />
                                <Toggle label="Learning Tips" desc="Receive helpful study tips and tricks" value={notifications.tips} onChange={v => setNotifications(p => ({ ...p, tips: v }))} />
                                <Toggle label="Product Updates" desc="Be notified about new features and improvements" value={notifications.updates} onChange={v => setNotifications(p => ({ ...p, updates: v }))} />
                                <Toggle
                                    label="UI Sounds"
                                    desc="Play sound effects for interactions"
                                    value={sounds}
                                    onChange={setSounds}
                                    Icon={sounds ? Volume2 : VolumeX}
                                />
                            </div>

                            <div className="flex items-center justify-end pt-4 border-t border-white/5">
                                <SaveButton saved={saved} onClick={handleSave} />
                            </div>
                        </div>
                    )}

                    {/* ─ Privacy ─ */}
                    {activeSection === 'privacy' && (
                        <div className="space-y-6">
                            <SectionHeader title="Privacy & Security" desc="Manage data and session settings." />

                            <div className="space-y-3">
                                <InfoRow icon={Shield} label="Data Storage" value="Local only — your data never leaves your device" />
                                <InfoRow icon={Globe} label="Account Type" value="Local account — no cloud sync" />
                                <InfoRow icon={Zap} label="Session" value="Persisted in browser localStorage" />
                            </div>

                            <div className="p-4 bg-red-900/10 border border-red-500/15 rounded-xl space-y-3">
                                <p className="text-sm font-semibold text-red-400">Danger Zone</p>
                                <button
                                    onClick={() => { localStorage.clear(); window.location.reload(); }}
                                    className="px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-semibold transition-colors"
                                >
                                    Clear All Local Data & Reset
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Sub-components ─────────────────────────────────────────────

const SectionHeader = ({ title, desc }: { title: string; desc: string }) => (
    <div className="border-b border-white/5 pb-4">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
);

const Field = ({ label, value, placeholder, type }: { label: string; value?: string; placeholder?: string; type?: string }) => (
    <div>
        <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">{label}</label>
        <input
            type={type ?? 'text'}
            defaultValue={value}
            placeholder={placeholder}
            className="w-full bg-[#0b1121] border border-white/8 hover:border-blue-500/30 focus:border-blue-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
        />
    </div>
);

const Toggle = ({ label, desc, value, onChange, Icon }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void; Icon?: any }) => (
    <div className="flex items-center justify-between py-3 px-4 bg-[#0b1121] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
        <div className="flex items-center space-x-3">
            {Icon && <Icon className="w-4 h-4 text-slate-400" />}
            <div>
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
            </div>
        </div>
        <button
            onClick={() => onChange(!value)}
            className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-white/10'}`}
        >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-6' : 'left-1'}`} />
        </button>
    </div>
);

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-start space-x-3 py-3 px-4 bg-[#0b1121] rounded-xl border border-white/5">
        <Icon className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
            <p className="text-sm text-white mt-0.5">{value}</p>
        </div>
    </div>
);

const SaveButton = ({ saved, onClick }: { saved: boolean; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${saved
            ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            }`}
    >
        {saved ? <><Check className="w-3.5 h-3.5" /><span>Saved!</span></> : <span>Save Changes</span>}
    </button>
);
