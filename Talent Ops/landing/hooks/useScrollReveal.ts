import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger)
}

export const useScrollReveal = (containerRef: React.RefObject<HTMLElement>) => {
    useEffect(() => {
        if (!containerRef.current) return

        const ctx = gsap.context(() => {
            const elements = containerRef.current?.querySelectorAll('.reveal-fade')

            if (elements && elements.length > 0) {
                gsap.fromTo(elements,
                    {
                        y: 40,
                        opacity: 0,
                        visibility: 'hidden'
                    },
                    {
                        y: 0,
                        opacity: 1,
                        visibility: 'visible',
                        duration: 1,
                        stagger: 0.15,
                        ease: 'power3.out',
                        force3D: true,
                        scrollTrigger: {
                            trigger: containerRef.current,
                            start: 'top 85%',
                            once: true
                        }
                    }
                )
            }
        }, containerRef)

        return () => ctx.revert()
    }, [containerRef])
}
