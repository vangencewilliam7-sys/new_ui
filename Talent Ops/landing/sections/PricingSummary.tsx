import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

const plans = [
    {
        name: "Starter",
        size: "Under 10",
        price: "$499",
        description: "Perfect for early-stage teams"
    },
    {
        name: "Growth",
        size: "Up to 25",
        price: "$999",
        description: "Scaling workforce systems"
    },
    {
        name: "Scale",
        size: "Up to 50",
        price: "$1,899",
        description: "High-growth operations"
    },
    {
        name: "Enterprise",
        size: "50+",
        price: "Custom",
        description: "Tailored for large organizations"
    }
];

export default function PricingSummary() {
    const navigate = useNavigate();

    return (
        <section className="py-20 px-6 lg:px-12 bg-white relative">
            <div className="max-w-7xl mx-auto">
                <div className="text-center">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-3xl md:text-4xl font-heading font-semibold text-[#1f2937] mb-4"
                    >
                        Simple, Scalable Pricing
                    </motion.h2>
                    <p className="text-lg text-[rgba(31,41,55,0.7)] font-serif max-w-2xl mx-auto mb-10">
                        Transparent plans designed to scale with your workforce. AI features available as optional add-ons.
                    </p>

                    <motion.button
                        onClick={() => navigate('/pricing')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-10 py-4 bg-[#1f2937] text-white font-bold rounded-xl shadow-lg hover:bg-[#3b82f6] transition-all duration-300"
                    >
                        View Detailed Pricing
                    </motion.button>
                </div>
            </div>
        </section>
    );
}
