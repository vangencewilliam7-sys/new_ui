import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, GraduationCap, Rocket, Globe2 } from 'lucide-react';

const industries = [
    {
        icon: Building2,
        title: 'Scaling Companies',
        description: 'Growing Organizations: Companies expanding headcount and operations use TalentOps to maintain clarity in roles, capacity, and performance as complexity increases.'
    },
    {
        icon: Globe2,
        title: 'Distributed Teams',
        description: 'Remote & Multi-Location Enterprises: Organizations operating across locations rely on TalentOps for consistent visibility into team activity, workload, and outcomes.'
    },
    {
        icon: Building2,
        title: 'Professional & Knowledge-Driven Firms',
        description: 'Service and Expertise-Based Businesses: Firms where people are the primary asset use the platform to manage productivity, utilization, and delivery effectiveness.'
    },
    {
        icon: Rocket,
        title: 'High-Growth Startups & Scale-Ups',
        description: 'Organizations Transitioning to Structured Operations: Companies moving from informal processes to structured management use TalentOps to establish accountability and operational discipline.'
    }
];

export default function Industries() {
    return (
        <section id="industries" className="py-20 px-6 lg:px-12 bg-[#F8F7F4] relative overflow-hidden">
            {/* Background Decorative Element */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none opacity-[0.03]">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:40px_40px]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        className="text-[32px] md:text-[38px] lg:text-[42px] mb-6 text-[#1f2937] font-heading font-semibold tracking-tight leading-[1.15]"
                    >
                        Designed for Organizations That Scale
                    </motion.h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {industries.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{
                                duration: 0.8,
                                delay: index * 0.1,
                                ease: [0.22, 1, 0.36, 1]
                            }}
                            whileHover="hover"
                            className="relative group cursor-pointer"
                        >
                            {/* Outer Glow / Animated Border Shadow */}
                            <motion.div
                                variants={{
                                    hover: {
                                        opacity: 1,
                                        scale: 1.05,
                                        filter: "blur(20px)"
                                    }
                                }}
                                initial={{ opacity: 0 }}
                                className="absolute inset-0 bg-gradient-to-br from-[#3b82f6]/10 via-transparent to-[#3b82f6]/5 rounded-2xl z-0 transition-opacity"
                            />

                            {/* Main Card Container */}
                            <motion.div
                                variants={{
                                    hover: {
                                        y: -8,
                                        scale: 1.02,
                                        boxShadow: "0 20px 40px rgba(31, 41, 55, 0.08)"
                                    }
                                }}
                                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                className="relative z-10 p-10 bg-white rounded-2xl border border-[#dadada] flex flex-col items-center text-center h-full overflow-hidden gpu-accel"
                            >
                                {/* Independent Inner Content Movement */}
                                <motion.div
                                    variants={{ hover: { y: -4 } }}
                                    transition={{ duration: 0.4 }}
                                    className="flex flex-col items-center"
                                >
                                    {/* Icon Container with Reflection Effect */}
                                    <div className="relative w-16 h-16 rounded-full bg-[#f0f7ff] flex items-center justify-center mb-8 group-hover:bg-[#3b82f6] transition-colors duration-500 overflow-hidden">
                                        <item.icon className="w-8 h-8 text-[#3b82f6] group-hover:text-white transition-colors duration-500 relative z-10" />

                                        {/* Shimmer / Light Scan effect */}
                                        <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out will-change-transform" />
                                    </div>

                                    <h3 className="text-[26px] font-heading font-bold text-[#1f2937] mb-4 tracking-tight">
                                        {item.title}
                                    </h3>

                                    <p className="text-[16px] text-[rgba(31,41,55,0.7)] font-serif leading-relaxed px-2">
                                        {item.description}
                                    </p>
                                </motion.div>

                                {/* Subtle Geometric Reflection Overlay */}
                                <motion.div
                                    variants={{ hover: { opacity: 0.4, rotate: 45, x: "50%" } }}
                                    initial={{ opacity: 0 }}
                                    className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#3b82f6]/5 to-transparent pointer-events-none"
                                />
                            </motion.div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
