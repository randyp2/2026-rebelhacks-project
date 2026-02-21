"use client"

import * as React from "react"
import { RotateCcw, ArrowUpRight, Bell } from "lucide-react"
import { motion, type Transition } from "motion/react"
import { formatRiskScore, getRiskLevel } from "@/lib/risk/scoring"
import type { AlertRow } from "@/types/database"

type NotificationListProps = {
  alerts: AlertRow[]
  maxItems?: number
}

type NotificationItem = {
  id: string
  title: string
  subtitle: string
  time: string
  count?: number
}

const transition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 26,
}

const getCardVariants = (i: number) => ({
  collapsed: {
    marginTop: i === 0 ? 0 : -44,
    scaleX: 1 - i * 0.05,
  },
  expanded: {
    marginTop: i === 0 ? 0 : 4,
    scaleX: 1,
  },
})

const textSwitchTransition: Transition = {
  duration: 0.22,
  ease: "easeInOut",
}

const notificationTextVariants = {
  collapsed: { opacity: 1, y: 0, pointerEvents: "auto" },
  expanded: { opacity: 0, y: -16, pointerEvents: "none" },
}

const viewAllTextVariants = {
  collapsed: { opacity: 0, y: 16, pointerEvents: "none" },
  expanded: { opacity: 1, y: 0, pointerEvents: "auto" },
}

function formatAlertTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

function toNotificationItems(alerts: AlertRow[], maxItems: number): NotificationItem[] {
  const roomCounts = new Map<string, number>()
  for (const alert of alerts) {
    const roomKey = alert.room_id ?? `unassigned:${alert.id}`
    roomCounts.set(roomKey, (roomCounts.get(roomKey) ?? 0) + 1)
  }

  return alerts.slice(0, maxItems).map((alert) => {
    const roomKey = alert.room_id ?? `unassigned:${alert.id}`
    return {
      id: alert.id,
      title: alert.room_id ? `Room ${alert.room_id}` : "Unassigned room",
      subtitle:
        (alert.explanation ? truncateText(alert.explanation, 40) : null) ??
        `Risk ${formatRiskScore(alert.risk_score)} (${getRiskLevel(alert.risk_score)})`,
      time: formatAlertTime(alert.timestamp),
      count: (roomCounts.get(roomKey) ?? 0) > 1 ? roomCounts.get(roomKey) : undefined,
    }
  })
}

function NotificationList({ alerts, maxItems = 10 }: NotificationListProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const notifications = React.useMemo(
    () => toNotificationItems(alerts, maxItems),
    [alerts, maxItems]
  )
  const visibleNotifications = React.useMemo(
    () => notifications.slice(0, isExpanded ? maxItems : 3),
    [isExpanded, maxItems, notifications]
  )

  return (
    <motion.div
      className="w-full space-y-3 rounded-2xl border border-white/10 bg-[#0f1623] p-3 shadow-md"
      initial="collapsed"
      whileHover="expanded"
      onHoverStart={() => setIsExpanded(true)}
      onHoverEnd={() => setIsExpanded(false)}
    >
      <div>
        {visibleNotifications.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-slate-300">
              <Bell className="size-4" />
              <h1 className="text-sm font-medium">No active alerts</h1>
            </div>
            <div className="text-xs font-medium text-slate-500">All monitored rooms are clear.</div>
          </div>
        ) : (
          visibleNotifications.map((notification, i) => (
            <motion.div
              key={notification.id}
              initial={false}
              animate={isExpanded ? "expanded" : "collapsed"}
              className="relative rounded-xl border border-white/10 bg-[#172134] px-4 py-2 shadow-sm transition-shadow duration-200 hover:shadow-lg"
              variants={getCardVariants(i)}
              transition={transition}
              style={{
                zIndex: visibleNotifications.length - i,
              }}
            >
              <div className="flex items-center justify-between">
                <h1 className="text-sm font-medium text-slate-100">{notification.title}</h1>
                {notification.count && (
                  <div className="flex items-center gap-0.5 text-xs font-medium text-slate-400">
                    <RotateCcw className="size-3" />
                    <span>{notification.count}</span>
                  </div>
                )}
              </div>
              <div className="text-xs font-medium text-slate-500">
                <span>{notification.time}</span>
                &nbsp;•&nbsp;
                <span>{notification.subtitle}</span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex size-5 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
          {alerts.length}
        </div>
        <span className="grid">
          <motion.span
            className="col-start-1 row-start-1 text-sm font-medium text-slate-300"
            variants={notificationTextVariants}
            transition={textSwitchTransition}
          >
            Alerts
          </motion.span>
          <motion.span
            className="col-start-1 row-start-1 flex cursor-pointer select-none items-center gap-1 text-sm font-medium text-slate-300"
            variants={viewAllTextVariants}
            transition={textSwitchTransition}
          >
            View all <ArrowUpRight className="size-4" />
          </motion.span>
        </span>
      </div>
    </motion.div>
  )
}

export { NotificationList }
