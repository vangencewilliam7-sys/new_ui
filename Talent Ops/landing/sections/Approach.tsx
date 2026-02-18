import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const steps = [
    {
        number: '01',
        title: 'Understand',
        description: 'We analyze your current workflows, identify gaps, and clarify your goals. Through deep research and discovery, we define the strategic direction.',
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800',
        tags: ['Research', 'Audit', 'Strategic Discovery']
    },
    {
        number: '02',
        title: 'Design',
        description: 'We architect custom systems aligned with your team size, industry, and growth plan. Building the blueprint for scalable operations.',
        image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&q=80&w=800',
        tags: ['Architecture', 'Workflow Design', 'Planning']
    },
    {
        number: '03',
        title: 'Build',
        description: 'We implement tools, templates, and operational frameworks your team will use daily. Transforming blueprints into functional ecosystems.',
        image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=800',
        tags: ['Implementation', 'Stack Setup', 'Automation']
    },
    {
        number: '04',
        title: 'Train',
        description: 'We enable managers and teams to adopt and execute the system confidently. Ensuring long-term cultural and operational adoption.',
        image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=800',
        tags: ['Enablement', 'Workshops', 'Adoption']
    },
    {
        number: '05',
        title: 'Improve',
        description: 'We measure results and continuously refine systems as your organization evolves. Ensuring your platform grows with your business.',
        image: 'https://images.unsplash.com/photo-1551288049-bbda38a10ad5?auto=format&fit=crop&q=80&w=800',
        tags: ['Optimization', 'Analysis', 'Scaling']
    }
];

export default function Approach() {
    const [activeIndex, setActiveIndex] = useState(0);

    return (
        <section id="approach" className="py-32 px-6 lg:px-12 bg-[#F8F7F4] relative overflow-hidden">
            <div className="max-w-[1400px] mx-auto">
                {/* Section Header */}
                <div className="text-center mb-24">
                    <h2 className="text-[42px] md:text-[48px] lg:text-[52px] mb-6 text-[#1f2937] font-heading font-semibold tracking-tight leading-[1.15]">
                        How We Work With You
                    </h2>
                    <p className="text-[18px] text-[rgba(31,41,55,0.85)] font-serif leading-[1.7] max-w-[640px] mx-auto">
                        A frictionless, interactive process designed to bring intelligence to your operations.
                    </p>
                </div>

                {/* Horizontal Process Flow - Instant & Smooth */}
                <div className="hidden lg:flex w-full gap-4 bg-white p-12 rounded-[32px] border border-[#dadada] min-h-[640px]">
                    {steps.map((step, index) => {
                        const isActive = activeIndex === index;
                        return (
                            <motion.div
                                key={index}
                                className="relative h-full flex cursor-pointer overflow-hidden rounded-2xl"
                                initial={false}
                                animate={{
                                    flex: isActive ? 6 : 1,
                                    backgroundColor: isActive ? '#fbfcfe' : 'transparent',
                                }}
                                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                            >
                                {/* Global Hit-Area - bg-white/0 ensures reliable mouse detection */}
                                <div
                                    className="absolute inset-0 z-30 bg-white/0"
                                    onMouseEnter={() => setActiveIndex(index)}
                                />

                                {/* Visual Separator */}
                                {index > 0 && (
                                    <div className="absolute left-0 top-10 bottom-10 w-[1px] bg-[#dadada]/50 z-0" />
                                )}

                                <div className="flex flex-col h-full w-full p-8 relative z-10 pointer-events-none">
                                    {/* Step Number */}
                                    <span className={`text-4xl font-heading font-black mb-6 transition-colors duration-300 ${isActive ? 'text-[#3b82f6]/20' : 'text-[#e2e8f0]'}`}>
                                        {step.number}
                                    </span>

                                    {/* Headline - No Flips/Rotations */}
                                    <h3 className={`font-heading font-bold transition-all duration-300 mb-6 whitespace-nowrap ${isActive ? 'text-3xl text-ink' : 'text-lg text-ink/30'
                                        }`}>
                                        {step.title}
                                    </h3>

                                    {/* Revealed Content Container */}
                                    <div className="relative flex-grow flex flex-col justify-between">
                                        <AnimatePresence mode="wait">
                                            {isActive && (
                                                <motion.div
                                                    key={`content-${index}`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="flex flex-col h-full"
                                                >
                                                    {/* Left Accent Bar */}
                                                    <div className="absolute -left-8 top-0 bottom-0 w-1.5 bg-[#3b82f6] rounded-full" />

                                                    <p className="text-lg text-[rgba(31,41,55,0.85)] font-serif leading-relaxed mb-8 max-w-2xl">
                                                        {step.description}
                                                    </p>

                                                    <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-8 shadow-xl border border-[#dadada]/30">
                                                        <img
                                                            src={step.image}
                                                            alt={step.title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>

                                                    {/* Descriptive Tags */}
                                                    <div className="flex items-center gap-3">
                                                        {step.tags.map((tag, idx) => (
                                                            <React.Fragment key={idx}>
                                                                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink/40">
                                                                    {tag}
                                                                </span>
                                                                {idx < step.tags.length - 1 && <span className="text-ink/10">•</span>}
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Vertical List for Mobile/Tablet */}
                <div className="lg:hidden flex flex-col gap-4">
                    {steps.map((step, index) => (
                        <div
                            key={index}
                            onClick={() => setActiveIndex(index)}
                            className={`bg-white rounded-2xl border border-[#dadada] overflow-hidden transition-all duration-300 ${activeIndex === index ? 'ring-2 ring-[#3b82f6]/10 shadow-lg' : ''
                                }`}
                        >
                            <div className="p-6">
                                <div className="flex items-center gap-4">
                                    <span className="text-xl font-black text-[#e2e8f0]">{step.number}</span>
                                    <h3 className="text-xl font-heading font-bold text-ink">{step.title}</h3>
                                </div>

                                <AnimatePresence>
                                    {activeIndex === index && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <p className="text-[#1f2937]/70 font-serif leading-relaxed mb-6 pt-6">
                                                {step.description}
                                            </p>
                                            <div className="rounded-xl overflow-hidden mb-4 border border-[#dadada]/50">
                                                <img src={step.image} alt={step.title} className="w-full h-[200px] object-cover" />
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-4 border-t border-[#dadada]/30">
                                                {step.tags.map((tag, idx) => (
                                                    <span key={idx} className="text-[10px] font-bold uppercase tracking-widest text-ink/30">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
