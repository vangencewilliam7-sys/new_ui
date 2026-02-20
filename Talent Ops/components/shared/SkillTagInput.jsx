import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const SkillTagInput = ({ selectedSkills = [], onChange, placeholder = "Add skills..." }) => {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [availableSkills, setAvailableSkills] = useState([]);
    const wrapperRef = useRef(null);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setSuggestions([]);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fetch skills from DB on mount
    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const { data, error } = await supabase
                    .from('skills_master')
                    .select('skill_name')
                    .order('skill_name');

                if (data) {
                    setAvailableSkills(data.map(s => s.skill_name));
                }
            } catch (err) {
                console.error('Error fetching skills for input:', err);
            }
        };

        fetchSkills();
    }, []);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        if (val.trim()) {
            const filtered = availableSkills.filter(s =>
                s.toLowerCase().includes(val.toLowerCase()) &&
                !selectedSkills.includes(s)
            );
            setSuggestions(filtered);
        } else {
            // If empty (and focused?), maybe show all? 
            // For now, let's show all available if clicked? 
            // User requested "Drop Down". Let's show all if empty input but focused?
            // Standard behavior: show matches.
            setSuggestions([]);
        }
    };

    const handleFocus = () => {
        // Show all options (dropdown behavior) when focused if input is empty
        if (!inputValue.trim()) {
            const filtered = availableSkills.filter(s => !selectedSkills.includes(s));
            setSuggestions(filtered);
        }
    };

    const handleContainerClick = () => {
        const input = document.getElementById('skill-input');
        input?.focus();

        // Show remaining options if input is empty
        if (!inputValue.trim()) {
            const remaining = availableSkills.filter(s => !selectedSkills.includes(s));
            setSuggestions(remaining);
        }
    };

    const addSkill = (skill) => {
        if (!skill.trim()) return;

        const newSelected = [...selectedSkills, skill];
        if (!selectedSkills.includes(skill)) {
            onChange(newSelected);
        }
        setInputValue('');

        // Optimize Flow: Keep dropdown open with remaining choices
        // This lets users rapid-fire select multiple tags
        const remaining = availableSkills.filter(s => !newSelected.includes(s));
        setSuggestions(remaining);

        // Ensure focus stays on input
        document.getElementById('skill-input')?.focus();
    };

    const removeSkill = (skillToRemove) => {
        onChange(selectedSkills.filter(s => s !== skillToRemove));
    };

    return (
        <div style={{ position: 'relative' }} ref={wrapperRef}>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: 'white',
                minHeight: '44px',
                cursor: 'text'
            }} onClick={handleContainerClick}>
                {selectedSkills.map(skill => (
                    <span key={skill} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        backgroundColor: '#eff6ff', color: '#3b82f6',
                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500
                    }}>
                        {skill}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#3b82f6', display: 'flex' }}
                        >
                            <X size={14} />
                        </button>
                    </span>
                ))}

                <input
                    id="skill-input"
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (suggestions.length > 0) {
                                addSkill(suggestions[0]);
                            }
                        }
                        if (e.key === 'Backspace' && !inputValue && selectedSkills.length > 0) {
                            removeSkill(selectedSkills[selectedSkills.length - 1]);
                        }
                    }}
                    placeholder={selectedSkills.length === 0 ? placeholder : ""}
                    style={{
                        border: 'none',
                        outline: 'none',
                        flex: 1,
                        minWidth: '100px',
                        fontSize: '0.9rem'
                    }}
                    autoComplete="off"
                />
            </div>

            {suggestions.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    backgroundColor: 'white', border: '1px solid #e2e8f0',
                    borderRadius: '8px', marginTop: '4px', zIndex: 100,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto'
                }}>
                    {suggestions.map(s => (
                        <div
                            key={s}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                addSkill(s);
                            }}
                            style={{
                                padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem',
                                transition: 'background 0.1s',
                                borderBottom: '1px solid #f1f5f9'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                        >
                            {s}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SkillTagInput;
