import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface NavigationProps {
    isDark?: boolean;
}

export function Navigation({ isDark = false }: NavigationProps) {
    const [scrolled, setScrolled] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20)
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const handleLoginClick = () => {
        navigate('/login')
        setIsMobileMenuOpen(false)
    };

    const isSolid = scrolled || isDark;

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-[10000] transition-all duration-300 font-display ${isSolid
                ? 'py-3 bg-white/90 backdrop-blur-md border-b border-[#dadada] shadow-sm'
                : 'py-5 bg-transparent border-transparent'
                }`}
        >
            <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                    <span className={`text-xl md:text-2xl font-display font-bold tracking-tighter transition-colors ${isSolid ? 'text-[#1f2937]' : 'text-white'
                        }`}>
                        Talent<span className="text-[#3b82f6] font-leckerli">Ops</span>
                    </span>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex gap-8">
                    {[
                        { name: 'Problem', href: '/#problem' },
                        { name: 'Services', href: '/#services' },
                        { name: 'How It Works', href: '/#approach' },
                        { name: 'Foundations', href: '/#foundations' },
                        { name: 'Pricing', href: '/pricing', isLink: true },
                        { name: 'Results', href: '/#results' }
                    ].map((item) => (
                        item.isLink ? (
                            <button
                                key={item.name}
                                onClick={() => navigate(item.href)}
                                className={`text-[15px] font-display font-medium transition-colors ${isSolid
                                    ? 'text-[#1f2937]/70 hover:text-[#3b82f6]'
                                    : 'text-white/80 hover:text-white'
                                    }`}
                            >
                                {item.name}
                            </button>
                        ) : (
                            <a
                                key={item.name}
                                href={item.href}
                                className={`text-[15px] font-display font-medium transition-colors ${isSolid
                                    ? 'text-[#1f2937]/70 hover:text-[#3b82f6]'
                                    : 'text-white/80 hover:text-white'
                                    }`}
                            >
                                {item.name}
                            </a>
                        )
                    ))}
                </div>

                {/* Desktop Buttons */}
                <div className="hidden md:flex items-center gap-4">
                    <button
                        onClick={handleLoginClick}
                        className={`text-[15px] font-display font-bold transition-colors px-4 py-2 ${isSolid
                            ? 'text-[#1f2937] hover:text-[#3b82f6]'
                            : 'text-white hover:text-white/80'
                            }`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => navigate('/request-demo')}
                        className="bg-[#3b82f6] text-white px-6 py-2.5 rounded-full font-display font-bold text-[15px] hover:bg-[#2563eb] transition-all shadow-sm hover:shadow-md"
                    >
                        Request a Demo
                    </button>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className={`md:hidden p-2 transition-colors ${scrolled ? 'text-[#1f2937]' : 'text-white'}`}
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    <div className="w-6 h-5 flex flex-col justify-between">
                        <span className={`w-full h-0.5 bg-current transition-all ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                        <span className={`w-full h-0.5 bg-current transition-all ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
                        <span className={`w-full h-0.5 bg-current transition-all ${isMobileMenuOpen ? '-rotate-45 -translate-y-2.5' : ''}`} />
                    </div>
                </button>
            </div>

            {/* Mobile Menu Content */}
            {isMobileMenuOpen && (
                <div className="absolute top-full left-0 right-0 bg-white border-b border-[#dadada] flex flex-col p-6 gap-4 md:hidden shadow-xl animate-in fade-in slide-in-from-top-4">
                    {[
                        { name: 'Problem', href: '#problem' },
                        { name: 'Services', href: '#services' },
                        { name: 'How It Works', href: '#approach' },
                        { name: 'Industries', href: '#industries' },
                        { name: 'Foundations', href: '#foundations' },
                        { name: 'Results', href: '#results' }
                    ].map((item) => (
                        <a
                            key={item.name}
                            href={item.href}
                            className="text-lg font-display font-semibold text-[#1f2937]"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {item.name}
                        </a>
                    ))}
                    <div className="flex flex-col gap-4 pt-4 border-t border-[#dadada]">
                        <button onClick={handleLoginClick} className="text-lg font-display font-semibold text-left text-[#1f2937]">Sign In</button>
                        <button
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                navigate('/request-demo');
                            }}
                            className="bg-[#3b82f6] text-white px-6 py-3 rounded-xl font-display font-bold text-center"
                        >
                            Request a Demo
                        </button>
                    </div>
                </div>
            )}
        </nav>
    )
}
