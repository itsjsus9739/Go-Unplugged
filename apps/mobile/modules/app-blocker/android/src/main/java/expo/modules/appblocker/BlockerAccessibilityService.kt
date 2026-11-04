package expo.modules.appblocker

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.net.Uri
import android.view.accessibility.AccessibilityEvent
import org.json.JSONObject
import java.time.LocalDateTime

/**
 * Detecta la app en primer plano y, si su regla está agotada (o dentro de la
 * franja de bloqueo) y no hay un desbloqueo aprobado vigente, manda al usuario
 * a la pantalla de bloqueo de Go Unplugged (gounplugged://blocked), desde donde
 * pide la extensión a su socio. No lee contenido de la pantalla.
 */
class BlockerAccessibilityService : AccessibilityService() {
  private var config: BlockingConfig = BlockingConfig.EMPTY
  private var configLoadedAt = 0L
  private var usageCache: Map<String, Long> = emptyMap()
  private var usageCachedAt = 0L
  private var lastBlocked: Pair<String, Long>? = null

  private val ignoredPackages by lazy {
    setOf(packageName, "com.android.systemui", "com.android.settings")
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    if (pkg in ignoredPackages) return

    val now = System.currentTimeMillis()
    if (now - configLoadedAt > CONFIG_TTL_MS) {
      config = BlockingConfig.load(this)
      configLoadedAt = now
    }
    if (!config.protectionEnabled) return

    val localNow = LocalDateTime.now()
    val rule = config.rules.firstOrNull { pkg in it.identifiers && it.appliesToday(localNow) } ?: return
    if (config.grants.any { it.covers(rule, pkg, now) }) return

    val inWindow = rule.inBlockWindow(localNow)
    val overLimit = !inWindow && usedMinutes(rule, now) >= rule.dailyLimitMinutes
    if (!inWindow && !overLimit) return

    // Evita rebotes si el sistema emite varios eventos seguidos.
    lastBlocked?.let { (p, t) -> if (p == pkg && now - t < 1500) return }
    lastBlocked = pkg to now

    BlockingConfig.appendEvent(this, JSONObject().apply {
      put("type", "limit_reached")
      put("identifier", pkg)
      put("ruleId", rule.id)
      put("reason", if (inWindow) "block_window" else "daily_limit")
      put("at", now)
    })

    performGlobalAction(GLOBAL_ACTION_HOME)
    val uri = Uri.parse("gounplugged://blocked")
      .buildUpon()
      .appendQueryParameter("app", pkg)
      .appendQueryParameter("rule", rule.id)
      .build()
    startActivity(
      Intent(Intent.ACTION_VIEW, uri)
        .setPackage(packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    )
  }

  private fun usedMinutes(rule: Rule, now: Long): Long {
    if (now - usageCachedAt > USAGE_TTL_MS) {
      val all = config.rules.flatMap { it.identifiers }.toSet()
      usageCache = UsageStatsHelper.foregroundMillisToday(this, all)
      usageCachedAt = now
    }
    return rule.identifiers.sumOf { usageCache[it] ?: 0L } / 60_000L
  }

  override fun onInterrupt() = Unit

  companion object {
    private const val CONFIG_TTL_MS = 5_000L
    private const val USAGE_TTL_MS = 20_000L
  }
}
