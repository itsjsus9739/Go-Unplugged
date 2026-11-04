package expo.modules.appblocker

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import java.time.LocalDate
import java.time.ZoneId

object UsageStatsHelper {
  fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.unsafeCheckOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  /**
   * Milisegundos en primer plano desde la medianoche local, por paquete.
   * Se calcula con eventos RESUMED/PAUSED (más preciso que los buckets diarios).
   */
  fun foregroundMillisToday(context: Context, packages: Set<String>? = null): Map<String, Long> {
    if (!hasUsageAccess(context)) return emptyMap()
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val start = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    val end = System.currentTimeMillis()

    val events = usm.queryEvents(start, end)
    val totals = HashMap<String, Long>()
    val resumedAt = HashMap<String, Long>()
    val e = UsageEvents.Event()

    while (events.hasNextEvent()) {
      events.getNextEvent(e)
      val pkg = e.packageName ?: continue
      if (packages != null && pkg !in packages) continue
      when (e.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> resumedAt[pkg] = e.timeStamp
        UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
          resumedAt.remove(pkg)?.let { totals[pkg] = (totals[pkg] ?: 0L) + (e.timeStamp - it) }
        }
      }
    }
    // Sigue abierta ahora mismo
    resumedAt.forEach { (pkg, t) -> totals[pkg] = (totals[pkg] ?: 0L) + (end - t) }
    return totals
  }
}
