package expo.modules.appblocker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDateTime
import java.time.LocalTime

/**
 * Configuración que la app JS sincroniza desde Supabase (limit_rules + rule_targets
 * + active_grants) y que el AccessibilityService consulta sin depender de la red.
 * Mantener en sincronía con `modules/app-blocker/src/AppBlocker.types.ts`.
 */
data class Rule(
  val id: String,
  val identifiers: Set<String>,
  val dailyLimitMinutes: Int,
  val activeDays: Set<Int>,          // ISO 1 = lunes … 7 = domingo
  val blockStart: LocalTime?,
  val blockEnd: LocalTime?,
  val isActive: Boolean
) {
  fun appliesToday(now: LocalDateTime) = isActive && now.dayOfWeek.value in activeDays

  fun inBlockWindow(now: LocalDateTime): Boolean {
    val start = blockStart ?: return false
    val end = blockEnd ?: return false
    val t = now.toLocalTime()
    return if (start <= end) t >= start && t < end else t >= start || t < end // cruza medianoche
  }
}

data class Grant(val ruleId: String?, val identifier: String?, val endsAtMillis: Long) {
  fun covers(rule: Rule, pkg: String, nowMillis: Long): Boolean {
    if (endsAtMillis <= nowMillis) return false
    if (identifier != null) return identifier == pkg
    if (ruleId != null) return ruleId == rule.id
    return true // urgencia global
  }
}

data class BlockingConfig(
  val protectionEnabled: Boolean,
  val rules: List<Rule>,
  val grants: List<Grant>
) {
  companion object {
    private const val PREFS = "gounplugged.appblocker"
    private const val KEY_CONFIG = "config"
    private const val KEY_EVENTS = "events"

    val EMPTY = BlockingConfig(false, emptyList(), emptyList())

    fun load(context: Context): BlockingConfig {
      val raw = prefs(context).getString(KEY_CONFIG, null) ?: return EMPTY
      return try { parse(raw) } catch (_: Exception) { EMPTY }
    }

    fun loadRaw(context: Context): String? = prefs(context).getString(KEY_CONFIG, null)

    fun save(context: Context, json: String) {
      parse(json) // valida antes de guardar
      prefs(context).edit().putString(KEY_CONFIG, json).apply()
    }

    fun parse(json: String): BlockingConfig {
      val o = JSONObject(json)
      val rules = o.optJSONArray("rules") ?: JSONArray()
      val grants = o.optJSONArray("grants") ?: JSONArray()
      return BlockingConfig(
        protectionEnabled = o.optBoolean("protectionEnabled", true),
        rules = (0 until rules.length()).map { i ->
          val r = rules.getJSONObject(i)
          Rule(
            id = r.getString("id"),
            identifiers = r.getJSONArray("identifiers").let { a -> (0 until a.length()).map { a.getString(it) }.toSet() },
            dailyLimitMinutes = r.getInt("dailyLimitMinutes"),
            activeDays = r.optJSONArray("activeDays")?.let { a -> (0 until a.length()).map { a.getInt(it) }.toSet() }
              ?: (1..7).toSet(),
            blockStart = r.optString("blockStart").takeIf { it.isNotEmpty() && it != "null" }?.let(LocalTime::parse),
            blockEnd = r.optString("blockEnd").takeIf { it.isNotEmpty() && it != "null" }?.let(LocalTime::parse),
            isActive = r.optBoolean("isActive", true)
          )
        },
        grants = (0 until grants.length()).map { i ->
          val g = grants.getJSONObject(i)
          Grant(
            ruleId = g.optString("ruleId").takeIf { it.isNotEmpty() && it != "null" },
            identifier = g.optString("identifier").takeIf { it.isNotEmpty() && it != "null" },
            endsAtMillis = g.getLong("endsAt")
          )
        }
      )
    }

    /** Eventos de bloqueo pendientes de leer por JS (para reportar `limit_reached`). */
    fun appendEvent(context: Context, event: JSONObject) {
      val p = prefs(context)
      val arr = JSONArray(p.getString(KEY_EVENTS, "[]"))
      arr.put(event)
      // Conserva solo los últimos 50
      val trimmed = JSONArray()
      for (i in maxOf(0, arr.length() - 50) until arr.length()) trimmed.put(arr.get(i))
      p.edit().putString(KEY_EVENTS, trimmed.toString()).apply()
    }

    fun consumeEvents(context: Context): String {
      val p = prefs(context)
      val raw = p.getString(KEY_EVENTS, "[]") ?: "[]"
      p.edit().putString(KEY_EVENTS, "[]").apply()
      return raw
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  }
}
