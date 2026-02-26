import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const steps = [
    {
        number: '01',
        title: 'Integrate Workforce Data',
        description: 'Connect HR systems, performance tools, and operational data sources.',
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800',
    },
    {
        number: '02',
        title: 'Map Roles and Responsibilities',
        description: 'Build a clear structural model of teams and ownership.',
        image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800',
    },
    {
        number: '03',
        title: 'Monitor Capacity & Performance',
        description: 'Track workload distribution, productivity, and engagement in real time.',
        image: '/images/monitor capacity.webp',
    },
    {
        number: '04',
        title: 'Detect Risks and Gaps',
        description: 'Identify attrition risks, skill shortages, and execution bottlenecks early.',
        image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=800',
    },
    {
        number: '05',
        title: 'Plan and Act with Confidence',
        description: 'Make hiring, restructuring, and investment decisions backed by evidence.',
        image: '/images/plan and act with confidence.webp',
    }
];

export default function Approach() {
    const [activeIndex, setActiveIndex] = useState(0);

    return (
        <section id="approach" className="lg:h-screen py-12 lg:pt-24 lg:pb-12 px-6 lg:px-12 bg-[#F8F7F4] relative overflow-hidden flex flex-col justify-center">
            <div className="max-w-[1400px] mx-auto w-full">
                <div className="text-center mb-2 lg:mb-2">
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        className="text-[28px] md:text-[34px] lg:text-[40px] mb-2 text-[#1f2937] font-heading font-semibold tracking-tight leading-[1.15] max-w-[800px] mx-auto"
                    >
                        How TalentOps Powers Smarter Workforce Decisions
                    </motion.h2>
                    <p className="text-[16px] lg:text-[18px] text-[rgba(31,41,55,0.85)] font-serif leading-[1.7] max-w-[640px] mx-auto">
                        From Fragmented Data to Actionable Insight
                    </p>
                </div>

                {/* Compact Process Flow - Desktop */}
                <div className="hidden lg:grid grid-cols-12 gap-12 items-start h-[550px]">
                    {/* Left Column: Titles List */}
                    <div className="col-span-6 flex flex-col justify-center h-full space-y-1">
                        {steps.map((step, index) => {
                            const isActive = activeIndex === index;
                            return (
                                <div
                                    key={index}
                                    className={`relative cursor-pointer transition-all duration-300 py-3 px-6 rounded-2xl ${isActive ? 'bg-[#3b82f6]/5' : 'hover:bg-black/5'
                                        }`}
                                    onMouseEnter={() => setActiveIndex(index)}
                                >
                                    <div className="flex items-center gap-6">
                                        <span className={`text-lg font-heading font-black transition-all duration-300 w-8 ${isActive ? 'text-[#3b82f6]' : 'text-[#e2e8f0]'}`}>
                                            {step.number}
                                        </span>
                                        <h3 className={`font-heading font-bold transition-all duration-300 ${isActive ? 'text-2xl text-ink' : 'text-lg text-ink/40'
                                            }`}>
                                            {step.title}
                                        </h3>
                                    </div>
                                    {isActive && (
                                        <motion.div
                                            layoutId="activePointer"
                                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#3b82f6] rounded-full"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Right Column: Dynamic Preview Panel */}
                    <div className="col-span-6 h-full relative pl-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeIndex}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                className="h-full flex flex-col justify-center"
                            >
                                <div className="relative aspect-[16/10] max-w-[500px] rounded-2xl overflow-hidden shadow-xl border border-[#dadada]/30 mb-6 bg-white">
                                    <img
                                        src={steps[activeIndex].image}
                                        alt={steps[activeIndex].title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                </div>

                                <div className="max-w-lg relative bg-white/40 backdrop-blur-sm border-l-4 border-[#3b82f6] p-5 rounded-r-2xl shadow-sm">
                                    <p className="text-[17px] text-[#1f2937] font-serif font-bold leading-relaxed">
                                        {steps[activeIndex].description}
                                    </p>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
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
