import React, { useRef } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal'

export function WhoItsForSection() {
    const sectionRef = useRef<HTMLElement>(null)
    useScrollReveal(sectionRef)

    const personas = [
        {
            role: "Founders",
            benefit: "Scale your organization with structural integrity and operational clarity."
        },
        {
            role: "HR Leaders",
            benefit: "Transform HR from a support function into a strategic revenue driver."
        },
        {
            role: "Team Managers",
            benefit: "Manage workloads effectively with predictive resource mapping."
        }
    ]

    return (
        <section ref={sectionRef} id="who-its-for" className="py-24 bg-[#f7f7f9] px-6">
            <div className="container mx-auto max-w-6xl">
                <div className="text-center mb-16">
                    <h2 className="reveal-fade text-sm font-bold tracking-[0.2em] uppercase text-[#3b82f6] mb-4">Target</h2>
                    <h3 className="reveal-fade text-3xl md:text-5xl font-extrabold text-[#1f2937] leading-tight">Who It’s For</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {personas.map((persona, idx) => (
                        <div
                            key={idx}
                            className="reveal-fade p-8 rounded-2xl bg-[#ffe2de]/10 border border-[#ffe2de]/30 hover:bg-[#ffe2de]/20 transition-all duration-300"
                        >
                            <h4 className="text-2xl font-black text-[#1f2937] mb-4">{persona.role}</h4>
                            <p className="text-[#1f2937]/80 text-lg leading-relaxed font-medium">
                                {persona.benefit}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
