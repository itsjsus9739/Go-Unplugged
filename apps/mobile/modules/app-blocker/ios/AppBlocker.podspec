Pod::Spec.new do |s|
  s.name           = 'AppBlocker'
  s.version        = '0.1.0'
  s.summary        = 'Go Unplugged: bloqueo de apps con Screen Time API (FamilyControls/ManagedSettings/DeviceActivity)'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Go Unplugged'
  s.homepage       = 'https://gounplugged.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'DeviceActivity', 'SwiftUI'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
