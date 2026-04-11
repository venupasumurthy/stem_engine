import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, addDoc, onSnapshot, deleteDoc, doc, query, where, orderBy
} from 'firebase/firestore';
import { Play, Plus, Trash2, Youtube, BookOpen, Loader } from 'lucide-react';

interface VideoItem {
    id: string;
    title: string;
    url: string;
    subject: string;
    description?: string;
    community_id?: string;
    createdAt?: string;
}

interface YouTubeVideosProps {
    role: 'teacher' | 'student';
    communityId?: string;
}

function getYouTubeId(url: string): string | null {
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^\s&]+)/,
        /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^\s?]+)/,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^\s?]+)/,
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

export const YouTubeVideos: React.FC<YouTubeVideosProps> = ({ role, communityId }) => {
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
    const [filter, setFilter] = useState('All');
    const [error, setError] = useState('');

    // Teacher form
    const [showForm, setShowForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newSubject, setNewSubject] = useState('Physics');
    const [newDesc, setNewDesc] = useState('');
    const [saving, setSaving] = useState(false);

    const subjects = ['All', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'General'];

    useEffect(() => {
        // Query: community videos + universal videos (no community_id)
        const videosRef = collection(db, 'youtube_videos');
        let q;
        if (communityId) {
            // Show both universal videos and this community's videos
            q = query(videosRef, orderBy('createdAt', 'desc'));
        } else {
            q = query(videosRef, orderBy('createdAt', 'desc'));
        }

        const unsub = onSnapshot(q, snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as VideoItem));
            // Filter: show universal (no community) + this community's
            const filtered = docs.filter(v =>
                !v.community_id || v.community_id === communityId
            );
            setVideos(filtered);
            setLoading(false);
        }, err => {
            console.error('Videos error:', err);
            setLoading(false);
        });
        return () => unsub();
    }, [communityId]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!newTitle.trim() || !newUrl.trim()) { setError('Title and URL are required.'); return; }
        if (!getYouTubeId(newUrl)) { setError('Invalid YouTube URL. Use a standard youtube.com or youtu.be link.'); return; }
        setSaving(true);
        try {
            await addDoc(collection(db, 'youtube_videos'), {
                title: newTitle.trim(),
                url: newUrl.trim(),
                subject: newSubject,
                description: newDesc.trim(),
                community_id: communityId || null,
                createdAt: new Date().toISOString(),
            });
            setNewTitle(''); setNewUrl(''); setNewDesc(''); setNewSubject('Physics');
            setShowForm(false);
        } catch (e: any) {
            setError('Failed to add video: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Remove this video?')) return;
        await deleteDoc(doc(db, 'youtube_videos', id));
        if (activeVideo?.id === id) setActiveVideo(null);
    };

    const filtered = filter === 'All' ? videos : videos.filter(v => v.subject === filter);
    const subjectColors: Record<string, string> = {
        Physics: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        Chemistry: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        Mathematics: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        Biology: 'text-green-400 bg-green-500/10 border-green-500/20',
        General: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                        <Youtube className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Video Library</h2>
                        <p className="text-slate-500 text-xs">{filtered.length} videos · {communityId ? 'Class library' : 'Universal'}</p>
                    </div>
                </div>
                {role === 'teacher' ? (
                    <button onClick={() => setShowForm(v => !v)}
                        className="flex items-center space-x-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                        <Plus className="w-4 h-4" /><span>Add Video</span>
                    </button>
                ) : (
                    <div className="flex items-center space-x-2 bg-slate-700/30 border border-slate-600/20 px-3 py-1.5 rounded-lg">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-400 text-xs">View only</span>
                    </div>
                )}
            </div>

            {/* Teacher Add Form */}
            {showForm && role === 'teacher' && (
                <form onSubmit={handleAdd} className="bg-[#0f172a] border border-red-500/10 rounded-2xl p-5 mb-6 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <h3 className="text-white font-semibold text-sm">Add YouTube Video</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1">Title</label>
                            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Video title"
                                className="w-full bg-[#0b1121] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none border border-white/5 focus:border-red-500/40 placeholder-slate-600 transition-all" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1">Subject</label>
                            <select value={newSubject} onChange={e => setNewSubject(e.target.value)}
                                className="w-full bg-[#0b1121] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none border border-white/5 focus:border-red-500/40 transition-all">
                                {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'General'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1">YouTube URL</label>
                        <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..."
                            className="w-full bg-[#0b1121] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none border border-white/5 focus:border-red-500/40 placeholder-slate-600 transition-all" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1">Description (optional)</label>
                        <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description..." rows={2}
                            className="w-full bg-[#0b1121] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none border border-white/5 focus:border-red-500/40 placeholder-slate-600 resize-none transition-all" />
                    </div>
                    {error && <p className="text-red-400 text-xs">{error}</p>}
                    <div className="flex gap-3">
                        <button type="submit" disabled={saving}
                            className="flex items-center space-x-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            <span>{saving ? 'Adding...' : 'Add Video'}</span>
                        </button>
                        <button type="button" onClick={() => { setShowForm(false); setError(''); }}
                            className="px-5 py-2 rounded-xl text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all">Cancel</button>
                    </div>
                </form>
            )}

            {/* Subject Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
                {subjects.map(s => (
                    <button key={s} onClick={() => setFilter(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === s ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-white bg-white/5'}`}>
                        {s}
                    </button>
                ))}
            </div>

            {/* Active Video Player Cinema Mode */}
            {activeVideo && (
                <div className="mb-10 w-full bg-[#0b1121] rounded-[2rem] overflow-hidden border border-white/10 animate-in zoom-in-95 duration-700 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative group/player mx-auto max-w-[1400px]">
                    <div className="relative w-full overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                            src={`https://www.youtube.com/embed/${getYouTubeId(activeVideo.url)}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&vq=hd1080&origin=${window.location.origin}`}
                            className="absolute top-0 left-0 w-full h-full border-0 select-none shadow-2xl"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            title={activeVideo.title}
                        />
                    </div>
                    <div className="p-8 flex flex-col md:flex-row items-center md:items-start justify-between bg-gradient-to-b from-[#0f172a]/50 to-[#0b1121] border-t border-white/5 gap-6">
                        <div className="space-y-3 text-center md:text-left">
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                <span className={`text-[10px] font-black px-3.5 py-1.5 rounded-full border tracking-tighter shadow-sm ${subjectColors[activeVideo.subject] || 'text-slate-400 bg-slate-700/50 border-slate-600/30'}`}>
                                    {activeVideo.subject.toUpperCase()}
                                </span>
                                <span className="flex items-center space-x-2 px-3.5 py-1.5 bg-red-600/10 rounded-full border border-red-500/20">
                                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_5px_rgba(220,38,38,0.5)]" />
                                    <span className="text-red-500 text-[10px] font-black tracking-[0.2em] uppercase">Cinema Mode</span>
                                </span>
                            </div>
                            <h3 className="text-white font-black text-2xl md:text-4xl tracking-tighter leading-none">{activeVideo.title}</h3>
                            {activeVideo.description && <p className="text-slate-400 text-sm md:text-lg leading-relaxed max-w-4xl opacity-70 font-medium">{activeVideo.description}</p>}
                        </div>
                        <button onClick={() => setActiveVideo(null)}
                            className="bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white px-8 py-3.5 rounded-2xl text-xs font-black flex items-center space-x-3 transition-all shadow-xl backdrop-blur-3xl border border-white/10 group active:scale-95 shrink-0 uppercase tracking-widest">
                            <span className="group-hover:rotate-90 transition-transform duration-300">✕</span>
                            <span>Close Player</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Video Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <Loader className="w-6 h-6 text-slate-500 animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                    <Youtube className="w-10 h-10 text-slate-600 mb-3" />
                    <p className="text-slate-400 font-semibold">No videos yet</p>
                    <p className="text-slate-600 text-sm">
                        {role === 'teacher' ? 'Click "Add Video" to share a YouTube video with your class.' : "Your teacher hasn't added any videos yet."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(video => {
                        const vidId = getYouTubeId(video.url);
                        const thumb = vidId ? `https://img.youtube.com/vi/${vidId}/mqdefault.jpg` : null;
                        const isActive = activeVideo?.id === video.id;
                        return (
                            <div key={video.id}
                                className={`bg-[#0f172a] rounded-2xl overflow-hidden border transition-all cursor-pointer group ${isActive ? 'border-red-500/40 shadow-lg shadow-red-500/10' : 'border-white/5 hover:border-white/15'}`}
                                onClick={() => setActiveVideo(video)}>
                                <div className="relative aspect-video bg-[#0b1121]">
                                    {thumb && <img src={thumb} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-red-600' : 'bg-black/60 group-hover:bg-red-600/80'}`}>
                                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                        </div>
                                    </div>
                                    <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${subjectColors[video.subject] || 'text-slate-400 bg-slate-700/50 border-slate-600/30'}`}>
                                        {video.subject}
                                    </span>
                                </div>
                                <div className="p-3">
                                    <h4 className="text-white text-sm font-semibold line-clamp-2 group-hover:text-blue-300 transition-colors">{video.title}</h4>
                                    {video.description && <p className="text-slate-500 text-xs mt-1 line-clamp-1">{video.description}</p>}
                                    {role === 'teacher' && (
                                        <button onClick={e => { e.stopPropagation(); handleDelete(video.id); }}
                                            className="mt-2 flex items-center space-x-1 text-red-400/60 hover:text-red-400 text-[11px] transition-colors">
                                            <Trash2 className="w-3 h-3" /><span>Remove</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
