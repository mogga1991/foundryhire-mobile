'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  actionUrl?: string | null
  metadata?: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

export interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  isConnected: boolean
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectDelayRef = useRef(1000) // Start with 1 second
  const MAX_RECONNECT_DELAY = 30000 // Max 30 seconds

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.read).length

  // Mark a single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      })

      if (response.ok) {
        // Optimistically update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        )
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to mark notification as read:', error)
      }
    }
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      })

      if (response.ok) {
        // Optimistically update local state
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true }))
        )
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to mark all notifications as read:', error)
      }
    }
  }, [])

  // Connect to SSE stream
  const connectToStream = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    try {
      const eventSource = new EventSource('/api/notifications/stream')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        // Reset reconnect delay on successful connection
        reconnectDelayRef.current = 1000
      }

      eventSource.onmessage = (event) => {
        try {
          const notification: Notification = JSON.parse(event.data)

          // Add new notification to the list
          setNotifications((prev) => {
            // Avoid duplicates
            if (prev.some((n) => n.id === notification.id)) {
              return prev
            }
            // Add to the beginning (newest first)
            return [notification, ...prev]
          })
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Failed to parse notification:', error)
          }
        }
      }

      eventSource.onerror = () => {
        setIsConnected(false)
        eventSource.close()

        // Exponential backoff reconnection
        const delay = Math.min(reconnectDelayRef.current, MAX_RECONNECT_DELAY)

        reconnectTimeoutRef.current = setTimeout(() => {
          // Double the delay for next attempt
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            MAX_RECONNECT_DELAY
          )
          connectToStream()
        }, delay)
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to connect to notification stream:', error)
      }
      setIsConnected(false)
    }
  }, [])

  // Fetch initial notifications on mount
  useEffect(() => {
    const fetchInitialNotifications = async () => {
      try {
        const response = await fetch('/api/notifications?limit=50')
        if (response.ok) {
          const data = await response.json()
          setNotifications(data.notifications || [])
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to fetch initial notifications:', error)
        }
      }
    }

    fetchInitialNotifications()
    connectToStream()

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [connectToStream])

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isConnected,
  }
}
