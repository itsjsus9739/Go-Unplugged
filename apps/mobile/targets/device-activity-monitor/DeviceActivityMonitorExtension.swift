import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

// Claves compartidas con modules/app-blocker/ios/SharedStore.swift (mismo App Group).
private let appGroup = "group.com.gounplugged.app"
private var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }

private func selection(_ ruleId: String) -> FamilyActivitySelection? {
  guard let data = defaults.data(forKey: "selection.\(ruleId)") else { return nil }
  return try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
}

private func store(_ ruleId: String) -> ManagedSettingsStore {
  ManagedSettingsStore(named: ManagedSettingsStore.Name("rule.\(ruleId)"))
}

private func shield(_ ruleId: String) {
  guard let sel = selection(ruleId) else { return }
  let s = store(ruleId)
  s.shield.applications = sel.applicationTokens.isEmpty ? nil : sel.applicationTokens
  s.shield.applicationCategories = sel.categoryTokens.isEmpty ? nil : .specific(sel.categoryTokens)
  s.shield.webDomains = sel.webDomainTokens.isEmpty ? nil : sel.webDomainTokens
}

private func unshield(_ ruleId: String) { store(ruleId).clearAllSettings() }

private func todayKey(_ ruleId: String) -> String {
  let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
  return "limitReached.\(ruleId).\(f.string(from: Date()))"
}

private func hasActiveGrant(_ ruleId: String) -> Bool {
  guard let raw = defaults.string(forKey: "config"), let data = raw.data(using: .utf8),
        let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let grants = obj["grants"] as? [[String: Any]] else { return false }
  let now = Date().timeIntervalSince1970 * 1000
  return grants.contains { g in
    let ends = (g["endsAt"] as? Double) ?? 0
    let rid = g["ruleId"] as? String
    return ends > now && (rid == nil || rid == ruleId)
  }
}

private func appendEvent(_ ruleId: String, reason: String) {
  var events = (try? JSONSerialization.jsonObject(
    with: (defaults.string(forKey: "events") ?? "[]").data(using: .utf8)!)) as? [[String: Any]] ?? []
  events.append([
    "type": "limit_reached", "identifier": "ios-selection:\(ruleId)", "ruleId": ruleId,
    "reason": reason, "at": Date().timeIntervalSince1970 * 1000,
  ])
  if let data = try? JSONSerialization.data(withJSONObject: Array(events.suffix(50))),
     let s = String(data: data, encoding: .utf8) {
    defaults.set(s, forKey: "events")
  }
}

/// Nombres de actividad: "rule.<id>", "window.<id>", "grant.<id>" (ver ShieldManager.swift).
class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  private func parse(_ activity: DeviceActivityName) -> (kind: String, ruleId: String)? {
    let parts = activity.rawValue.split(separator: ".", maxSplits: 1).map(String.init)
    return parts.count == 2 ? (parts[0], parts[1]) : nil
  }

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    guard let (kind, ruleId) = parse(activity) else { return }
    switch kind {
    case "rule": unshield(ruleId)              // nuevo día: contador en cero
    case "window": shield(ruleId); appendEvent(ruleId, reason: "block_window")
    default: break
    }
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    guard let (kind, ruleId) = parse(activity) else { return }
    switch kind {
    case "window" where !defaults.bool(forKey: todayKey(ruleId)): unshield(ruleId)
    case "grant" where defaults.bool(forKey: todayKey(ruleId)) && !hasActiveGrant(ruleId): shield(ruleId)
    default: break
    }
  }

  override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
    super.eventDidReachThreshold(event, activity: activity)
    guard let (kind, ruleId) = parse(activity) else { return }
    switch kind {
    case "rule":
      defaults.set(true, forKey: todayKey(ruleId))
      if !hasActiveGrant(ruleId) { shield(ruleId); appendEvent(ruleId, reason: "daily_limit") }
    case "grant":
      shield(ruleId) // se agotó el tiempo extra aprobado
    default: break
    }
  }
}
