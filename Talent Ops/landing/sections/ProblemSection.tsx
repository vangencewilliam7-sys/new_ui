import React, { useRef } from 'react'
import { LayoutGrid, EyeOff, BarChart3 } from 'lucide-react'
import { useScrollReveal } from '../hooks/useScrollReveal'

export function ProblemSection() {
    const sectionRef = useRef<HTMLElement>(null)
    useScrollReveal(sectionRef)

    const problems = [
        {
            icon: <LayoutGrid className="w-8 h-8 text-[#3b82f6]" />,
            title: "Fragmented Tools",
            description: "Dozens of disconnected platforms create data silos and operational friction."
        },
        {
            icon: <EyeOff className="w-8 h-8 text-[#3b82f6]" />,
            title: "No Visibility",
            description: "Managers lack real-time insights into work progress and team utilization."
        },
        {
            icon: <BarChart3 className="w-8 h-8 text-[#3b82f6]" />,
            title: "No Revenue Correlation",
            description: "Inability to map talent efforts directly to business growth and profitability."
        }
    ]

    return (
        <section ref={sectionRef} id="problem" className="py-24 bg-white px-6">
            <div className="container mx-auto max-w-6xl">
                <div className="text-center mb-16">
                    <h2 className="reveal-fade text-sm font-bold tracking-[0.2em] uppercase text-[#3b82f6] mb-4">The Problem</h2>
                    <h3 className="reveal-fade text-3xl md:text-5xl font-extrabold text-[#1f2937] leading-tight">Stop the Tool Chaos.</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {problems.map((prob, idx) => (
                        <div
                            key={idx}
                            className="reveal-fade p-8 rounded-2xl bg-white border border-[#dadada] hover:shadow-xl transition-all duration-300 group"
                        >
                            <div className="mb-6 p-4 bg-[#f7f7f9] rounded-xl w-fit group-hover:bg-[#e3f2fd] transition-colors">
                                {prob.icon}
                            </div>
                            <h4 className="text-xl font-bold text-[#1f2937] mb-3">{prob.title}</h4>
                            <p className="text-[#1f2937]/70 leading-relaxed line-clamp-3">
                                {prob.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
