import React, { useState } from 'react';
import { X, Plus, Tag } from 'lucide-react';

const PREDEFINED_SKILLS = [
    'Frontend', 'Backend', 'Workflows', 'Databases',
    'Prompting', 'Non-popular LLMs', 'Fine-tuning',
    'Data Labelling', 'Content Generation',
    'React', 'Node.js', 'Python', 'SQL', 'TypeScript'
];

const SkillTagInput = ({ selectedSkills = [], onChange, placeholder = "Add skills..." }) => {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        if (val.trim()) {
            const filtered = PREDEFINED_SKILLS.filter(s =>
                s.toLowerCase().includes(val.toLowerCase()) &&
                !selectedSkills.includes(s)
            );
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    };

    const addSkill = (skill) => {
        if (!skill.trim()) return;
        if (!selectedSkills.includes(skill)) {
            onChange([...selectedSkills, skill]);
        }
        setInputValue('');
        setSuggestions([]);
    };

    const removeSkill = (skillToRemove) => {
        onChange(selectedSkills.filter(s => s !== skillToRemove));
    };

    return (
        <div style={{ position: 'relative' }}>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: 'white',
                minHeight: '44px'
            }}>
                {selectedSkills.map(skill => (
                    <span key={skill} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        backgroundColor: '#eff6ff', color: '#3b82f6',
                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500
                    }}>
                        {skill}
                        <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#3b82f6', display: 'flex' }}
                        >
                            <X size={14} />
                        </button>
                    </span>
                ))}

                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addSkill(inputValue);
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
                />
            </div>

            {suggestions.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    backgroundColor: 'white', border: '1px solid #e2e8f0',
                    borderRadius: '8px', marginTop: '4px', zIndex: 10,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto'
                }}>
                    {suggestions.map(s => (
                        <div
                            key={s}
                            onClick={() => addSkill(s)}
                            style={{
                                padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem',
                                transition: 'background 0.1s'
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
