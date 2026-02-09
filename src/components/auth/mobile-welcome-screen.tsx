'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

interface WelcomeSlide {
  title: string
  description: string
  illustration: string
  bgGradient: string
}

const slides: WelcomeSlide[] = [
  {
    title: 'Find Top Construction Talent',
    description: 'AI-powered candidate sourcing and scoring for construction executives and skilled workers',
    illustration: '/construction-hero.svg',
    bgGradient: 'from-slate-900 via-slate-800 to-orange-900',
  },
  {
    title: 'Hire Smarter with AI',
    description: 'Automated resume analysis, candidate scoring, and personalized outreach campaigns',
    illustration: '/ai-hiring-hero.svg',
    bgGradient: 'from-orange-900 via-slate-800 to-slate-900',
  },
  {
    title: 'Build Your Team Faster',
    description: 'No recruiters needed. Source, score, and engage top talent automatically',
    illustration: '/team-building-hero.svg',
    bgGradient: 'from-slate-900 via-orange-900 to-slate-800',
  },
]

export function MobileWelcomeScreen() {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      router.push('/login')
    }
  }

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  const skipToLogin = () => {
    router.push('/login')
  }

  const currentSlideData = slides[currentSlide]

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Animated Background */}
      <motion.div
        key={currentSlide}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`absolute inset-0 bg-gradient-to-br ${currentSlideData.bgGradient}`}
      />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Content Container */}
      <div className="relative z-10 min-h-screen flex flex-col p-6 pt-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-auto">
          <div className="text-white text-lg font-semibold">
            VerticalHire
          </div>
          <button
            onClick={skipToLogin}
            className="text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center space-y-8 max-w-sm"
            >
              {/* Illustration */}
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                }}
                className="relative w-full max-w-[300px]"
              >
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-white/10 rounded-full blur-3xl" />
                <div className="relative">
                  <Image
                    src={currentSlideData.illustration}
                    alt={currentSlideData.title}
                    width={300}
                    height={300}
                    className="w-full h-auto"
                    priority
                  />
                </div>
              </motion.div>

              {/* Text Content */}
              <div className="space-y-4">
                <h1 className="text-3xl font-bold text-white leading-tight">
                  {currentSlideData.title}
                </h1>
                <p className="text-lg text-white/80 leading-relaxed">
                  {currentSlideData.description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation */}
        <div className="space-y-6 mt-auto">
          {/* Progress Dots */}
          <div className="flex justify-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className="group"
              >
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? 'w-8 bg-white'
                      : 'w-2 bg-white/40 group-hover:bg-white/60'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            {currentSlide > 0 && (
              <Button
                onClick={prevSlide}
                variant="ghost"
                size="lg"
                className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back
              </Button>
            )}
            <Button
              onClick={nextSlide}
              size="lg"
              className="flex-1 bg-white hover:bg-white/90 text-slate-900 font-semibold shadow-lg"
            >
              {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
              {currentSlide < slides.length - 1 && (
                <ChevronRight className="w-5 h-5 ml-1" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
