/**
 * Extensión DeviceActivityMonitor (iOS): pone/quita los escudos de Screen Time
 * aunque la app esté cerrada. La genera @bacons/apple-targets en `expo prebuild`.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'device-activity-monitor',
  name: 'GoUnpluggedMonitor',
  deploymentTarget: '16.4',
  frameworks: ['DeviceActivity', 'ManagedSettings', 'FamilyControls'],
  entitlements: {
    'com.apple.developer.family-controls': true,
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
