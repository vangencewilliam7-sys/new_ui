import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const points = [
    {
        text: "Designed specifically for ",
        highlight: "small and mid-sized companies",
        after: " where efficiency and speed are critical."
    },
    {
        text: "Reduces cognitive load by ",
        highlight: "consolidating information, workflows, and decision signals",
        after: " into one system."
    },
    {
        text: "Enables a ",
        highlight: "single individual to manage responsibilities",
        after: " that traditionally required multiple roles."
    },
    {
        text: "Helps teams operate with ",
        highlight: "greater clarity, accountability, and control",
        after: " as complexity increases."
    }
];

export default function Foundations() {
    const navigate = useNavigate();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    return (
        <section id="foundations" className="py-20 px-6 lg:px-12 bg-white relative overflow-hidden">
            <div className="max-w-4xl mx-auto relative z-10 text-center">
                <div className="mb-14">
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        className="text-[32px] md:text-[40px] lg:text-[46px] text-[#1f2937] font-heading font-semibold tracking-tight leading-[1.2]"
                    >
                        Foundations for Efficient Growth
                    </motion.h2>
                </div>

                <div
                    className="relative flex flex-col gap-10 text-left mb-16 pl-4 md:pl-0"
                >
                    {/* Timeline Line Rail */}
                    <div className="absolute left-[40px] md:left-[24px] top-6 bottom-6 w-[2px] bg-[#3b82f6]/10">
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{
                                height: hoveredIndex !== null
                                    ? `${(hoveredIndex / (points.length - 1)) * 100}%`
                                    : "0%"
                            }}
                            className="absolute top-0 left-0 w-full bg-[#3b82f6] shadow-[0_0_12px_rgba(59,130,246,0.5)] origin-top"
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        />
                    </div>

                    {points.map((point, index) => (
                        <motion.div
                            key={index}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.5 }}
                            transition={{ delay: index * 0.1, duration: 0.8 }}
                            className="flex items-start gap-8 group relative z-10 cursor-default"
                        >
                            <motion.div
                                animate={hoveredIndex === index ? "hover" : "initial"}
                                variants={{
                                    initial: {
                                        scale: 1,
                                        backgroundColor: '#ffffff',
                                        color: 'rgba(31, 41, 55, 0.2)',
                                        borderColor: 'rgba(218, 218, 218, 0.5)',
                                        boxShadow: '0 0 0 rgba(59, 130, 246, 0)'
                                    },
                                    hover: {
                                        scale: 1.15,
                                        backgroundColor: '#3b82f6',
                                        color: '#ffffff',
                                        borderColor: '#3b82f6',
                                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)'
                                    }
                                } as any}
                                transition={{ duration: 0.3 }}
                                className="mt-1 w-12 h-12 rounded-full border-2 flex items-center justify-center shrink-0 text-xl font-heading font-black transition-all relative bg-white"
                            >
                                {index + 1}
                            </motion.div>
                            <p className="text-[18px] md:text-[20px] text-[#1f2937]/80 font-serif leading-[1.6] pt-1.5 transition-colors duration-300 group-hover:text-[#1f2937]">
                                {point.text}
                                <span className="text-[#1f2937] font-semibold">
                                    {point.highlight}
                                </span>
                                {point.after}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Pulsing CTA Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                    className="flex justify-center"
                >
                    <motion.button
                        onClick={() => navigate('/request-demo')}
                        animate={{
                            boxShadow: [
                                "0 0 0 0px rgba(59, 130, 246, 0.4)",
                                "0 0 0 15px rgba(59, 130, 246, 0)",
                                "0 0 0 0px rgba(59, 130, 246, 0)"
                            ]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-10 py-4 bg-[#1f2937] text-white text-lg font-bold rounded-xl shadow-lg hover:bg-[#3b82f6] transition-colors duration-300"
                    >
                        Get Started
                    </motion.button>
                </motion.div>
            </div>
        </section>
    );
}
