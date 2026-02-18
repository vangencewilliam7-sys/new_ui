import React from 'react'
import { useNavigate } from 'react-router-dom'

export function Footer() {
    const navigate = useNavigate()

    return (
        <footer className="bg-[#f7f7f9] text-[#1f2937] py-16 px-6 md:px-12 border-t border-[#dadada] font-sans">
            <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => navigate('/')}>
                        <span className="text-2xl font-extrabold tracking-tighter">
                            Talent<span className="text-[#3b82f6]">Ops</span>
                        </span>
                    </div>
                    <p className="text-[#1f2937]/60 text-lg leading-relaxed max-w-sm">
                        The intelligence layer for the modern workforce. Scale with clarity and precision.
                    </p>
                </div>

                <div>
                    <h5 className="text-sm font-bold tracking-widest uppercase text-[#1f2937] mb-6">
                        Product
                    </h5>
                    <ul className="space-y-4 text-sm font-medium text-[#1f2937]/60">
                        <li><a href="#problem" className="hover:text-[#3b82f6] transition-colors">Problem</a></li>
                        <li><a href="#services" className="hover:text-[#3b82f6] transition-colors">Services</a></li>
                        <li><a href="#how-it-works" className="hover:text-[#3b82f6] transition-colors">Process</a></li>
                        <li><a href="#impact" className="hover:text-[#3b82f6] transition-colors">Impact</a></li>
                    </ul>
                </div>

                <div>
                    <h5 className="text-sm font-bold tracking-widest uppercase text-[#1f2937] mb-6">
                        Legal
                    </h5>
                    <ul className="space-y-4 text-sm font-medium text-[#1f2937]/60">
                        <li><a href="#" className="hover:text-[#3b82f6] transition-colors">Privacy Policy</a></li>
                        <li><a href="#" className="hover:text-[#3b82f6] transition-colors">Terms of Service</a></li>
                        <li><a href="#" className="hover:text-[#3b82f6] transition-colors">Cookie Policy</a></li>
                    </ul>
                </div>
            </div>

            <div className="container mx-auto mt-16 pt-8 border-t border-[#dadada] flex flex-col md:flex-row justify-between items-center gap-4 text-sm font-medium text-[#1f2937]/40">
                <span>&copy; {new Date().getFullYear()} Talent Ops Platform. All rights reserved.</span>
            </div>
        </footer>
    )
}
