import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Trash2, Plus, StickyNote, Pencil, Check, X, CheckCircle, Circle } from 'lucide-react';

const NotesTile = () => {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editText, setEditText] = useState('');

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (data) setNotes(data);
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoading(false);
        }
    };

    const addNote = async (e) => {
        e.preventDefault();
        if (!newNote.trim()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notes')
                .insert({
                    user_id: user.id,
                    content: newNote.trim(),
                    is_completed: false
                })
                .select()
                .single();

            if (data) {
                setNotes([data, ...notes]);
                setNewNote('');
            }
        } catch (error) {
            console.error('Error adding note:', error);
        }
    };

    const deleteNote = async (id) => {
        try {
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', id);

            if (!error) {
                setNotes(notes.filter(n => n.id !== id));
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const updateNote = async (id, updates) => {
        try {
            const { data, error } = await supabase
                .from('notes')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (data) {
                setNotes(notes.map(n => n.id === id ? data : n));
            }
        } catch (error) {
            console.error('Error updating note:', error);
        }
    };

    const toggleComplete = (note) => {
        updateNote(note.id, { is_completed: !note.is_completed });
    };

    const startEditing = (note) => {
        setEditingNoteId(note.id);
        setEditText(note.content);
    };

    const cancelEditing = () => {
        setEditingNoteId(null);
        setEditText('');
    };

    const saveEdit = async () => {
        if (!editText.trim()) return;
        await updateNote(editingNoteId, { content: editText.trim() });
        setEditingNoteId(null);
        setEditText('');
    };

    return (
        <div style={{
            backgroundColor: '#f3e8ff', // Light purple
            borderRadius: '24px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            height: '300px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <StickyNote size={20} /> My Notes
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#9333ea', fontWeight: 600 }}>{notes.length}</span>
            </div>

            {/* Notes List */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }} className="custom-scrollbar">
                {loading ? (
                    <p style={{ color: '#a855f7', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>Loading...</p>
                ) : notes.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                        <StickyNote size={32} color="#ba68c8" />
                        <p style={{ color: '#ba68c8', fontSize: '0.9rem', marginTop: '8px' }}>No notes yet</p>
                    </div>
                ) : (
                    notes.map(note => (
                        <div key={note.id} style={{
                            backgroundColor: note.is_completed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            fontSize: '0.9rem',
                            color: note.is_completed ? '#9ca3af' : '#4c1d95',
                            display: 'flex',
                            alignItems: 'start',
                            gap: '8px',
                            transition: 'all 0.2s',
                            border: note.is_completed ? '1px solid transparent' : '1px solid rgba(139, 92, 246, 0.1)'
                        }}>
                            {/* Checkbox */}
                            <button
                                onClick={() => toggleComplete(note)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    marginTop: '2px',
                                    color: note.is_completed ? '#a855f7' : '#d8b4fe',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                {note.is_completed ? <CheckCircle size={16} /> : <Circle size={16} />}
                            </button>

                            {/* Content or Edit Input */}
                            <div style={{ flex: 1 }}>
                                {editingNoteId === note.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <input
                                            type="text"
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            autoFocus
                                            style={{
                                                width: '100%',
                                                padding: '6px 8px',
                                                borderRadius: '8px',
                                                border: '1px solid #c084fc',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                backgroundColor: '#fff'
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEdit();
                                                if (e.key === 'Escape') cancelEditing();
                                            }}
                                        />
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button onClick={saveEdit} style={{ background: '#9333ea', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Check size={12} /> Save
                                            </button>
                                            <button onClick={cancelEditing} style={{ background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <X size={12} /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <span style={{
                                        wordBreak: 'break-word',
                                        lineHeight: '1.4',
                                        textDecoration: note.is_completed ? 'line-through' : 'none',
                                        display: 'block',
                                        paddingTop: '1px'
                                    }}>
                                        {note.content}
                                    </span>
                                )}
                            </div>

                            {/* Actions (Edit/Delete) */}
                            {editingNoteId !== note.id && (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {!note.is_completed && (
                                        <button
                                            onClick={() => startEditing(note)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c084fc', padding: '2px' }}
                                            className="action-btn"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteNote(note.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c084fc', padding: '2px' }}
                                        className="action-btn delete-btn"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Add Note Input */}
            <form onSubmit={addNote} style={{ display: 'flex', gap: '8px' }}>
                <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: '1px solid rgba(147, 51, 234, 0.2)',
                        backgroundColor: 'rgba(255,255,255,0.8)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        color: '#581c87'
                    }}
                />
                <button
                    type="submit"
                    disabled={!newNote.trim()}
                    style={{
                        backgroundColor: '#9333ea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: newNote.trim() ? 'pointer' : 'default',
                        opacity: newNote.trim() ? 1 : 0.6,
                        transition: 'opacity 0.2s'
                    }}
                >
                    <Plus size={20} />
                </button>
            </form>
            <style>
                {`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: rgba(147, 51, 234, 0.05);
                        border-radius: 3px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(147, 51, 234, 0.2);
                        border-radius: 3px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: rgba(147, 51, 234, 0.4);
                    }
                    .action-btn:hover {
                        color: #9333ea !important;
                    }
                    .delete-btn:hover {
                        color: #ef4444 !important;
                    }
                `}
            </style>
        </div>
    );
};

export default NotesTile;
