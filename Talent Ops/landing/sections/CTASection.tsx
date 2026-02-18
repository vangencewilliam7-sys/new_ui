import React, { useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { useScrollReveal } from '../hooks/useScrollReveal'

export function CTASection() {
    const sectionRef = useRef<HTMLElement>(null)
    useScrollReveal(sectionRef)

    return (
        <section ref={sectionRef} id="cta" className="py-24 px-6">
            <div className="container mx-auto max-w-6xl">
                <div
                    className="reveal-fade p-12 md:p-20 rounded-[40px] text-center relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #a5c9ff 0%, #e3f2fd 100%)'
                    }}
                >
                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-6xl font-black text-[#1f2937] leading-[1.1] mb-8">
                            Ready to Transform <br className="hidden md:block" /> Your Talent Ops?
                        </h2>
                        <p className="text-xl md:text-2xl text-[#1f2937]/70 font-medium mb-12 max-w-2xl mx-auto">
                            Join high-growth teams using TalentOps to achieve operational mastery.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <button className="bg-[#3b82f6] text-white px-12 py-5 rounded-[12px] font-bold text-lg hover:bg-[#2563eb] transition-all shadow-xl flex items-center gap-3 group">
                                Get Started Now
                                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>
                    </div>

                    {/* Subtle design elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -ml-32 -mb-32" />
                </div>
            </div>
        </section>
    )
}
