import React from 'react';
import { AlertCircle, Users, BarChart3, TrendingDown, Workflow, Target } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';

const painPoints = [
  {
    icon: AlertCircle,
    title: "Unclear Roles and Ownership",
    description: "People don’t know who is accountable for what. Work overlaps in some areas and falls through gaps in others, slowing decisions and execution."
  },
  {
    icon: Users,
    title: "Hiring Without Accurate Capacity Insight",
    description: "Recruitment decisions are driven by urgency instead of data. Some teams become overstaffed while critical skill gaps remain unfilled."
  },
  {
    icon: BarChart3,
    title: "Late Detection of Performance Issues",
    description: "Problems surface only after targets are missed or clients complain, making recovery costly and disruptive."
  },
  {
    icon: TrendingDown,
    title: "Unexpected Attrition of Key Employees",
    description: "High-impact employees leave without warning due to burnout, disengagement, or external offers, taking critical knowledge with them."
  },
  {
    icon: Workflow,
    title: "Limited Visibility for Managers and Leaders",
    description: "Leaders lack real-time insight into workload, progress, and risks, forcing decisions based on incomplete or outdated information."
  },
  {
    icon: Target,
    title: "Disconnected HR, Operations, and Finance Systems",
    description: "Workforce data is scattered across tools that don’t integrate, causing misalignment between staffing, budgets, and execution plans."
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
      className="p-8 border border-[#dadada] rounded-xl transition-all bg-white cursor-pointer gpu-accel"
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
    <section id="problem" className="py-20 px-6 lg:px-12 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-[32px] md:text-[38px] lg:text-[42px] mb-12 text-[#1f2937] font-heading font-semibold tracking-tight leading-[1.15] text-center"
        >
          Why Workforce Management Gets Harder at Scale
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {painPoints.map((point, index) => (
            <PainPointCard key={index} point={point} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
