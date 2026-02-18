import React, { useRef } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal'

export function ImpactSection() {
    const sectionRef = useRef<HTMLElement>(null)
    useScrollReveal(sectionRef)

    const stats = [
        {
            value: "40%",
            label: "More Visibility",
            sub: "Across all operations"
        },
        {
            value: "30%",
            label: "Productivity Gain",
            sub: "Within the first 90 days"
        },
        {
            value: "100%",
            label: "Revenue Mapping",
            sub: "Full cost-to-output clarity"
        }
    ]

    return (
        <section ref={sectionRef} id="impact" className="py-24 bg-white px-6">
            <div className="container mx-auto max-w-6xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {stats.map((stat, idx) => (
                        <div key={idx} className="reveal-fade border-l-4 border-[#a5c9ff] pl-8 py-4">
                            <div className="text-6xl md:text-7xl font-black text-[#3b82f6] mb-2">{stat.value}</div>
                            <div className="text-2xl font-bold text-[#1f2937] mb-1">{stat.label}</div>
                            <div className="text-[#1f2937]/60 font-medium">{stat.sub}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
