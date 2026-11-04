package expo.modules.appblocker

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppBlockerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AppBlocker")

    Constant("platform") { "android" }

    AsyncFunction("getPermissionsAsync") {
      mapOf(
        "usageAccess" to UsageStatsHelper.hasUsageAccess(context),
        "accessibilityService" to isAccessibilityServiceEnabled(),
        "familyControls" to "unsupported"
      )
    }

    // En Android no hay un diálogo único: se abren las pantallas de Ajustes.
    AsyncFunction("requestAuthorizationAsync") {
      if (!UsageStatsHelper.hasUsageAccess(context)) openSettings(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      else if (!isAccessibilityServiceEnabled()) openSettings(Settings.ACTION_ACCESSIBILITY_SETTINGS)
      true
    }

    Function("openUsageAccessSettings") { openSettings(Settings.ACTION_USAGE_ACCESS_SETTINGS) }
    Function("openAccessibilitySettings") { openSettings(Settings.ACTION_ACCESSIBILITY_SETTINGS) }

    AsyncFunction("getLaunchableAppsAsync") {
      val pm = context.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      pm.queryIntentActivities(intent, 0)
        .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
        .filter { (pkg, _) -> pkg != context.packageName }
        .distinctBy { it.first }
        .sortedBy { it.second.lowercase() }
        .map { (pkg, label) -> mapOf("identifier" to pkg, "name" to label) }
    }

    AsyncFunction("getUsageTodayAsync") { identifiers: List<String>? ->
      UsageStatsHelper.foregroundMillisToday(context, identifiers?.toSet())
        .mapValues { (_, ms) -> (ms / 60_000L).toInt() }
    }

    AsyncFunction("setConfigAsync") { json: String ->
      BlockingConfig.save(context, json)
      true
    }

    Function("getConfig") { BlockingConfig.loadRaw(context) }

    Function("consumeBlockEvents") { BlockingConfig.consumeEvents(context) }

    // iOS-only: en Android se eligen apps con getLaunchableAppsAsync.
    AsyncFunction("presentAppPickerAsync") { _: String -> null }
  }

  private fun openSettings(action: String) {
    context.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  private fun isAccessibilityServiceEnabled(): Boolean {
    val expected = ComponentName(context, BlockerAccessibilityService::class.java)
    val enabled = Settings.Secure.getString(
      context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) ?: return false
    val splitter = TextUtils.SimpleStringSplitter(':').apply { setString(enabled) }
    return splitter.any { ComponentName.unflattenFromString(it) == expected }
  }
}
