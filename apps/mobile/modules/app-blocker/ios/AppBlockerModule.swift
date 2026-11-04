import ExpoModulesCore
import FamilyControls
import SwiftUI
import UIKit

public class AppBlockerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppBlocker")

    Constant("platform") { "ios" }

    AsyncFunction("getPermissionsAsync") { () -> [String: Any] in
      [
        "usageAccess": false,
        "accessibilityService": false,
        "familyControls": Self.authorizationStatus()
      ]
    }

    // Requiere el entitlement com.apple.developer.family-controls (ver docs/MOVIL.md).
    AsyncFunction("requestAuthorizationAsync") { () async throws -> Bool in
      try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
      return AuthorizationCenter.shared.authorizationStatus == .approved
    }

    // iOS no deja listar apps instaladas: el usuario elige con FamilyActivityPicker y
    // recibimos tokens opacos que se guardan en el App Group (por regla).
    AsyncFunction("presentAppPickerAsync") { (ruleId: String, promise: Promise) in
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("E_NO_VC", "No hay una vista para presentar el selector")
        return
      }
      let initial = SharedStore.loadSelection(ruleId: ruleId) ?? FamilyActivitySelection()
      var host: UIViewController?
      let view = AppPickerView(initial: initial) { result in
        host?.dismiss(animated: true)
        guard let selection = result else { promise.resolve(nil); return }
        do {
          try SharedStore.saveSelection(selection, ruleId: ruleId)
          promise.resolve([
            "applications": selection.applicationTokens.count,
            "categories": selection.categoryTokens.count,
            "webDomains": selection.webDomainTokens.count
          ])
        } catch {
          promise.reject("E_SAVE", error.localizedDescription)
        }
      }
      host = UIHostingController(rootView: view)
      presenter.present(host!, animated: true)
    }.runOnQueue(.main)

    AsyncFunction("setConfigAsync") { (json: String) throws -> Bool in
      SharedStore.saveConfig(json)
      guard let config = BlockingConfig.load() else {
        throw Exception(name: "E_CONFIG", description: "Configuración inválida")
      }
      try ShieldManager.apply(config)
      return true
    }

    Function("getConfig") { SharedStore.loadConfigRaw() }
    Function("consumeBlockEvents") { SharedStore.consumeEvents() }

    // Sin equivalente en iOS (el uso se muestra con una extensión DeviceActivityReport).
    AsyncFunction("getLaunchableAppsAsync") { () -> [[String: String]] in [] }
    AsyncFunction("getUsageTodayAsync") { (_: [String]?) -> [String: Int] in [:] }
    Function("openUsageAccessSettings") { Self.openSettings() }
    Function("openAccessibilitySettings") { Self.openSettings() }
  }

  private static func authorizationStatus() -> String {
    switch AuthorizationCenter.shared.authorizationStatus {
    case .approved: return "approved"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }

  private static func openSettings() {
    DispatchQueue.main.async {
      if let url = URL(string: UIApplication.openSettingsURLString) {
        UIApplication.shared.open(url)
      }
    }
  }
}

struct AppPickerView: View {
  @State var selection: FamilyActivitySelection
  let onDone: (FamilyActivitySelection?) -> Void

  init(initial: FamilyActivitySelection, onDone: @escaping (FamilyActivitySelection?) -> Void) {
    _selection = State(initialValue: initial)
    self.onDone = onDone
  }

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Apps a limitar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { onDone(nil) } }
          ToolbarItem(placement: .confirmationAction) { Button("Guardar") { onDone(selection) } }
        }
    }
  }
}
