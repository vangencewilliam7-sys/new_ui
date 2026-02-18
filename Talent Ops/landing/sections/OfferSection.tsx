import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function OfferSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from('.offer-card', {
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: 'top 85%',
                    invalidateOnRefresh: true,
                    once: true
                },
                y: 40,
                autoAlpha: 0,
                stagger: 0.15,
                duration: 1,
                ease: 'power3.out'
            })

            gsap.from('.positioning-line', {
                scrollTrigger: {
                    trigger: '.positioning-line',
                    start: 'top 95%',
                    invalidateOnRefresh: true,
                },
                autoAlpha: 0,
                y: 15,
                duration: 1,
                delay: 0.4,
                ease: 'power2.out'
            })
        }, sectionRef)
        return () => ctx.revert()
    }, [])

    return (
        <section ref={sectionRef} className="py-32 bg-paper px-8 md:px-16" id="features">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-20">
                    <span className="font-accent text-xs font-medium tracking-[0.3em] uppercase text-graphite-light mb-6 block">
                        WHAT WE OFFER
                    </span>
                    <h2 className="text-[42px] md:text-[48px] lg:text-[52px] text-[#1f2937] font-heading font-semibold tracking-tight leading-[1.15] mb-6">
                        Complete Talent Operations
                    </h2>
                    <p className="text-[18px] text-[rgba(31,41,55,0.85)] font-serif leading-[1.7] max-w-[640px] mx-auto">
                        We handle your entire talent lifecycle so you can focus on growing your business.
                    </p>
                </div>

                <div className="flex justify-center mb-20">
                    {/* Card 1: Service */}
                    <div className="offer-card relative p-10 bg-white rounded-2xl border border-graphite/10 hover:border-accent-violet transition-all duration-300 shadow-sm group hover:-translate-y-2 hover:shadow-2xl max-w-2xl w-full">
                        <div className="mb-8">
                            <h3 className="text-[24px] md:text-[26px] text-[#1f2937] font-heading font-semibold tracking-tight leading-[1.2] mb-4">Talent Ops as a Service</h3>
                            <p className="text-[18px] text-[rgba(31,41,55,0.85)] font-serif leading-[1.7]">
                                For companies that want to focus on execution, not operations.
                            </p>
                        </div>

                        <div className="mb-8 p-6 bg-paper-warm rounded-xl">
                            <p className="font-medium text-ink mb-4">We remotely manage your end-to-end talent operations, including:</p>
                            <ul className="space-y-3">
                                {['Hiring and onboarding', 'HR operations', 'Project and delivery management', 'Billing and invoicing'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-graphite">
                                        <span className="w-1.5 h-1.5 rounded-full bg-accent-violet" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-6 border-t border-graphite/10">
                            <p className="font-display text-xl font-medium text-accent-violet">
                                You don't build teams or processes.<br />
                                You get results.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
