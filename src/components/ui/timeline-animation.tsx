'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef, type ElementType } from 'react'
import { cn } from '@/lib/utils'

interface TimelineContentProps {
  as?: ElementType
  animationNum?: number
  timelineRef?: React.RefObject<HTMLElement | HTMLDivElement | null>
  customVariants?: any
  className?: string
  children: React.ReactNode
}

export function TimelineContent({
  as: Component = 'div',
  animationNum = 0,
  timelineRef,
  customVariants,
  className,
  children,
  ...props
}: TimelineContentProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const defaultVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      transition: {
        delay: i * 0.2,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: 'blur(10px)',
      y: -20,
      opacity: 0,
    },
  }

  const variants = customVariants || defaultVariants

  return (
    <motion.div
      ref={ref}
      custom={animationNum}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      className={cn(className)}
      {...props}
    >
      {Component === 'div' ? children : <Component>{children}</Component>}
    </motion.div>
  )
}
