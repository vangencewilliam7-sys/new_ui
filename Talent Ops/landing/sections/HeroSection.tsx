import React, { useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { WavyBackground } from '../../components/ui/wavy-background'

export function HeroSection() {
    const sectionRef = useRef<HTMLElement>(null)
    useScrollReveal(sectionRef)

    return (
        <section
            ref={sectionRef}
            id="hero"
            className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#f7f7f9]"
        >
            <WavyBackground
                containerClassName="h-full min-h-screen absolute inset-0 z-0"
                className="w-full flex items-center justify-center"
                colors={["#ffe2de", "#dadada", "#a5c9ff"]}
                backgroundFill="#f7f7f9"
                waveOpacity={0.8}
                blur={8}
                speed="fast"
            >
                <div className="container mx-auto relative z-10 w-full max-w-5xl text-center px-6">
                    <div className="flex flex-col items-center">
                        <h1 className="reveal-fade font-redhat text-[clamp(2.5rem,7vw,5rem)] md:text-7xl lg:text-8xl font-bold leading-[1.1] tracking-tight text-[#1f2937]">
                            The <span className="inline-block bg-gradient-to-r from-[#a5c9ff] to-[#3b82f6] bg-clip-text text-transparent font-leckerli font-normal px-4 scale-110 origin-center">Intelligence Layer</span> <br className="hidden md:block" />
                            <span className="font-redhat font-bold tracking-tight">of Your Workforce</span>
                        </h1>

                        <p className="reveal-fade text-lg md:text-2xl text-[#1f2937]/70 font-redhat font-medium mt-10 max-w-2xl mx-auto">
                            Connect talent data, performance metrics, and planning insights into a single, strategic command center.
                        </p>

                        <div className="reveal-fade flex justify-center mt-20">
                            <a
                                href="#cta"
                                className="bg-[#3b82f6] text-white px-12 py-5 rounded-[16px] font-bold text-lg tracking-wide hover:bg-[#2563eb] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center gap-4 group"
                            >
                                Get Started
                                <ArrowRight className="w-7 h-7 transition-transform group-hover:translate-x-2" />
                            </a>
                        </div>
                    </div>
                </div>
            </WavyBackground>
        </section>
    )
}
