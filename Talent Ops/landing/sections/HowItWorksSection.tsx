import React, { useRef } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal'

export function HowItWorksSection() {
    const sectionRef = useRef<HTMLElement>(null)
    useScrollReveal(sectionRef)

    const steps = [
        {
            number: "01",
            title: "Capture Work",
            description: "Automatically aggregate tasks, hours, and delivery metrics from all sources."
        },
        {
            number: "02",
            title: "Measure Output",
            description: "Benchmark performance against industry standards and company goals."
        },
        {
            number: "03",
            title: "Improve with AI",
            description: "Leverage intelligent insights to redistribute workload and optimize ROI."
        }
    ]

    return (
        <section ref={sectionRef} id="how-it-works" className="py-24 bg-white px-6 overflow-hidden">
            <div className="container mx-auto max-w-6xl">
                <div className="text-center mb-20">
                    <h2 className="reveal-fade text-sm font-bold tracking-[0.2em] uppercase text-[#3b82f6] mb-4">Process</h2>
                    <h3 className="reveal-fade text-3xl md:text-5xl font-extrabold text-[#1f2937] leading-tight text-center">How It Works</h3>
                </div>

                <div className="relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden md:block absolute top-[40px] left-[5%] right-[5%] h-[2px] bg-[#dadada] z-0" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10">
                        {steps.map((step, idx) => (
                            <div key={idx} className="reveal-fade flex flex-col items-center text-center">
                                <div className="w-20 h-20 rounded-full bg-[#f7f7f9] border-2 border-[#3b82f6] flex items-center justify-center text-2xl font-black text-[#3b82f6] mb-8 bg-white shadow-sm ring-8 ring-white transition-transform hover:scale-110 duration-300">
                                    {step.number}
                                </div>
                                <h4 className="text-2xl font-bold text-[#1f2937] mb-4">{step.title}</h4>
                                <p className="text-[#1f2937]/70 text-lg leading-relaxed max-w-xs">
                                    {step.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
