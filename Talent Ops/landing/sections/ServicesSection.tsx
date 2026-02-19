import React, { useRef } from 'react'
import { Briefcase, Cpu, Search, ArrowUpRight } from 'lucide-react'
import { useScrollReveal } from '../hooks/useScrollReveal'

const services = [
    {
        icon: <Cpu className="w-8 h-8" />,
        title: "AI Workforce Intelligence",
        image: "/assets/people-data.png",
        description: "Predictive analytics to optimize hiring, retention, and performance."
    },
    {
        icon: <Search className="w-8 h-8" />,
        title: "Operational Transparency",
        image: "/assets/performance-systems.png",
        description: "Real-time dashboards showing exactly where resources are allocated."
    },
    {
        icon: <Briefcase className="w-8 h-8" />,
        title: "Talent Structuring",
        image: "/assets/team-structure.png",
        description: "Design and organize teams for maximum output and strategic alignment."
    }
]

export function ServicesSection() {
    const sectionRef = useRef<HTMLElement>(null)
    useScrollReveal(sectionRef)

    return (
        <section ref={sectionRef} id="services" className="py-24 bg-paper px-6 overflow-hidden">
            <div className="container mx-auto max-w-6xl relative z-10">
                <div className="text-center mb-20">
                    <span className="reveal-fade inline-block font-accent text-xs font-bold tracking-[0.3em] uppercase text-accent-violet mb-6">
                        SERVICES
                    </span>
                    <h2 className="reveal-fade font-display text-4xl md:text-5xl font-bold text-ink leading-tight">
                        Expertly Crafted <span className="text-gradient-violet italic">Talent Ops</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {services.map((service, idx) => (
                        <div
                            key={idx}
                            className="reveal-fade group relative bg-white border border-mist/50 rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:border-accent-violet/30"
                        >
                            {/* Card Image */}
                            <div className="relative h-48 overflow-hidden">
                                <img
                                    src={service.image}
                                    alt={service.title}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
                                <div className="absolute bottom-4 left-6">
                                    <div className="w-12 h-12 rounded-xl bg-white shadow-md flex items-center justify-center text-accent-violet transition-transform duration-300 group-hover:-translate-y-1">
                                        {service.icon}
                                    </div>
                                </div>
                            </div>

                            <div className="p-8">
                                <h4 className="font-display text-2xl font-bold text-ink mb-4 group-hover:text-accent-violet transition-colors">
                                    {service.title}
                                </h4>
                                <p className="font-elegant text-lg text-graphite-light leading-relaxed mb-6">
                                    {service.description}
                                </p>
                                <div className="flex items-center gap-2 text-accent-violet font-bold text-sm tracking-widest uppercase hover:gap-4 transition-all cursor-pointer">
                                    Explore Service <ArrowUpRight className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

