import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useInView } from 'motion/react';

const reasons = [
  'Deep expertise in talent operations, not generic HR advice',
  'Systems built to scale with you, not quick fixes',
  'Hands-on help with implementation, not just strategy documents',
  'Data-driven insights that get better over time',
  'Proven results across different industries and team sizes',
  'We work with you to build internal capability'
];

function AnimatedStat({ value, suffix, isInView }: { value: number; suffix: string; isInView: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000;
    const steps = 50;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return <span>{count}{suffix}</span>;
}

export default function WhyTalentOps() {
  const statsRef = React.useRef(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.5 });

  return (
    <section id="about" className="py-32 px-6 lg:px-12 bg-[#f7f7f9]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="text-[42px] md:text-[48px] lg:text-[52px] mb-6 text-[#1f2937] font-heading font-semibold tracking-tight leading-[1.15]">
              Why TalentOps
            </h2>
            <p className="text-[18px] text-[rgba(31,41,55,0.85)] font-serif leading-[1.7] mb-8 max-w-[640px]">
              We don't just advise—we build, implement, and optimize alongside you.
            </p>
            <div className="space-y-4">
              {reasons.map((reason, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle2 className="w-6 h-6 text-[#a5c9ff] flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-[#121212] opacity-80">{reason}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <motion.div
              ref={statsRef}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
              className="aspect-square rounded-2xl bg-gradient-to-br from-[#a5c9ff] to-[#e3f2fd] p-12 flex items-center justify-center shadow-xl"
            >
              <div className="text-center">
                <div className="text-6xl md:text-7xl text-[#121212] mb-4 tracking-tight">
                  <AnimatedStat value={100} suffix="+" isInView={statsInView} />
                </div>
                <div className="text-xl text-[#121212] opacity-80">Organizations Transformed</div>
                <div className="mt-8 pt-8 border-t border-[#121212] opacity-20">
                  <div className="text-4xl text-[#121212] mb-2 tracking-tight">
                    <AnimatedStat value={15} suffix="+" isInView={statsInView} />
                  </div>
                  <div className="text-[#121212] opacity-60">Years Combined Experience</div>
                </div>
              </div>
            </motion.div>

            {/* Decorative elements */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="absolute -top-4 -right-4 w-24 h-24 border-2 border-[#a5c9ff] rounded-xl -z-10"
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="absolute -bottom-4 -left-4 w-24 h-24 border-2 border-[#ffe2de] rounded-xl -z-10"
            ></motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
