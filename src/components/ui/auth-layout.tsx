"use client"

import { Eye, EyeOff, Mail, Lock, LucideIcon } from "lucide-react";

// Animated Blob Component
interface AnimatedBlobProps {
  color: string;
  position: string;
  delay?: string;
}

export const AnimatedBlob = ({ color, position, delay = "" }: AnimatedBlobProps) => (
  <div className={`absolute ${position} w-72 h-72 ${color} rounded-full mix-blend-screen filter blur-xl opacity-70 animate-blob ${delay}`} />
);

// Gradient Wave Component
export const GradientWave = () => (
  <div className="absolute inset-0 opacity-20">
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 560">
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path fill="url(#gradient1)" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,218.7C672,235,768,245,864,234.7C960,224,1056,192,1152,186.7C1248,181,1344,203,1392,213.3L1440,224L1440,560L1392,560C1344,560,1248,560,1152,560C1056,560,960,560,864,560C768,560,672,560,576,560C480,560,384,560,288,560C192,560,96,560,48,560L0,560Z" />
    </svg>
  </div>
);

// Icon Badge Component
interface IconBadgeProps {
  icon: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
}

export const IconBadge = ({ icon, size = "md", variant = "light" }: IconBadgeProps) => {
  const sizes = {
    sm: "p-2",
    md: "p-3",
    lg: "p-4"
  };

  const variants = {
    light: "bg-white/10 backdrop-blur-sm text-white",
    dark: "bg-black/10 backdrop-blur-sm text-foreground"
  };

  return (
    <div className={`inline-flex rounded-full ${sizes[size]} ${variants[variant]} mb-4`}>
      {icon}
    </div>
  );
};

// Hero Section Component
interface HeroSectionProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  features?: string[];
}

export const HeroSection = ({ title, description, icon, features }: HeroSectionProps) => (
  <div className="text-center space-y-6 max-w-md">
    {icon && (
      <IconBadge icon={icon} size="lg" variant="light" />
    )}
    <h2 className="text-3xl lg:text-4xl font-bold text-white">
      {title}
    </h2>
    <p className="text-lg text-white/80">
      {description}
    </p>
    {features && features.length > 0 && (
      <div className="mt-8 space-y-4">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-3 text-white/90">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">{feature}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Gradient Background Component
interface GradientBackgroundProps {
  children: React.ReactNode;
}

export const GradientBackground = ({ children }: GradientBackgroundProps) => {
  return (
    <div className="hidden lg:flex flex-1 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" />

      <div className="absolute inset-0">
        <AnimatedBlob color="bg-purple-500/30" position="top-0 -left-4" />
        <AnimatedBlob color="bg-cyan-500/30" position="top-0 -right-4" delay="animation-delay-2000" />
        <AnimatedBlob color="bg-indigo-500/30" position="-bottom-8 left-20" delay="animation-delay-4000" />
      </div>

      <GradientWave />

      <div className="relative z-10 flex items-center justify-center p-8 lg:p-12 w-full">
        {children}
      </div>
    </div>
  );
};
