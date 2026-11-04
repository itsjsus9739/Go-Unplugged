import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity

/// Traduce la configuración (reglas + desbloqueos aprobados) a la Screen Time API:
///  * "rule.<id>"   : actividad diaria con un evento al llegar a dailyLimitMinutes.
///  * "window.<id>" : franja de bloqueo total (block_start–block_end).
///  * "grant.<id>"  : desbloqueo aprobado por el socio; al terminar se vuelve a escudar.
/// Los escudos los pone/quita la extensión DeviceActivityMonitor (corre aunque la app esté cerrada).
enum ShieldManager {
  static let center = DeviceActivityCenter()

  static func store(_ ruleId: String) -> ManagedSettingsStore {
    ManagedSettingsStore(named: ManagedSettingsStore.Name("rule.\(ruleId)"))
  }

  static func shield(ruleId: String) {
    guard let selection = SharedStore.loadSelection(ruleId: ruleId) else { return }
    let s = store(ruleId)
    s.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    s.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    s.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
  }

  static func unshield(ruleId: String) {
    store(ruleId).clearAllSettings()
  }

  static func apply(_ config: BlockingConfig) throws {
    center.stopMonitoring()
    guard config.protectionEnabled ?? true else {
      config.rules.forEach { unshield(ruleId: $0.id) }
      return
    }

    let now = Date()
    let cal = Calendar.current

    for rule in config.rules where rule.isActive ?? true {
      guard let selection = SharedStore.loadSelection(ruleId: rule.id) else { continue }

      // Límite diario
      let daily = DeviceActivitySchedule(
        intervalStart: DateComponents(hour: 0, minute: 0),
        intervalEnd: DateComponents(hour: 23, minute: 59),
        repeats: true
      )
      let event = DeviceActivityEvent(
        applications: selection.applicationTokens,
        categories: selection.categoryTokens,
        webDomains: selection.webDomainTokens,
        threshold: DateComponents(minute: max(1, rule.dailyLimitMinutes))
      )
      try center.startMonitoring(
        DeviceActivityName("rule.\(rule.id)"),
        during: daily,
        events: [DeviceActivityEvent.Name("limit"): event]
      )

      // Franja de bloqueo
      if let start = rule.blockStart.flatMap(parseTime), let end = rule.blockEnd.flatMap(parseTime) {
        try center.startMonitoring(
          DeviceActivityName("window.\(rule.id)"),
          during: DeviceActivitySchedule(intervalStart: start, intervalEnd: end, repeats: true)
        )
      }

      // Desbloqueo aprobado vigente: quitar escudo y programar el regreso.
      if let grant = config.grants.first(where: { g in
        g.endsAt / 1000 > now.timeIntervalSince1970 && (g.ruleId == nil || g.ruleId == rule.id)
      }) {
        unshield(ruleId: rule.id)
        let endsAt = Date(timeIntervalSince1970: grant.endsAt / 1000)
        // DeviceActivity exige intervalos de >= 15 min: se usa un evento con el umbral real.
        let intervalEnd = max(endsAt, now.addingTimeInterval(15 * 60 + 60))
        let minutes = max(1, Int(ceil(endsAt.timeIntervalSince(now) / 60)))
        try center.startMonitoring(
          DeviceActivityName("grant.\(rule.id)"),
          during: DeviceActivitySchedule(
            intervalStart: cal.dateComponents([.hour, .minute, .second], from: now),
            intervalEnd: cal.dateComponents([.hour, .minute, .second], from: intervalEnd),
            repeats: false
          ),
          events: [DeviceActivityEvent.Name("grant_used"): DeviceActivityEvent(
            applications: selection.applicationTokens,
            categories: selection.categoryTokens,
            webDomains: selection.webDomainTokens,
            threshold: DateComponents(minute: minutes)
          )]
        )
      }
    }
  }

  private static func parseTime(_ s: String) -> DateComponents? {
    let parts = s.split(separator: ":").compactMap { Int($0) }
    guard parts.count >= 2 else { return nil }
    return DateComponents(hour: parts[0], minute: parts[1])
  }
}
