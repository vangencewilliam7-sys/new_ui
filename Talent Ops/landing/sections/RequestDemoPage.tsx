import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, Building2, Mail, User, Phone } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export function RequestDemoPage() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        phone: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) newErrors.name = 'Full name is required';
        if (!formData.email.trim()) {
            newErrors.email = 'Work email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid work email';
        }
        if (!formData.company.trim()) newErrors.company = 'Company name is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsSubmitting(false);
        setIsSubmitted(true);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-12 rounded-[32px] shadow-xl border border-[#dadada] max-w-xl w-full text-center"
                >
                    <div className="w-20 h-20 bg-[#f0f9ff] rounded-full flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 className="w-10 h-10 text-[#3b82f6]" />
                    </div>
                    <h1 className="text-3xl font-heading font-bold text-[#1f2937] mb-4">Request Received</h1>
                    <p className="text-lg text-[#1f2937]/70 font-serif leading-relaxed mb-10">
                        Thank you for your interest in TalentOps. One of our workforce intelligence experts will reach out to you within 24 hours to schedule your personalized demo.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-[#1f2937] text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 mx-auto hover:bg-[#111827] transition-colors"
                    >
                        Return Home
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-[#F8F7F4] flex flex-col relative px-6 md:px-12 py-4 overflow-hidden">
            <main className="flex-grow flex items-center justify-center py-6">
                <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    {/* Left side: Context */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <span className="text-[#3b82f6] font-bold tracking-[0.2em] uppercase text-xs mb-3 block">Request a Demo</span>
                        <h1 className="text-4xl md:text-5xl font-heading font-bold text-[#1f2937] leading-[1.1] mb-6">
                            See TalentOps in Action
                        </h1>
                        <p className="text-lg text-[#1f2937]/70 font-serif leading-relaxed mb-6 max-w-lg">
                            Discover how our workforce intelligence platform can help you structure growth, optimize performance, and build a high-ROI workforce.
                        </p>

                        <div className="space-y-4">
                            {[
                                "Personalized walkthrough of key features",
                                "Custom ROI analysis for your team",
                                "Deep dive into data integrations",
                                "Answers to your specific technical questions"
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-[#1f2937]">
                                    <div className="w-5 h-5 rounded-full bg-[#f0f9ff] flex items-center justify-center">
                                        <ChevronRight className="w-3 h-3 text-[#3b82f6]" />
                                    </div>
                                    <span className="font-serif font-medium text-sm">{item}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Right side: Form */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="bg-white p-8 md:p-10 rounded-[32px] shadow-2xl border border-[#dadada]"
                    >
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="name" className="text-sm font-bold text-[#1f2937]/60 uppercase tracking-widest pl-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#dadada]" />
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        placeholder="Jane Cooper"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className={`w-full bg-[#F8F7F4] border ${errors.name ? 'border-red-500' : 'border-[#dadada]'} rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 transition-all font-serif text-sm`}
                                    />
                                </div>
                                {errors.name && <p className="text-red-500 text-[10px] mt-0.5 pl-1">{errors.name}</p>}
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-bold text-[#1f2937]/60 uppercase tracking-widest pl-1">Work Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#dadada]" />
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="jane@company.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className={`w-full bg-[#F8F7F4] border ${errors.email ? 'border-red-500' : 'border-[#dadada]'} rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 transition-all font-serif text-sm`}
                                    />
                                </div>
                                {errors.email && <p className="text-red-500 text-[10px] mt-0.5 pl-1">{errors.email}</p>}
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="company" className="text-sm font-bold text-[#1f2937]/60 uppercase tracking-widest pl-1">Company Name</label>
                                <div className="relative">
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#dadada]" />
                                    <input
                                        id="company"
                                        name="company"
                                        type="text"
                                        placeholder="Acme Corp"
                                        value={formData.company}
                                        onChange={handleChange}
                                        className={`w-full bg-[#F8F7F4] border ${errors.company ? 'border-red-500' : 'border-[#dadada]'} rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 transition-all font-serif text-sm`}
                                    />
                                </div>
                                {errors.company && <p className="text-red-500 text-[10px] mt-0.5 pl-1">{errors.company}</p>}
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="phone" className="text-sm font-bold text-[#1f2937]/60 uppercase tracking-widest pl-1">Phone (Optional)</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#dadada]" />
                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        placeholder="+1 (555) 000-0000"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full bg-[#F8F7F4] border border-[#dadada] rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 transition-all font-serif text-sm"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-[#3b82f6] text-white py-4 rounded-xl font-bold text-base hover:bg-[#2563eb] disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-xl shadow-[#3b82f6]/20 flex items-center justify-center gap-3 relative overflow-hidden group"
                            >
                                <span className={isSubmitting ? 'opacity-0' : 'opacity-100'}>Schedule Your Demo</span>
                                {isSubmitting && (
                                    <Loader2 className="w-5 h-5 animate-spin absolute" />
                                )}
                                {!isSubmitting && (
                                    <motion.div
                                        animate={{ x: [0, 5, 0] }}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </motion.div>
                                )}
                            </button>
                            <p className="text-center text-[10px] text-[#1f2937]/40 font-serif lowercase">
                                By clicking, you agree to our terms and privacy policy.
                            </p>
                        </form>
                    </motion.div>
                </div>
            </main>

            {/* Bottom Left Back Link */}
            <div className="absolute bottom-8 left-8 md:left-12">
                <Link to="/" className="inline-flex items-center gap-2 text-[#1f2937]/80 hover:text-[#3b82f6] transition-colors font-bold group text-sm">
                    <div className="w-7 h-7 rounded-full bg-white border border-[#dadada] flex items-center justify-center group-hover:bg-[#3b82f6] group-hover:border-[#3b82f6] group-hover:text-white transition-all">
                        <ArrowLeft className="w-3.5 h-3.5" />
                    </div>
                    Back to Home
                </Link>
            </div>
        </div>
    );
}
