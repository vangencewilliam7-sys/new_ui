import React, { useRef } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal'

export function WhyNowSection() {
    const sectionRef = useRef<HTMLElement>(null)
    useScrollReveal(sectionRef)

    return (
        <section ref={sectionRef} id="why-now" className="py-24 bg-[#f7f7f9] px-6">
            <div className="container mx-auto max-w-4xl text-center">
                <h2 className="reveal-fade text-sm font-bold tracking-[0.2em] uppercase text-[#3b82f6] mb-6">Why Now?</h2>
                <h3 className="reveal-fade text-3xl md:text-5xl font-extrabold text-[#1f2937] leading-tight mb-8">
                    The Modern Workforce is Intelligent.
                </h3>
                <p className="reveal-fade text-xl md:text-2xl text-[#1f2937]/70 leading-relaxed max-w-3xl mx-auto font-medium">
                    With AI integration and the rapid evolution of the Indian workforce, legacy management methods are obsolete. TalentOps provides the structural foundation to turn potential into profitable scale.
                </p>
            </div>
        </section>
    )
}
