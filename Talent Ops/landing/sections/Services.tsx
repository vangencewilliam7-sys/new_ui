import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';

const services = [
    {
        title: 'Workforce Visibility',
        image: '/people-data-stretagy.jpg.png',
        description: 'Understand how work, roles, and responsibilities are distributed across the organization, allowing leaders to spot constraints and structural gaps early.'
    },
    {
        title: 'Performance Intelligence',
        image: '/images/performance-intelligence.jpg',
        description: 'Replace subjective assessments with continuous performance insights, enabling early detection of issues and informed management decisions.'
    },
    {
        title: 'Planning & Structuring',
        image: '/images/planning-structuring.jpg',
        description: 'Align workforce planning with business objectives by designing team structures and resource allocation based on current capacity and future needs.'
    },
    {
        title: 'Lifecycle Management',
        image: '/images/lifecycle-management.jpg',
        description: 'Manage the full employee lifecycle within a structured framework, from onboarding through development and retention.'
    }
];

function ServiceFlipCard({ service, index }: { service: typeof services[0], index: number }) {
    const controls = useAnimation();

    const handleMouseEnter = () => {
        controls.start({ rotateY: 180, transition: { duration: 0.7, ease: "easeInOut" } });
    };

    const handleMouseLeave = async () => {
        await controls.start({ rotateY: 360, transition: { duration: 0.7, ease: "easeInOut" } });
        controls.set({ rotateY: 0 });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.8, delay: index * 0.2, ease: "easeOut" }}
            className="h-[480px] w-full [perspective:1000px]"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <motion.div
                className="relative h-full w-full [transform-style:preserve-3d]"
                animate={controls}
                initial={{ rotateY: 0 }}
            >

                {/* Front Side */}
                <div className="absolute inset-0 h-full w-full overflow-hidden rounded-[32px] bg-[#0A0A0B] border border-mist/40 [backface-visibility:hidden] flex flex-col">
                    {/* Top Image - Height 240px */}
                    <div className="relative h-[240px] w-full overflow-hidden">
                        <img
                            src={service.image}
                            alt={service.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover transition-transform duration-700"
                        />
                    </div>

                    {/* Front Content - Just the heading */}
                    <div className="p-8 md:p-10 flex flex-col items-center justify-center flex-grow">
                        <h3 className="text-2xl md:text-3xl font-display font-bold text-white text-center">
                            {service.title}
                        </h3>
                        <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                            Hover to Flip <ArrowUpRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                {/* Back Side */}
                <div className="absolute inset-0 h-full w-full overflow-hidden rounded-[32px] bg-[#0A0A0B] border border-[#E6D3C4]/20 p-10 flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <h3 className="text-2xl font-display font-bold text-[#FFEEDE] mb-6 border-b border-[#E6D3C4]/20 pb-4 text-left">
                        {service.title}
                    </h3>

                    <div className="flex-grow overflow-y-auto no-scrollbar">
                        <p className="text-[#E6D3C4]/80 font-elegant text-lg leading-relaxed text-left">
                            {service.description}
                        </p>
                    </div>

                    <div className="pt-6 mt-auto border-t border-[#E6D3C4]/10">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFEEDE]/40">
                            Strategy & Execution
                        </span>
                    </div>
                </div>

            </motion.div>
        </motion.div>
    );
}

export default function Services() {
    return (
        <section
            id="services"
            className="py-16 md:py-24 px-6 lg:px-12 bg-[#0A0A0B] relative overflow-hidden flex flex-col justify-center"
        >
            <div className="max-w-7xl mx-auto relative z-10 w-full">
                <div className="text-center mb-24 md:mb-32 max-w-6xl mx-auto">
                    <motion.span
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.1 }}
                        transition={{ duration: 0.6 }}
                        className="inline-block font-accent text-xs font-bold tracking-[0.4em] uppercase text-[#E6D3C4] mb-8"
                    >
                        OUR CAPABILITIES
                    </motion.span>
                    <div className="flex justify-center w-full overflow-visible">
                        <motion.h2
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.1 }}
                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            className="text-xl md:text-3xl lg:text-4xl xl:text-5xl font-display font-bold text-[#FFEEDE] mb-10 leading-[1.1] tracking-tight whitespace-nowrap shrink-0 text-center"
                        >
                            A Unified Intelligence System for <span className="text-[#E6D3C4] italic">Workforce Decisions</span>
                        </motion.h2>
                    </div>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.1 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="text-lg md:text-xl text-[#E6D3C4]/60 font-elegant leading-relaxed max-w-3xl mx-auto font-light"
                    >
                        TalentOps unifies people data, performance insights, and organizational structure into one system for coordinated execution, visibility, and scalable growth.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-10 w-full">
                    {services.map((service, index) => (
                        <ServiceFlipCard key={index} service={service} index={index} />
                    ))}
                </div>
            </div>
        </section>
    );
}
