import React, { useEffect, useRef } from 'react';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
}

const services = [
    {
        title: 'Team Structure Design',
        image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1200',
        description: 'We build clear frameworks for hiring, managing, and keeping talent that can scale from 10 to 100 people without friction.',
        features: [
            'Role Architecture & Org Mapping',
            'Optimized Hiring Workflows',
            'Unified Onboarding Systems',
            'Career Path Frameworks'
        ]
    },
    {
        title: 'Performance Systems',
        image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=1200',
        description: 'Move from intuition to intelligence. We help you set clear goals and implement robust feedback loops that drive growth.',
        features: [
            'Evidence-Based Reviews',
            'OKR & KPI Alignment',
            'Manager Capability Training',
            'Cross-Team Productivity Audits'
        ]
    },
    {
        title: 'People Data & Strategy',
        image: '/images/people-data.png',
        description: 'Leverage predictive analytics to understand sentiment, retention risks, and surface hidden growth potential in your team.',
        features: [
            'Team Health Diagnostics',
            'Attrition Risk Modeling',
            'Succession Visualization',
            'Performance Trend Analysis'
        ]
    }
];

function ServiceFlipCard({ service }: { service: typeof services[0] }) {
    return (
        <div className="reveal-item group h-[480px] w-full [perspective:1000px]">
            <div className="relative h-full w-full transition-all duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">

                {/* Front Side */}
                <div className="absolute inset-0 h-full w-full overflow-hidden rounded-[32px] bg-white border border-mist/40 [backface-visibility:hidden] flex flex-col">
                    {/* Top Image - Height 240px */}
                    <div className="relative h-[240px] w-full overflow-hidden">
                        <img
                            src={service.image}
                            alt={service.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                    </div>

                    {/* Front Content - Just the heading */}
                    <div className="p-8 md:p-10 flex flex-col items-center justify-center flex-grow">
                        <h3 className="text-2xl md:text-3xl font-display font-bold text-ink text-center">
                            {service.title}
                        </h3>
                        <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#0A0A0B]/40">
                            Hover to Flip <ArrowUpRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                {/* Back Side */}
                <div className="absolute inset-0 h-full w-full overflow-hidden rounded-[32px] bg-[#0A0A0B] border border-[#E6D3C4]/20 p-10 flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <h3 className="text-2xl font-display font-bold text-[#FFEEDE] mb-6 border-b border-[#E6D3C4]/20 pb-4 text-left">
                        {service.title}
                    </h3>

                    <p className="text-[#E6D3C4]/80 font-elegant text-lg mb-8 leading-relaxed text-left">
                        {service.description}
                    </p>

                    <div className="space-y-4 flex-grow overflow-y-auto no-scrollbar">
                        {service.features.map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-3 text-sm text-[#E6D3C4]/70 font-medium font-elegant text-left">
                                <CheckCircle2 className="w-5 h-5 text-[#FFEEDE]/40 mt-0.5 flex-shrink-0" />
                                <span>{feature}</span>
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 mt-auto border-t border-[#E6D3C4]/10">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFEEDE]/40">
                            Strategy & Execution
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function Services() {
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 75%',
                    end: 'bottom 20%',
                    toggleActions: 'play none none reverse',
                }
            });

            gsap.set('.reveal-item', { opacity: 0, y: 50 });

            tl.to('.reveal-title-pre', { opacity: 1, y: 0, duration: 0.6 })
                .to('.title-reveal', { opacity: 1, y: 0, duration: 0.8 }, '-=0.4')
                .to('.reveal-desc', { opacity: 1, y: 0, duration: 0.8 }, '-=0.6')
                .to('.reveal-item', {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    stagger: 0.2,
                    ease: 'power3.out'
                }, '-=0.4');

        }, sectionRef);

        return () => ctx.revert();
    }, []);

    return (
        <section
            ref={sectionRef}
            id="services"
            className="py-32 md:py-48 px-6 lg:px-12 bg-[#0A0A0B] relative overflow-hidden flex flex-col justify-center"
        >
            <div className="max-w-7xl mx-auto relative z-10 w-full">
                <div className="text-center mb-24 md:mb-32 max-w-4xl mx-auto">
                    <span className="reveal-title-pre inline-block font-accent text-xs font-bold tracking-[0.4em] uppercase text-[#E6D3C4] mb-8 opacity-0">
                        OUR CAPABILITIES
                    </span>
                    <h2 className="title-reveal text-4xl md:text-6xl lg:text-7xl font-display font-bold text-[#FFEEDE] mb-10 leading-[1.1] opacity-0 tracking-tight">
                        The Intelligence Layer for <br className="hidden md:block" />
                        <span className="text-[#E6D3C4] italic">High-Performance</span> Teams
                    </h2>
                    <p className="reveal-desc text-lg md:text-xl text-[#E6D3C4]/60 font-elegant leading-relaxed max-w-3xl mx-auto opacity-0 font-light">
                        We don't just advise. We implement the execution systems, data loops, and structure required to transform talent into measurable business outcomes.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 w-full">
                    {services.map((service, index) => (
                        <ServiceFlipCard key={index} service={service} />
                    ))}
                </div>
            </div>
        </section>
    );
}
