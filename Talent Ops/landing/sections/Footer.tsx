import React from 'react';
import { Mail, Linkedin, Twitter } from 'lucide-react';
import { motion, useInView } from 'framer-motion';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#dadada] py-16 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12"
        >
          {/* Company Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div className="text-2xl tracking-tight text-[#121212] mb-4">
              <span className="font-semibold">Talent</span>
              <span className="font-light">Ops</span>
            </div>
            <p className="text-[#121212] opacity-60 leading-relaxed mb-6">
              Clear talent operations for growing teams. We design, build, and optimize your people systems.
            </p>
            <div className="flex gap-4">
              {[Linkedin, Twitter, Mail].map((Icon, index) => (
                <motion.a
                  key={index}
                  href="#"
                  whileHover={{ scale: 1.15, backgroundColor: "#a5c9ff" }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="w-10 h-10 rounded-full bg-[#e3f2fd] flex items-center justify-center"
                >
                  <Icon className="w-5 h-5 text-[#121212]" />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <h3 className="text-lg mb-4 text-[#121212]">Quick Links</h3>
            <ul className="space-y-3">
              {[
                { name: 'Problem', href: '#problem' },
                { name: 'Services', href: '#services' },
                { name: 'How It Works', href: '#approach' },
                { name: 'Industries', href: '#industries' },
                { name: 'Results', href: '#results' },
                { name: 'About', href: '#about' }
              ].map((link, index) => (
                <li key={link.name}>
                  <motion.a
                    href={link.href}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.05, duration: 0.4 }}
                    whileHover={{ x: 5, opacity: 1 }}
                    className="text-[#121212] opacity-60 capitalize inline-block"
                  >
                    {link.name}
                  </motion.a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <h3 className="text-lg mb-4 text-[#121212]">Get in Touch</h3>
            <ul className="space-y-3">
              <li className="text-[#121212] opacity-60">
                hello@talentops.co
              </li>
              <li className="text-[#121212] opacity-60">
                +1 (555) 123-4567
              </li>
              <li className="text-[#121212] opacity-60">
                San Francisco, CA
              </li>
            </ul>
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: "#2a2a2a" }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="mt-6 bg-[#121212] text-white px-6 py-3 rounded-lg text-sm"
            >
              Book a Strategy Call
            </motion.button>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="pt-8 border-t border-[#dadada] flex flex-col md:flex-row justify-between items-center gap-4"
        >
          <p className="text-[#121212] opacity-60 text-sm">
            © 2026 TalentOps. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            {['Privacy Policy', 'Terms of Service'].map((item) => (
              <motion.a
                key={item}
                href="#"
                whileHover={{ opacity: 1 }}
                className="text-[#121212] opacity-60"
              >
                {item}
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
