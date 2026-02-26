import React, { Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { StylesInjection } from './styles/StylesInjection';
import { Navigation } from './components/Navigation';
import { SmoothScroll } from './components/SmoothScroll';

// Lazy load sections for optimized performance
const HeroSection = lazy(() => import('./sections/HeroSection').then(m => ({ default: m.HeroSection })));
const Problem = lazy(() => import('./sections/Problem'));
const Services = lazy(() => import('./sections/Services'));
const Approach = lazy(() => import('./sections/Approach'));
const Industries = lazy(() => import('./sections/Industries'));
const Foundations = lazy(() => import('./sections/Foundations'));
const Results = lazy(() => import('./sections/Results'));
const WhyTalentOps = lazy(() => import('./sections/WhyTalentOps'));
const PricingSummary = lazy(() => import('./sections/PricingSummary'));
const FinalCTA = lazy(() => import('./sections/FinalCTA'));
const Footer = lazy(() => import('./sections/Footer'));
const ScrollProgress = lazy(() => import('./sections/ScrollProgress'));

const LoadingSection = () => <div className="min-h-screen bg-[#f7f7f9]" />;

export function LandingPage() {
    return (
        <SmoothScroll>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative w-full bg-[#f7f7f9] text-[#1f2937] font-sans selection:bg-[#a5c9ff] selection:text-[#1f2937]"
            >
                <Suspense fallback={null}>
                    <ScrollProgress />
                </Suspense>

                <main>
                    <Suspense fallback={<LoadingSection />}>
                        <HeroSection />
                    </Suspense>

                    <Suspense fallback={null}>
                        <Problem />
                        <Services />
                        <Approach />
                        <Industries />
                        <Foundations />
                        <Results />
                        <WhyTalentOps />
                        <PricingSummary />
                        <FinalCTA />
                    </Suspense>
                </main>

                <Suspense fallback={null}>
                    <Footer />
                </Suspense>
            </motion.div>
        </SmoothScroll>
    );
}
