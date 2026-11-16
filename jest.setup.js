// Stand-ins for native modules that have no test version, so screens and
// helpers that import them load in Jest. Nothing here plays sound or reads GPS.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({ play: () => undefined, seekTo: () => Promise.resolve(), remove: () => undefined }),
  setAudioModeAsync: () => Promise.resolve(),
}));
jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  ActivityType: { AutomotiveNavigation: 2 },
  requestForegroundPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
  hasServicesEnabledAsync: () => Promise.resolve(false),
  hasStartedLocationUpdatesAsync: () => Promise.resolve(false),
  startLocationUpdatesAsync: () => Promise.resolve(),
  stopLocationUpdatesAsync: () => Promise.resolve(),
}));
jest.mock('expo-task-manager', () => ({ defineTask: () => undefined }));
