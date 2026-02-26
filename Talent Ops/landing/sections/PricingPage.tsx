import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, Globe, Users, Zap, Briefcase, ChevronRight, Lock } from 'lucide-react';
import { Navigation } from '../components/Navigation';
import Footer from './Footer';

type PlanType = 'SaaS' | 'Managed';

export default function PricingPage() {
    const navigate = useNavigate();
    const [planType, setPlanType] = useState<PlanType>('Managed');
    const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const blueAccent = '#3b82f6';

    const managedPlans = [
        {
            region: "INDIA",
            title: "Under 10 Employees",
            price: "₹2,000",
            subtitle: "/ month starting",
            aiLabel: "With AI",
            aiPrice: "+ ₹5,000",
            dark: false
        },
        {
            region: "INDIA",
            title: "Under 25 Employees",
            price: "₹2,000",
            subtitle: "/ month starting",
            aiLabel: "With AI",
            aiPrice: "+ ₹4,000",
            unit: "/ month / person",
            dark: false
        },
        {
            region: "INDIA",
            title: "Under 50 Employees",
            price: "₹2,000",
            subtitle: "/ month / person",
            aiLabel: "With AI",
            aiPrice: "+ ₹3,000",
            unit: "/ month / person",
            dark: false
        },
        {
            region: "USA & GLOBAL",
            title: "Under 10 Employees",
            price: "$25",
            subtitle: "/ month starting",
            aiLabel: "With AI",
            aiPrice: "+ $100",
            dark: false
        }
    ];

    const saasPlans = [
        {
            name: "SMALL TEAM",
            title: "Up to 25 Users",
            price: "$100+",
            subtitle: "/ month",
            description: "Base platform fee",
            features: ["Full TalentOps Platform access", "Core workflow automation", "Basic unexpected reports"],
            buttonText: "GET STARTED",
            dark: false
        },
        {
            name: "MID-SIZE",
            title: "Under 100 Users",
            price: "$400+",
            subtitle: "/ month",
            description: "Base platform fee",
            features: ["Typically for growing agencies", "Advanced project tracking", "Priority support"],
            buttonText: "GET STARTED",
            popular: true,
            dark: false
        },
        {
            name: "ENTERPRISE",
            title: "100+ Users",
            price: "Custom",
            subtitle: "",
            description: "Tailored pricing",
            features: ["Custom integrations", "Dedicated success manager", "SLA guarantees"],
            buttonText: "CONTACT SALES",
            dark: false
        }
    ];

    return (
        <div className="min-h-screen bg-white">
            <Navigation isDark={true} />

            <main className="pt-24 pb-8 px-6 lg:px-12">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl md:text-5xl font-heading font-bold text-[#111111] mb-2"
                        >
                            Transparent Pricing
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-sm md:text-base text-[#1f2937]/70 font-serif max-w-2xl mx-auto leading-relaxed"
                        >
                            Choose the model that fits your stage. Build it yourself with our Platform, or let us handle everything as a Service.
                        </motion.p>
                    </div>

                    {/* Toggle Switch */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8">
                        <div className="bg-[#f3f4f6] p-1.5 rounded-full flex items-center relative min-w-[320px]">
                            <button
                                onClick={() => setPlanType('SaaS')}
                                className={`flex-1 relative z-10 py-2.5 rounded-full text-xs font-bold transition-all duration-300 ${planType === 'SaaS' ? 'text-white' : 'text-[#1f2937]/60 hover:text-[#1f2937]'}`}
                            >
                                Platform (SaaS)
                            </button>
                            <button
                                onClick={() => setPlanType('Managed')}
                                className={`flex-1 relative z-10 py-2.5 rounded-full text-xs font-bold transition-all duration-300 ${planType === 'Managed' ? 'text-white' : 'text-[#1f2937]/60 hover:text-[#1f2937]'}`}
                            >
                                Service (Managed)
                            </button>
                            <motion.div
                                className="absolute rounded-full top-1.5 bottom-1.5"
                                initial={false}
                                animate={{
                                    left: planType === 'SaaS' ? '6px' : 'calc(50% + 3px)',
                                    width: 'calc(50% - 9px)',
                                    backgroundColor: planType === 'SaaS' ? '#111111' : '#3b82f6'
                                }}
                                transition={{ type: "spring", stiffness: 400, damping: 35 }}
                            />
                        </div>

                        {/* Currency Toggle (Only for Managed) */}
                        {planType === 'Managed' && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-[#f3f4f6] p-1.5 rounded-full flex items-center relative min-w-[140px]"
                            >
                                <button
                                    onClick={() => setCurrency('INR')}
                                    className={`flex-1 relative z-10 py-2 rounded-full text-[10px] font-bold transition-all duration-300 ${currency === 'INR' ? 'text-white' : 'text-[#1f2937]/60 hover:text-[#1f2937]'}`}
                                >
                                    INR (₹)
                                </button>
                                <button
                                    onClick={() => setCurrency('USD')}
                                    className={`flex-1 relative z-10 py-2 rounded-full text-[10px] font-bold transition-all duration-300 ${currency === 'USD' ? 'text-white' : 'text-[#1f2937]/60 hover:text-[#1f2937]'}`}
                                >
                                    USD ($)
                                </button>
                                <motion.div
                                    className="absolute rounded-full top-1.5 bottom-1.5 bg-[#3b82f6]"
                                    initial={false}
                                    animate={{
                                        left: currency === 'INR' ? '6px' : 'calc(50% + 3px)',
                                        width: 'calc(50% - 9px)'
                                    }}
                                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                />
                            </motion.div>
                        )}
                    </div>

                    {/* Pricing Content */}
                    <AnimatePresence mode="wait">
                        {planType === 'Managed' ? (
                            <motion.div
                                key="managed"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.3 }}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                            >
                                {managedPlans.map((plan, idx) => {
                                    // Price Conversion Logic for India cards
                                    let displayPrice = plan.price;
                                    let displayAiPrice = plan.aiPrice;

                                    if (currency === 'USD' && plan.region === 'INDIA') {
                                        // Simple conversion logic (INR to USD)
                                        if (plan.price === '₹2,000') displayPrice = '$25';

                                        if (plan.aiPrice === '+ ₹5,000') displayAiPrice = '+ $60';
                                        if (plan.aiPrice === '+ ₹4,000') displayAiPrice = '+ $48';
                                        if (plan.aiPrice === '+ ₹3,000') displayAiPrice = '+ $36';
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            className={`group p-4 md:p-5 rounded-[20px] border border-[rgba(31,41,55,0.06)] shadow-[0_10px_30px_rgba(0,0,0,0.01)] transition-all hover:bg-[#111111] hover:text-white hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] duration-500 flex flex-col ${plan.dark ? 'bg-[#111111] text-white border-transparent' : 'bg-white text-[#1f2937]'}`}
                                        >
                                            <div className="flex items-center gap-2 mb-3">
                                                <Globe className={`w-3 h-3 transition-colors duration-500 ${plan.dark ? 'text-[#3b82f6]' : 'text-[#3b82f6] group-hover:text-[#60a5fa]'}`} />
                                                <span className="text-[8px] font-black tracking-[0.2em] uppercase opacity-40 group-hover:opacity-60">{plan.region}</span>
                                            </div>
                                            <h3 className="text-sm font-heading font-bold mb-3">{plan.title}</h3>

                                            <div className="mb-0.5">
                                                <span className="text-2xl font-heading font-bold">{displayPrice}</span>
                                            </div>
                                            <div className="text-[10px] opacity-40 mb-4 font-serif group-hover:opacity-60">{plan.subtitle}</div>

                                            <div className="mt-auto pt-3 border-t border-[rgba(31,41,55,0.08)] group-hover:border-white/10 flex justify-between items-baseline">
                                                <span className="text-[10px] font-bold">{plan.aiLabel}</span>
                                                <div className="text-right">
                                                    <span className={`text-[10px] font-bold transition-colors duration-500 ${plan.dark ? 'text-[#3b82f6]' : 'text-[#3b82f6] group-hover:text-[#60a5fa]'}`}>{displayAiPrice}</span>
                                                    {plan.unit && <div className="text-[8px] opacity-40 font-serif leading-tight group-hover:opacity-60">{plan.unit}</div>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="saas"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.3 }}
                                className="grid grid-cols-1 md:grid-cols-3 gap-4"
                            >
                                {saasPlans.map((plan, idx) => (
                                    <div
                                        key={idx}
                                        className={`group relative p-4 md:p-5 rounded-[20px] border border-[rgba(31,41,55,0.08)] shadow-[0_10px_30px_rgba(0,0,0,0.01)] transition-all hover:bg-[#111111] hover:text-white hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] duration-500 flex flex-col overflow-hidden ${plan.dark ? 'bg-[#111111] text-white border-transparent scale-105 z-10' : 'bg-white text-[#1f2937]'}`}
                                    >
                                        {/* Lock Overlay Content */}
                                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/10 backdrop-blur-[4px] group-hover:bg-[#111111]/10 transition-colors duration-500">
                                            <div className="w-10 h-10 rounded-full bg-white/80 shadow-lg flex items-center justify-center mb-2 group-hover:bg-[#333333] transition-colors duration-500">
                                                <Lock className="w-5 h-5 text-[#111111] group-hover:text-white transition-colors duration-500" />
                                            </div>
                                            <span className="text-[10px] font-black tracking-widest uppercase opacity-40 group-hover:opacity-60 group-hover:text-white">Locked</span>
                                        </div>

                                        <div className="relative z-10 filter blur-[2px] opacity-40">
                                            {plan.popular && (
                                                <div className="absolute -top-3 right-6 bg-[#06b6d4] text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest z-20">
                                                    POPULAR
                                                </div>
                                            )}
                                            <span className="text-[8px] font-black tracking-widest uppercase opacity-30 group-hover:opacity-50 mb-1.5">{plan.name}</span>
                                            <h3 className="text-sm font-heading font-bold mb-3">{plan.title}</h3>

                                            <div className="flex items-baseline gap-1 mb-0.5">
                                                <span className="text-2xl font-heading font-bold">{plan.price}</span>
                                                <span className="text-[9px] opacity-40 group-hover:opacity-60 font-serif">{plan.subtitle}</span>
                                            </div>
                                            <div className="text-[10px] opacity-40 mb-4 font-serif group-hover:opacity-60">{plan.description}</div>

                                            <ul className="space-y-2 mb-6">
                                                {plan.features.map((feature, fidx) => (
                                                    <li key={fidx} className="flex items-start gap-2">
                                                        <div className={`mt-1 flex-shrink-0 w-2.5 h-2.5 rounded-full flex items-center justify-center transition-colors duration-500 ${plan.dark ? 'bg-[#06b6d4]/20' : 'bg-[#06b6d4]/10 group-hover:bg-[#06b6d4]/20'}`}>
                                                            <Check className={`w-1.5 h-1.5 text-[#06b6d4]`} />
                                                        </div>
                                                        <span className="text-[11px] leading-tight opacity-70 group-hover:opacity-90">{feature}</span>
                                                    </li>
                                                ))}
                                            </ul>

                                            <motion.button
                                                className={`w-full py-2.5 rounded-xl text-[9px] font-black tracking-[0.2em] transition-all duration-300 ${plan.popular ? 'bg-[#06b6d4] text-white' : 'text-[#1f2937] border border-[#1f2937]/10'}`}
                                            >
                                                {plan.buttonText}
                                            </motion.button>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>


                    {/* Enterprise Bottom Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mt-8"
                    >
                        <div className="bg-white rounded-[20px] border border-[rgba(31,41,55,0.08)] shadow-[0_10px_30px_rgba(0,0,0,0.01)] p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6 group transition-all duration-500 hover:bg-[#111111] hover:text-white hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${planType === 'Managed' ? 'bg-[#e0f2fe] group-hover:bg-[#3b82f6]/20' : 'bg-[#f0f9ff] group-hover:bg-[#06b6d4]/20'}`}>
                                    <Users className={`w-6 h-6 transition-colors duration-500 ${planType === 'Managed' ? 'text-[#3b82f6]' : 'text-[#06b6d4]'}`} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-heading font-bold mb-1">50+ Employees / Enterprise</h4>
                                    <p className="text-[#1f2937]/50 font-serif leading-relaxed max-w-xl text-xs group-hover:text-white/50">
                                        Custom scope and pricing for large organizations requiring dedicated workflows.
                                    </p>
                                </div>
                            </div>
                            <motion.button
                                onClick={() => navigate('/request-demo')}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`px-6 py-3 rounded-xl text-[9px] font-black tracking-[0.2em] uppercase shadow-xl transition-all duration-500 ${planType === 'Managed' ? 'bg-[#3b82f6] text-white shadow-[#3b82f6]/20 hover:bg-[#2563eb] group-hover:bg-white group-hover:text-[#111111]' : 'bg-[#111111] text-white shadow-[#111111]/20 hover:bg-black group-hover:bg-white group-hover:text-[#111111]'}`}
                            >
                                REQUEST DEMO
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
