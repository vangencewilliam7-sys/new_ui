import React from 'react';
import { AlertCircle, Users, BarChart3, TrendingDown, Workflow } from 'lucide-react';
import { motion } from 'motion/react';
import { useInView } from 'motion/react';

const painPoints = [
  {
    icon: AlertCircle,
    title: 'No Clear Ownership',
    description: 'When roles are blurry, tasks fall through the cracks and progress slows down.'
  },
  {
    icon: Users,
    title: 'Disjointed Processes',
    description: 'Hiring, onboarding, and performance reviews feel separate instead of one smooth system.'
  },
  {
    icon: BarChart3,
    title: 'Lack of Real Insight',
    description: 'Managing on instinct instead of data makes it hard to see where the team is struggling.'
  },
  {
    icon: TrendingDown,
    title: 'Losing Great People',
    description: 'Talent often leaves because of small, fixable issues that were never noticed.'
  },
  {
    icon: Workflow,
    title: 'Growing Inefficiency',
    description: 'As you scale, small problems compound and make daily operations more difficult.'
  }
];

function PainPointCard({ point, index }: { point: typeof painPoints[0]; index: number }) {
  const Icon = point.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5, boxShadow: "0 15px 30px rgba(18, 18, 18, 0.08)" }}
      className="p-8 border border-[#dadada] rounded-xl transition-all bg-white cursor-pointer"
    >
      <motion.div
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.2 }}
        className="w-12 h-12 rounded-full bg-[#e3f2fd] flex items-center justify-center mb-4"
      >
        <Icon className="w-6 h-6 text-[#121212]" />
      </motion.div>
      <h3 className="text-[24px] md:text-[26px] mb-4 text-[#1f2937] font-heading font-semibold tracking-tight leading-[1.2]">
        {point.title}
      </h3>
      <p className="text-[18px] md:text-[18px] text-[rgba(31,41,55,0.85)] font-serif leading-[1.7] max-w-[640px]">
        {point.description}
      </p>
    </motion.div>
  );
}

export default function Problem() {
  return (
    <section id="problem" className="py-32 px-6 lg:px-12 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-[42px] md:text-[48px] lg:text-[52px] mb-6 text-[#1f2937] font-heading font-semibold tracking-tight leading-[1.15]">
            Why Scaling Often Feels Difficult
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {painPoints.map((point, index) => (
            <PainPointCard key={index} point={point} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
