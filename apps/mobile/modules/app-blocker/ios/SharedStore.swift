import Foundation
import FamilyControls

/// Almacenamiento compartido con la extensión DeviceActivityMonitor vía App Group.
/// Mantener las claves en sincronía con targets/device-activity-monitor/DeviceActivityMonitorExtension.swift
enum SharedStore {
  static let appGroup = "group.com.gounplugged.app"
  static let configKey = "config"
  static let eventsKey = "events"

  static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }

  static func selectionKey(_ ruleId: String) -> String { "selection.\(ruleId)" }

  static func saveSelection(_ selection: FamilyActivitySelection, ruleId: String) throws {
    let data = try PropertyListEncoder().encode(selection)
    defaults.set(data, forKey: selectionKey(ruleId))
  }

  static func loadSelection(ruleId: String) -> FamilyActivitySelection? {
    guard let data = defaults.data(forKey: selectionKey(ruleId)) else { return nil }
    return try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
  }

  static func saveConfig(_ json: String) { defaults.set(json, forKey: configKey) }
  static func loadConfigRaw() -> String? { defaults.string(forKey: configKey) }

  static func consumeEvents() -> String {
    let raw = defaults.string(forKey: eventsKey) ?? "[]"
    defaults.set("[]", forKey: eventsKey)
    return raw
  }
}

/// Mismo formato JSON que Android (ver src/AppBlocker.types.ts).
struct BlockingConfig: Decodable {
  struct Rule: Decodable {
    let id: String
    let identifiers: [String]
    let dailyLimitMinutes: Int
    let activeDays: [Int]?
    let blockStart: String?
    let blockEnd: String?
    let isActive: Bool?
  }
  struct Grant: Decodable {
    let ruleId: String?
    let identifier: String?
    let endsAt: Double // epoch ms
  }
  let protectionEnabled: Bool?
  let rules: [Rule]
  let grants: [Grant]

  static func load() -> BlockingConfig? {
    guard let raw = SharedStore.loadConfigRaw(), let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(BlockingConfig.self, from: data)
  }
}
