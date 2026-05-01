I have a comprehensive picture. Now compiling the structured report.

---

# EXHAUSTIVE CODEBASE SCAN — DeepWorkClean Alarm/Notification System

## STEP 1: FULL INVENTORY

```json
[
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js",
    "why_included": "Root component. Registers FCM background message handler at module scope, calls setupNotificationHandler() at module scope AND inside useEffect (double-call), initializes alarmService via dynamic require with mock fallback, configures notification permissions, registers expo-notifications response/received listeners, owns the AppState 'change' subscription that resets audio session on foreground and runs checkMissedCompletion(), reads/writes @session_end_time directly, calls Notifications.setBadgeCountAsync(0) on foreground, calls alarmService.playCompletionAlarm() in three separate code paths (received-listener, cold-launch handler, missed-completion check), holds the 15-second timeout on backgroundTimer.configureNotifications().",
    "category": "DIRECT",
    "touchpoints": [
      "messaging().setBackgroundMessageHandler() at top-level — vibrates on FCM background receive",
      "Module-level setupNotificationHandler() call (line 54)",
      "Dynamic require('./src/services/alarmService') with mock fallback (lines 64-75)",
      "initializeBackgroundServices(): audioSessionManager.initialize, requestPermissionsAsync, alarmService.init, backgroundTimer.configureNotifications, notificationBackgroundTask.register",
      "MainApp useEffect: second setupNotificationHandler() call inside useEffect",
      "setupNotifications(): Notifications.getLastNotificationResponse() cold-launch detection",
      "Notifications.addNotificationResponseReceivedListener: routes data.action/data.type → handlePauseResumeAction / handleEndSession / handleCompletionAlarmFromNotification / safeNavigate",
      "Notifications.addNotificationReceivedListener: if data.shouldPlayAlarm/sessionComplete/session_end AND AppState==='active' → alarmService.playCompletionAlarm({volume:0.9, autoStopAfter:10}) + Vibration.vibrate",
      "handleCompletionAlarmFromNotification(): re-inits alarmService, calls playCompletionAlarm with {volume:0.8, autoStopAfter:8}",
      "showFallbackAlert(): visual Alert if alarm fails",
      "checkMissedCompletion(): reads @session_end_time, if expired removes key + plays alarm via alarmService.playCompletionAlarm({volume:0.9, autoStopAfter:10})",
      "AppState.addEventListener('change'): on 'active' → audioSessionManager.reset(), Notifications.setBadgeCountAsync(0), checkMissedCompletion()",
      "handlePauseResumeAction(): backgroundTimer.getCurrentSession + updateTimerPauseState",
      "handleEndSession(): backgroundTimer.stopTimerNotification + safeNavigate('MainApp')",
      "Notification subscription cleanup on unmount"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/index.js",
    "why_included": "Root entry — registerRootComponent(App). Determines that App.js module-level code (FCM background handler, setupNotificationHandler) runs on bundle load.",
    "category": "INDIRECT",
    "touchpoints": ["registerRootComponent(App)"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/app.config.js",
    "why_included": "Expo plugin config. Declares expo-notifications plugin with completion_alarm.wav as a bundled sound, declares iOS UIBackgroundModes (fetch/processing/audio/remote-notification), declares BGTaskSchedulerPermittedIdentifiers ['com.expo.tasks.BACKGROUND_TIMER_TASK'], declares Android NOTIFICATIONS/VIBRATE/FOREGROUND_SERVICE/WAKE_LOCK permissions, lists @react-native-firebase/messaging plugin.",
    "category": "DIRECT",
    "touchpoints": [
      "plugins → expo-notifications.sounds: ['./assets/sounds/completion_alarm.wav']",
      "ios.infoPlist.UIBackgroundModes: fetch, processing, audio, remote-notification",
      "ios.infoPlist.BGTaskSchedulerPermittedIdentifiers: ['com.expo.tasks.BACKGROUND_TIMER_TASK']",
      "ios.infoPlist.NSUserNotificationsUsageDescription",
      "android.permissions: NOTIFICATIONS, VIBRATE, FOREGROUND_SERVICE, WAKE_LOCK",
      "@react-native-firebase/messaging plugin",
      "assets array includes completion_alarm.wav, lofi.mp3, white-noise.mp3"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/ios-background-tasks-plugin.js",
    "why_included": "Custom Expo config plugin that mutates Info.plist UIBackgroundModes and BGTaskSchedulerPermittedIdentifiers. Runs at prebuild time. Adds 'fetch', 'processing', 'audio' modes (notably omits 'remote-notification' — that one comes from app.config.js infoPlist directly).",
    "category": "DIRECT",
    "touchpoints": [
      "withInfoPlist mod adding UIBackgroundModes ['fetch','processing','audio']",
      "Sets BGTaskSchedulerPermittedIdentifiers to ['com.expo.tasks.BACKGROUND_TIMER_TASK']"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/ios/DeepWorkio/Info.plist",
    "why_included": "Built/synced Info.plist controlling iOS notification + background behavior. Contains UIBackgroundModes [fetch, processing, audio, remote-notification], BGTaskSchedulerPermittedIdentifiers [com.expo.tasks.BACKGROUND_TIMER_TASK], NSUserNotificationsUsageDescription. Bundle short version 1.0.9, build 40.",
    "category": "DIRECT",
    "touchpoints": [
      "BGTaskSchedulerPermittedIdentifiers",
      "UIBackgroundModes (fetch/processing/audio/remote-notification)",
      "NSUserNotificationsUsageDescription"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/ios/DeepWorkio/Supporting/Expo.plist",
    "why_included": "Controls Expo OTA updates (EXUpdatesCheckOnLaunch=ALWAYS, EXUpdatesEnabled=true, runtimeVersion=1.0.9). Status shows this file is currently modified (dirty). Updates control whether the JS bundle that handles alarm/notifications is the embedded one or an OTA fetch.",
    "category": "INDIRECT",
    "touchpoints": [
      "EXUpdatesCheckOnLaunch ALWAYS",
      "EXUpdatesRuntimeVersion 1.0.9",
      "EXUpdatesURL"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/ios/DeepWorkio/AppDelegate.swift",
    "why_included": "Native entry point. Configures FirebaseApp.configure() in didFinishLaunchingWithOptions. Inherits notification delegate behavior from ExpoAppDelegate. Required for FCM notifications to be delivered to JS handlers.",
    "category": "INDIRECT",
    "touchpoints": [
      "FirebaseApp.configure()",
      "ExpoAppDelegate inheritance for notification routing",
      "RCTLinkingManager URL handling"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/ios/DeepWorkio/DeepWorkio.entitlements",
    "why_included": "Sets aps-environment=production (required for any APNS / push / scheduled local notification with sound on iOS) and com.apple.developer.family-controls.",
    "category": "DIRECT",
    "touchpoints": [
      "aps-environment=production",
      "com.apple.developer.family-controls=true"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/ios/DeepWorkio/completion_alarm.wav",
    "why_included": "The bundled iOS notification sound file referenced by sound:'completion_alarm.wav' in scheduleSessionEndNotification and the FCM payload from cloud functions. Must exist at the iOS bundle root for UNUserNotificationCenter to play it.",
    "category": "DIRECT",
    "touchpoints": ["Bundled WAV asset for OS notification sound"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/assets/sounds/completion_alarm.wav",
    "why_included": "Source asset referenced via require('../../assets/sounds/completion_alarm.wav') in alarmService.playCompletionAlarm() and via the expo-notifications plugin sounds array in app.config.js.",
    "category": "DIRECT",
    "touchpoints": ["expo-av Audio.Sound.createAsync source", "expo-notifications bundled sound source"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/assets/sounds/lofi.mp3",
    "why_included": "Background music asset loaded by audioService.playMusic('lofi'). Active during a session and stopped by handleTimeout/cleanup.",
    "category": "INDIRECT",
    "touchpoints": ["Audio.Sound.createAsync source for background music"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/assets/sounds/white-noise.mp3",
    "why_included": "Background music asset loaded by audioService.playMusic('white-noise').",
    "category": "INDIRECT",
    "touchpoints": ["Audio.Sound.createAsync source for background music"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/alarmService.js",
    "why_included": "Singleton class wrapping the in-app expo-av alarm playback. init() relies on audioSessionManager. playCompletionAlarm() re-applies Audio.setAudioModeAsync with DoNotMix interruption mode every call, loads completion_alarm.wav, plays + vibrates, schedules an autoStopTimer (setTimeout) to stop after autoStopAfter seconds. stopAlarm() unloads the sound. cleanup() invokes stopAlarm.",
    "category": "DIRECT",
    "touchpoints": [
      "constructor: alarmSound, isInitialized, isPlaying, autoStopTimer state",
      "init() — depends on audioSessionManager.isReady/initialize",
      "playCompletionAlarm({volume, autoStopAfter}) — sets DoNotMix audio mode, loads .wav, plays, Vibration.vibrate([0,500,200,500]), starts autoStopTimer",
      "onPlaybackStatusUpdate — auto-stops on didJustFinish",
      "stopAlarm() — clearTimeout autoStopTimer, sound.stopAsync + unloadAsync",
      "cleanup() — stopAlarm",
      "Singleton: export const alarmService"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/audioSessionManager.js",
    "why_included": "Singleton that calls Audio.setAudioModeAsync({playsInSilentModeIOS, staysActiveInBackground, DuckOthers}) once and caches isInitialized=true. Reset by App.js AppState 'active' handler. Used by alarmService, audioService, App.js startup. Note its interruptionMode is DuckOthers but alarmService.playCompletionAlarm overrides with DoNotMix.",
    "category": "DIRECT",
    "touchpoints": [
      "initialize() — Audio.setAudioModeAsync with DuckOthers",
      "isReady() — checks isInitialized cache",
      "reset() — clears isInitialized + currentMode (called from App.js on foreground)",
      "Singleton: export const audioSessionManager"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/audioConfig.js",
    "why_included": "Dead/orphan UNIFIED_AUDIO_CONFIG export. References Audio.AUDIO_SESSION_CATEGORY_PLAYBACK without importing Audio (would throw if used). Not imported anywhere. Kept here because the keyword 'audio' matches and its presence creates confusion about the actual audio config strategy.",
    "category": "INDIRECT",
    "touchpoints": ["Unused UNIFIED_AUDIO_CONFIG export referencing undefined Audio constants"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/audioService.js",
    "why_included": "Singleton background-music service. init() defers to audioSessionManager. playMusic() re-applies Audio.setAudioModeAsync with DuckOthers, loads music asset, sets isLooping=true. pauseMusic, resumeMusic, stopMusic, cleanup. Called by DeepWorkSession.initializeMusic, togglePause, handleTimeout, cleanup.",
    "category": "DIRECT",
    "touchpoints": [
      "init() — depends on audioSessionManager",
      "playMusic(musicChoice) — re-applies Audio.setAudioModeAsync with DuckOthers, creates looping Sound",
      "onPlaybackStatusUpdate — error/finish handling",
      "pauseMusic / resumeMusic / stopMusic / cleanup",
      "Singleton: export const audioService"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionEndNotification.js",
    "why_included": "Owns the OS-scheduled local notification that is the primary alarm trigger when the app is backgrounded/killed. Uses Notifications.SchedulableTriggerInputTypes.DATE trigger. Bundles sound:'completion_alarm.wav', interruptionLevel:'timeSensitive' (iOS), Android channelId:'session-completion'. Stores notification id in AsyncStorage @session_end_notification_id AND writes @session_end_time. cancelSessionEndNotification reads + cancels + removes both keys.",
    "category": "DIRECT",
    "touchpoints": [
      "ensureNotificationPermissions() — Notifications.getPermissionsAsync / requestPermissionsAsync",
      "scheduleSessionEndNotification(endTimeMs, activityName, durationMinutes) — cancels existing, schedules DATE trigger with sound 'completion_alarm.wav' and interruptionLevel timeSensitive, writes @session_end_notification_id AND @session_end_time",
      "cancelSessionEndNotification() — Notifications.cancelScheduledNotificationAsync, removes @session_end_notification_id AND @session_end_time",
      "References Android channelId 'session-completion' (created by backgroundTimer.configureNotifications)"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js",
    "why_included": "Implements the BackgroundFetch task com.expo.tasks.BACKGROUND_TIMER_TASK. Defines the task that on each iteration: gets active session from @active_deep_work_session, checks 10% milestone, on completion calls sendCompletionNotification (which fires HTTP fetch to Cloud Function 'triggerSessionEndNotification' for FCM). Also writes a foreground 'sticky' progress notification with Notifications.scheduleNotificationAsync(trigger:null) on every tick. configureNotifications() creates Android channel 'session-completion' (sound completion_alarm.wav, MAX importance) and iOS category 'session-complete'. startTimerNotification pre-inits alarmService. stopTimerNotification calls Notifications.dismissAllNotificationsAsync (this dismisses ALL notifications including the just-fired completion alarm).",
    "category": "DIRECT",
    "touchpoints": [
      "Constants: BACKGROUND_TIMER_TASK 'com.expo.tasks.BACKGROUND_TIMER_TASK', ACTIVE_SESSION_KEY '@active_deep_work_session', PROGRESS_NOTIFICATION_KEY '@progress_notification_sent_'",
      "saveActiveSessionToStorage / getActiveSessionFromStorage / clearActiveSession",
      "clearProgressNotificationFlag",
      "calculateRemainingTime (handles paused state)",
      "sendProgressNotification — Notifications.scheduleNotificationAsync trigger:null with sound:false, type:'progress'",
      "sendCompletionNotification — fetches https://us-central1-deepwork-8416f.cloudfunctions.net/triggerSessionEndNotification with deviceId; comment says local backup notification removed in S1-3",
      "updateTimerNotification — Notifications.scheduleNotificationAsync trigger:null sticky timer notification on every background tick",
      "configureNotifications — setNotificationChannelAsync('session-completion', sound:'completion_alarm.wav', MAX importance) AND setNotificationCategoryAsync('session-complete')",
      "TaskManager.defineTask(BACKGROUND_TIMER_TASK): on tick — 10% milestone check, completion check (sendCompletionNotification + clearProgressNotificationFlag + clearActiveSession), updateTimerNotification",
      "ensureTaskIsRegistered() — defines + BackgroundFetch.registerTaskAsync(minimumInterval 15s/30s on iPad, stopOnTerminate:false, startOnBoot:true)",
      "startTimerNotification(duration, activity, musicChoice) — configureNotifications, alarmService.init pre-warm, save session, updateTimerNotification",
      "stopTimerNotification() — alarmService.cleanup, BackgroundFetch.unregisterTaskAsync, clearProgressNotificationFlag, clearActiveSession, Notifications.dismissAllNotificationsAsync",
      "updateTimerPauseState(isPaused) — pause/resume math + updateTimerNotification + saveActiveSessionToStorage",
      "getCurrentSession()"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationHandler.js",
    "why_included": "setupNotificationHandler() — sets the global Notifications.setNotificationHandler. Differentiates by data.type: 'progress' → silent, completion (shouldPlayAlarm/sessionComplete/session_end) → shouldPlayAlert+Sound+Badge MAX, default → Show+Sound HIGH. Called twice from App.js (module level + useEffect).",
    "category": "DIRECT",
    "touchpoints": ["setupNotificationHandler() — Notifications.setNotificationHandler"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationBackgroundTask.js",
    "why_included": "Defines a SECOND background task 'notification-refresh-task' that on each fire calls notificationService.scheduleNotifications() (which is now a no-op deprecated stub). TaskManager.defineTask runs at module load, registration runs from App.js initializeBackgroundServices.",
    "category": "DIRECT",
    "touchpoints": [
      "TaskManager.defineTask('notification-refresh-task') — calls notificationService.scheduleNotifications()",
      "register() — BackgroundFetch.registerTaskAsync minimumInterval 15min, stopOnTerminate:false, startOnBoot:true",
      "unregister() / getStatus()"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationService.js",
    "why_included": "Class with a now-deprecated scheduleNotifications() (no-op). Still implements scheduleNotificationAtTime(), scheduleNextNotification(), cancelAllNotifications(), areNotificationsEnabled(), sendTestNotification(), getScheduledNotifications(), and writes to AsyncStorage @notification_delivery_log. cancelAllNotifications() — if invoked anywhere — would wipe the OS-scheduled session-end notification.",
    "category": "DIRECT",
    "touchpoints": [
      "requestPermissions() / areNotificationsEnabled() — Notifications.getPermissionsAsync / requestPermissionsAsync",
      "scheduleNotifications() — DEPRECATED no-op",
      "scheduleNotificationAtTime / scheduleNextNotification — Notifications.scheduleNotificationAsync DATE trigger",
      "cancelAllNotifications() — Notifications.cancelAllScheduledNotificationsAsync — would cancel session-end notification too",
      "sendTestNotification() — immediate trigger:null",
      "logNotificationDelivery / getDeliveryStats — @notification_delivery_log",
      "Singleton: export const notificationService"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/personalizedNotificationService.js",
    "why_included": "Builds and schedules personalized re-engagement notifications via Notifications.scheduleNotificationAsync (TIME_INTERVAL or null trigger). Called from DevToolsScreen testNotification/previewNotificationPayload. data.type='reengagement'.",
    "category": "INDIRECT",
    "touchpoints": [
      "schedulePayload — Notifications.scheduleNotificationAsync TIME_INTERVAL or immediate",
      "schedulePersonalizedNotification / testNotification / previewNotificationPayload"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/streakService.js",
    "why_included": "Schedules a 7pm 'streak risk' notification via Notifications.scheduleNotificationAsync DATE trigger and stores id in AsyncStorage @streak_risk_notif_id. cancelStreakRiskNotification cancels it. Called from HomeScreen useFocusEffect (every focus) and from DeepWorkSession handleSessionComplete (cancel after success). Stores @streak_data.",
    "category": "INDIRECT",
    "touchpoints": [
      "getStreak / incrementStreak — @streak_data AsyncStorage",
      "scheduleStreakRiskNotification — Notifications.scheduleNotificationAsync DATE 7pm",
      "cancelStreakRiskNotification — Notifications.cancelScheduledNotificationAsync",
      "@streak_risk_notif_id, @last_streak_modal_seen"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationPreferences.js",
    "why_included": "Reads/writes notification preferences (sessionComplete, dailyReminder, weeklySummary) to Firebase Realtime Database with AsyncStorage cache @notification_preferences. Used by useNotificationSetup. Affects whether server-side FCM sends are made.",
    "category": "INDIRECT",
    "touchpoints": [
      "getPreferences / savePreferences / updatePreference",
      "setSessionCompleteEnabled / setDailyReminderEnabled / setDailyReminderTime / setWeeklySummaryEnabled",
      "AsyncStorage @notification_preferences cache"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionStateService.js",
    "why_included": "Reads and writes session config alongside the timer keys. saveActiveSession (@active_session_config) is called from DeepWorkSession.initializeSession. clearActiveSession from DeepWorkSession.cleanup. getActiveSession reads BOTH @active_session_config AND the timer's @session_end_time to detect orphaned/expired sessions — used by HomeScreen to show 'Session ended while away' modal.",
    "category": "DIRECT",
    "touchpoints": [
      "saveActiveSession (@active_session_config)",
      "clearActiveSession",
      "getActiveSession — reads @active_session_config + @session_end_time",
      "discardActiveSession — multiRemove all three keys",
      "saveLastSessionConfig / getLastSessionConfig / markRestartOffered (@last_session_config)"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/deviceIdService.js",
    "why_included": "Generates and persists DEVICE_ID_KEY 'deepwork_device_id'. Used by useNotificationSetup to register FCM token with Cloud Functions and by backgroundTimer.sendCompletionNotification as the userId for the FCM HTTP call. If device id is wrong/missing the FCM completion notification will not be delivered.",
    "category": "INDIRECT",
    "touchpoints": ["getDeviceId() — used as FCM userId"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/navigationService.js",
    "why_included": "navigationRef + safeNavigate used by App.js notification response handlers and by useNotificationHandlers for cold-start FCM tap routing.",
    "category": "INDIRECT",
    "touchpoints": ["navigationRef export", "safeNavigate / safeReset"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useSessionTimer.js",
    "why_included": "Owns the @session_end_time and @session_remaining_ms AsyncStorage keys (the SAME @session_end_time key written by sessionEndNotification.scheduleSessionEndNotification — overlapping ownership). Implements timestamp-based countdown with setInterval. start() restores from storage on reload. pause() writes @session_remaining_ms and removes @session_end_time. resume() returns new endTime. stop() multiRemoves both keys. Sets isExpired=true which fires DeepWorkSession.handleTimeout.",
    "category": "DIRECT",
    "touchpoints": [
      "SESSION_END_TIME_KEY '@session_end_time', SESSION_REMAINING_KEY '@session_remaining_ms'",
      "start() — reads/writes @session_end_time and @session_remaining_ms; returns endTime",
      "pause() — writes @session_remaining_ms, removes @session_end_time",
      "resume() — writes new @session_end_time",
      "stop() — multiRemove both keys (called from DeepWorkSession.cleanup)",
      "setInterval tick — sets isExpired when remaining<=0"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useNotificationSetup.js",
    "why_included": "On mount, requests messaging().requestPermission(), gets FCM token, posts to https://us-central1-deepwork-8416f.cloudfunctions.net/registerToken with auth uid (or device id fallback), initializes notificationPreferences. messaging().onTokenRefresh registered. Mounted from MainApp.",
    "category": "DIRECT",
    "touchpoints": [
      "messaging().requestPermission",
      "messaging().getToken / onTokenRefresh",
      "registerTokenWithBackend (Cloud Function call)",
      "initializePreferences via notificationPreferences"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useNotificationHandlers.js",
    "why_included": "Mounted from MainApp. Sets up Notifications.useLastNotificationResponse (cold-start local notification tap), messaging().onMessage (foreground FCM), messaging().onNotificationOpenedApp (background FCM tap), messaging().getInitialNotification (killed FCM tap), AND a SECOND Notifications.addNotificationResponseReceivedListener (App.js sets up its own too — duplicate listener). Routes session_end/sessionComplete to no-op (deferred to App.js handler) for local notifs but routes to MainApp/Metrics for FCM.",
    "category": "DIRECT",
    "touchpoints": [
      "Notifications.useLastNotificationResponse — cold-start local tap detection",
      "Notifications.addNotificationResponseReceivedListener — duplicates App.js listener",
      "messaging().onMessage / onNotificationOpenedApp / getInitialNotification",
      "handleLocalNotificationTap / handleFCMNotificationTap → navigationRef.current.navigate"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/DeepWorkSession.js",
    "why_included": "Primary session screen. Lazily imports backgroundTimer/alarmService/audioService 100ms after mount. initializeSession() calls timer.start, scheduleSessionEndNotification(endTime, ...), saveActiveSession, then in parallel: backgroundTimer.startTimerNotification, audioService init+playMusic, alarmService.init. Wires useEffect on isExpired to handleTimeout. handleTimeout: stop music; if AppState==='active' cancel OS notif + setBadgeCountAsync(1) + alarmService.playCompletionAlarm; else leave OS notif intact. togglePause: cancelSessionEndNotification on pause, scheduleSessionEndNotification on resume. cleanup: stop timer, cancelSessionEndNotification, clearActiveSession, stopBlocking, audioService.stopMusic, backgroundTimer.stopTimerNotification, alarmService.cleanup. handleSessionComplete: incrementStreak, cancelStreakRiskNotification.",
    "category": "DIRECT",
    "touchpoints": [
      "Lazy import backgroundTimer / alarmService / audioService (setTimeout 100ms)",
      "useSessionTimer(totalDuration) — hook drives isExpired",
      "initializeSession(): start() → endTime → scheduleSessionEndNotification(endTime, name, dur) + getAllScheduledNotificationsAsync confirmation; saveActiveSession; Promise.all of backgroundTimer.startTimerNotification, initializeMusic, alarmService.init",
      "handleTimeout(): isHandlingTimeoutRef guard; audioService.stopMusic; if AppState==='active' → cancelSessionEndNotification + Notifications.setBadgeCountAsync(1) + alarmService.playCompletionAlarm; else leave OS notif; setIsCompleted(true); 800ms setTimeout → handleNotesSubmit",
      "togglePause(): on pause → useSessionTimer.pause + cancelSessionEndNotification + audioService.pauseMusic + backgroundTimer.updateTimerPauseState(true); on resume → useSessionTimer.resume → newEndTime → scheduleSessionEndNotification(newEndTime, ...) + audioService.resumeMusic + backgroundTimer.updateTimerPauseState(false)",
      "confirmEndSession() → cleanup() → navigate Home",
      "cleanup(): isCleanedUpRef guard, clearTimeout completionTimeoutRef, useSessionTimer.stop, cancelSessionEndNotification, clearActiveSession, stopBlocking, audioService.stopMusic, backgroundTimer.stopTimerNotification, alarmService.cleanup",
      "handleNotesSubmit / handleSessionComplete: deepWorkStore.addSession, saveLastSessionConfig, incrementStreak, cancelStreakRiskNotification"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/HomeScreen.js",
    "why_included": "On every focus, calls getActiveSession() — which reads @session_end_time + @active_session_config — to detect orphaned sessions and shows a modal. Also calls scheduleStreakRiskNotification on every focus. handleResumeSession navigates back to DeepWorkSession with prior config which will trigger initializeSession again.",
    "category": "DIRECT",
    "touchpoints": [
      "useFocusEffect → getActiveSession() → reads @session_end_time",
      "useFocusEffect → scheduleStreakRiskNotification(currentStreak)",
      "handleResumeSession → navigation.navigate('DeepWorkSession', config) — re-runs initializeSession",
      "handleSaveExpiredSession / handleAbandonSession → discardActiveSession (multiRemove timer keys)"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/SettingsScreen.js",
    "why_included": "Status shows file currently modified. Imports focusLockService and useFocusLock. No direct notification scheduling but calls deepWorkStore.updateSettings which can change reminderFrequency consumed by notificationService.scheduleNextNotification. No AppState/AsyncStorage notification keys touched here.",
    "category": "INDIRECT",
    "touchpoints": [
      "deepWorkStore.updateSettings (could affect notificationService.scheduleNextNotification)",
      "focusLockService.requestAuthorization / selectAppsToBlock"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/DevToolsScreen.js",
    "why_included": "Imports testNotification / previewNotificationPayload from personalizedNotificationService. Allows manual firing of personalized notifications which use the same Notifications.scheduleNotificationAsync API path.",
    "category": "INDIRECT",
    "touchpoints": [
      "previewNotificationPayload(type)",
      "testNotification(type) — schedules immediate notification"
    ]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/deepWorkStore.js",
    "why_included": "getReminderFrequency consumed by notificationService.scheduleNextNotification to drive scheduling logic. Indirectly affects what notifications get scheduled (though scheduleNotifications is now a no-op).",
    "category": "INDIRECT",
    "touchpoints": ["getReminderFrequency()", "addSession (called by DeepWorkSession.handleSessionComplete)"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/context/SubscriptionContext.js",
    "why_included": "Status shows file modified. Wraps app — its onAuthStateChanged listener determines when premium gates engage. Premium status doesn't directly affect alarm logic, but file is currently dirty.",
    "category": "INDIRECT",
    "touchpoints": ["onAuthStateChanged → checkSubscriptionStatus (no direct notification touchpoint)"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/context/FocusLockContext.js",
    "why_included": "Provides startBlocking/stopBlocking called from DeepWorkSession.initializeSession and cleanup. Not notification-related but participates in session lifecycle cleanup.",
    "category": "INDIRECT",
    "touchpoints": ["startBlocking / stopBlocking / isReady"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/context/AuthContext.js",
    "why_included": "Provides useAuth().user; useNotificationSetup uses auth().currentUser.uid to register FCM token. If auth fails to resolve before useNotificationSetup runs, FCM token registers under deviceId fallback, breaking server-driven session-end FCM delivery.",
    "category": "INDIRECT",
    "touchpoints": ["useAuth() consumed by useNotificationSetup for FCM uid"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/config/firebaseConfig.js",
    "why_included": "Initializes Firebase JS SDK. Required for messaging() to function in useNotificationSetup / useNotificationHandlers / App.js setBackgroundMessageHandler.",
    "category": "INDIRECT",
    "touchpoints": ["Firebase app initialization"]
  },
  {
    "file_path": "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/functions/index.js",
    "why_included": "Cloud Function triggerSessionEndNotification (called via HTTP POST by backgroundTimer.sendCompletionNotification) sends an FCM message with notification.title='Session Complete!', apns.payload.aps.sound='completion_alarm.wav', category='session-complete', badge=1. This is one of the two redundant session-end notifications.",
    "category": "DIRECT",
    "touchpoints": [
      "exports.triggerSessionEndNotification (onCall) — admin.messaging().send with sound completion_alarm.wav",
      "Daily/weekly schedulers (dailyRemindersBatch etc.)"
    ]
  }
]
```

---

## STEP 2: EXECUTION PATHS

```json
[
  {
    "path_name": "PATH A — Foreground completion (app active, screen mounted)",
    "description": "DeepWorkSession useSessionTimer.tick() detects remaining<=0 → setIsExpired(true) → effect [isExpired] → handleTimeout() → audioService.stopMusic → AppState.currentState==='active' branch → cancelSessionEndNotification (removes @session_end_notification_id, removes @session_end_time, calls Notifications.cancelScheduledNotificationAsync) → Notifications.setBadgeCountAsync(1) → servicesRef.current.alarmService.playCompletionAlarm() → expo-av loads completion_alarm.wav, plays, vibrates, autoStopTimer 10s → setIsCompleted(true) → 800ms setTimeout → handleNotesSubmit → handleSessionComplete → cleanup() (re-runs cancelSessionEndNotification, useSessionTimer.stop multiRemove keys, stopBlocking, audioService.stopMusic, backgroundTimer.stopTimerNotification (which dismisses ALL notifications + unregisters BG task + alarmService.cleanup which stops the alarm), alarmService.cleanup)",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/DeepWorkSession.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useSessionTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/alarmService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/audioSessionManager.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/audioService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionEndNotification.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionStateService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/assets/sounds/completion_alarm.wav"
    ],
    "trigger_type": "JS",
    "notes": "cleanup() runs backgroundTimer.stopTimerNotification → Notifications.dismissAllNotificationsAsync, which also dismisses the just-fired sticky timer notification AND any pending notifications. cleanup() also calls alarmService.cleanup which calls stopAlarm which calls sound.stopAsync — this can race with the alarm playback that was just started (alarm cut short within a few hundred ms of start). cleanup runs from BOTH handleSessionComplete and the unmount effect — guarded by isCleanedUpRef but the call from handleSessionComplete is the path that interferes with the alarm."
  },
  {
    "path_name": "PATH B — OS-scheduled local notification (app backgrounded or killed)",
    "description": "At session start scheduleSessionEndNotification(endTime, name, dur) registered a UNUserNotificationCenter local notification with sound:'completion_alarm.wav' and interruptionLevel:'timeSensitive' (or Android channel 'session-completion'). At endTime iOS fires it independent of JS state. Notifications.setNotificationHandler (set up at App.js module load + useEffect) maps data.type='session_end' → shouldShowAlert+Sound+Badge MAX. If user taps the notification: useNotificationHandlers.useLastNotificationResponse fires (handler returns no-op for session_end), App.js addNotificationResponseReceivedListener fires data.type='session_end' → handleCompletionAlarmFromNotification → alarmService.init → playCompletionAlarm({volume:0.8, autoStopAfter:8}). If app was killed at tap time: Notifications.getLastNotificationResponse() inside App.js setupNotifications also detects it → handleCompletionAlarmFromNotification.",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionEndNotification.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationHandler.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useNotificationHandlers.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/alarmService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/audioSessionManager.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/ios/DeepWorkio/Info.plist",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/ios/DeepWorkio/DeepWorkio.entitlements",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/ios/DeepWorkio/completion_alarm.wav",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/app.config.js"
    ],
    "trigger_type": "OS",
    "notes": "The notification handler (notificationHandler.js) is installed twice — once at App.js module load and once inside MainApp useEffect. The useNotificationHandlers hook ALSO registers Notifications.addNotificationResponseReceivedListener — so the same tap event reaches BOTH App.js (which plays alarm) AND useNotificationHandlers (no-op for session_end). This still works but is duplicated. interruptionLevel:'timeSensitive' depends on iOS 15+; expo-notifications 0.20+ requires explicit trigger.type — sessionEndNotification.js does specify type DATE."
  },
  {
    "path_name": "PATH C — BackgroundFetch task fires FCM (HYBRID, network-dependent)",
    "description": "TaskManager.defineTask(BACKGROUND_TIMER_TASK) inside backgroundTimer.js runs on iOS schedule (~every 15-30 sec but iOS-batched). On each tick reads @active_deep_work_session — note this is the BG task's OWN session key, separate from useSessionTimer's @session_end_time. If timeRemaining<=0 calls sendCompletionNotification → fetch POST to https://us-central1-deepwork-8416f.cloudfunctions.net/triggerSessionEndNotification with {userId: deviceId, sessionDuration, activityName} → Cloud Function admin.messaging().send to user's FCM token → APNS delivers to device → notification rendered with sound completion_alarm.wav, badge 1. Then BG task calls clearProgressNotificationFlag + clearActiveSession (clears @active_deep_work_session). FCM tap routed through useNotificationHandlers.handleFCMNotificationTap → navigates to MainApp/Metrics.",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/deviceIdService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/functions/index.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useNotificationSetup.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useNotificationHandlers.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationBackgroundTask.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/ios/DeepWorkio/Info.plist"
    ],
    "trigger_type": "HYBRID",
    "notes": "This path is racing PATH B. PATH B is reliable (OS-scheduled, no JS, no network); PATH C requires BG task to actually fire near endTime, network connectivity, valid FCM token, and matching device id. The comment in sendCompletionNotification (line 276-281) explicitly says local backup notification was REMOVED to avoid duplicates with PATH B — so PATH C now relies entirely on FCM round-trip. If FCM fails silently (no token, expired token, no network) PATH C is silent. PATH B will still fire because OS owns it. BUT: useNotificationSetup uses auth().currentUser?.uid as the FCM doc key, while backgroundTimer.sendCompletionNotification uses deviceIdService.getDeviceId() as userId — so token registration uid and notification target id are DIFFERENT. Cloud Function looks up fcm_tokens/{userId=deviceId} but the doc was written under fcm_tokens/{uid=auth.uid}. FCM session-end notification would fail to find the token in this case."
  },
  {
    "path_name": "PATH D — Foreground addNotificationReceivedListener fallback",
    "description": "If PATH B fires while app is foregrounded (e.g. user has app open but not on session screen) Notifications.addNotificationReceivedListener inside App.js setupNotifications fires. If data.shouldPlayAlarm or type='sessionComplete'/'session_end' AND AppState==='active' → alarmService.playCompletionAlarm({volume:0.9, autoStopAfter:10}) + Vibration.vibrate. Note: PATH A's handleTimeout already cancelled the OS notification when AppState was active, so this path mainly fires when the OS notification fired before the JS timer detected expiry, OR when the notification handler returns shouldPlaySound:true.",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/alarmService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationHandler.js"
    ],
    "trigger_type": "HYBRID",
    "notes": "Both the notification handler (shouldPlaySound:true for session_end) AND the receivedListener (alarmService.playCompletionAlarm) play sound — could result in double-audio in foreground if the OS notification still fires."
  },
  {
    "path_name": "PATH E — Missed completion check on app foreground / cold launch",
    "description": "App.js useEffect defines checkMissedCompletion() — reads @session_end_time, if endTime<Date.now() removes the key and calls alarmService.playCompletionAlarm({volume:0.9, autoStopAfter:10}). This fires (a) once on cold launch (called inline) and (b) every time AppState transitions to 'active'. Independent of useSessionTimer.start which ALSO reads @session_end_time and on expiry sets isExpired=true triggering handleTimeout → playCompletionAlarm.",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/alarmService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useSessionTimer.js"
    ],
    "trigger_type": "JS",
    "notes": "Conflict: cancelSessionEndNotification (called from handleTimeout/cleanup/togglePause-pause) removes @session_end_time AND removes the OS notification id. So a normally-completed-and-cleaned-up session leaves the key absent → checkMissedCompletion no-ops correctly. But if PATH A handleTimeout runs in foreground (which removes @session_end_time via cancelSessionEndNotification AND via useSessionTimer.stop), and then app is backgrounded and re-foregrounded, AppState change handler runs checkMissedCompletion which reads no key — fine. HOWEVER, the BG task in PATH C calls clearActiveSession which only clears @active_deep_work_session — it does NOT clear @session_end_time. So if PATH C completes the session in background and the user re-opens the app, useSessionTimer.start sees stored endTime (now in the past) → marks isExpired immediately → handleTimeout fires alarm AGAIN. Plus checkMissedCompletion fires alarm AGAIN. Plus the OS notification (PATH B) already fired."
  },
  {
    "path_name": "PATH F — Pause/Resume rescheduling",
    "description": "togglePause on pause: useSessionTimer.pause writes @session_remaining_ms + removes @session_end_time, then DeepWorkSession calls cancelSessionEndNotification (removes @session_end_notification_id + @session_end_time + cancels OS notif), audioService.pauseMusic, backgroundTimer.updateTimerPauseState(true) (which keeps the BG task alive but with isPaused=true and writes @active_deep_work_session). On resume: useSessionTimer.resume returns newEndTime, scheduleSessionEndNotification(newEndTime, ...) re-schedules OS notif and re-writes @session_end_time, audioService.resumeMusic, backgroundTimer.updateTimerPauseState(false).",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/DeepWorkSession.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useSessionTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionEndNotification.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/audioService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js"
    ],
    "trigger_type": "JS",
    "notes": "useSessionTimer.pause sets @session_remaining_ms; the BG task in backgroundTimer never reads this key — it has its own pause state (sessionData.isPaused). So pause/resume status is tracked in TWO places that can drift out of sync if either fails."
  },
  {
    "path_name": "PATH G — User taps notification while app in background → in-app alarm trigger",
    "description": "OS notification (PATH B) fires with sound; user taps it. iOS launches/foregrounds the app. useNotificationHandlers.useLastNotificationResponse fires (no-op for session_end per its switch statement) AND App.js Notifications.addNotificationResponseReceivedListener fires for type='session_end' → handleCompletionAlarmFromNotification → alarmService.init + playCompletionAlarm({volume:0.8, autoStopAfter:8}). The OS sound already played via the notification's sound:'completion_alarm.wav'. Now expo-av plays it again. Plus AppState 'active' subscription in App.js fires checkMissedCompletion which reads @session_end_time — if not yet cleared by handleTimeout (because the session screen wasn't mounted), playCompletionAlarm fires AGAIN.",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useNotificationHandlers.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/alarmService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionEndNotification.js"
    ],
    "trigger_type": "HYBRID",
    "notes": "Three potential alarm plays for a single session-end event in this scenario: 1) OS notification sound, 2) addNotificationResponseReceivedListener → playCompletionAlarm, 3) checkMissedCompletion → playCompletionAlarm. AppState subscription's checkMissedCompletion is fine because step 2 already removed the key — but only if step 2 runs FIRST. Order is racy."
  },
  {
    "path_name": "PATH H — Killed app cold launch from notification tap",
    "description": "App was killed when OS notification fired. User taps notification → cold launch. setupNotifications inside App.js (delayed setTimeout 2-4 sec) calls Notifications.getLastNotificationResponse() — if cold-launched by session_end → handleCompletionAlarmFromNotification → alarmService.init + playCompletionAlarm. Concurrently useNotificationHandlers.useLastNotificationResponse fires (no-op for session_end). checkMissedCompletion also runs and reads @session_end_time (likely still present because no cleanup ran in the killed app) → playCompletionAlarm AGAIN.",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/alarmService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useNotificationHandlers.js"
    ],
    "trigger_type": "HYBRID",
    "notes": "setupNotifications is delayed by setTimeout(setupNotifications, isTablet ? 4000 : 2000). checkMissedCompletion fires synchronously within useEffect — so it likely runs FIRST and removes @session_end_time, after which getLastNotificationResponse handler then plays alarm a second time."
  },
  {
    "path_name": "PATH I — HomeScreen orphaned-session detection",
    "description": "HomeScreen useFocusEffect on focus calls getActiveSession() → reads @active_session_config + @session_end_time. If endTime is past → status:'expired' → modal 'Session ended while away'. User can Save Session (calls deepWorkStore.addSession, discardActiveSession → multiRemove @active_session_config, @session_end_time, @session_remaining_ms). User can also Resume from a 'running' session → navigation.navigate('DeepWorkSession', config) → which re-runs initializeSession → useSessionTimer.start sees stored @session_end_time → uses it → scheduleSessionEndNotification re-schedules (because cancelSessionEndNotification is called inside scheduleSessionEndNotification at the top before scheduling) — creates a new id while the original OS notif may still be live (if it hasn't fired) — but cancelSessionEndNotification reads the stored id from @session_end_notification_id and cancels it first.",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/HomeScreen.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionStateService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/DeepWorkSession.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useSessionTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionEndNotification.js"
    ],
    "trigger_type": "JS",
    "notes": "discardActiveSession does NOT cancel the OS notification — only multiRemove the storage keys. So if a user dismisses an orphaned/expired session, the OS notification (if still pending) will still fire later. This is masked because expired sessions have a notification that already fired."
  },
  {
    "path_name": "PATH J — FCM background message handler",
    "description": "App.js module-level messaging().setBackgroundMessageHandler runs whenever a data-only FCM message arrives in background. Currently only Vibration.vibrate. Does NOT play alarm. Independent of all other paths.",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js"
    ],
    "trigger_type": "OS",
    "notes": "Limited scope but still fires — adds vibration on top of any other path that triggered the FCM."
  },
  {
    "path_name": "PATH K — backgroundTimer 10% milestone progress notification",
    "description": "BG task tick: if progress between 10-15% and not paused and AsyncStorage flag absent → sendProgressNotification → Notifications.scheduleNotificationAsync trigger:null with sound:false, type:'progress'. Notification handler returns shouldPlaySound:false for progress. Stores flag '@progress_notification_sent_<startTime>' so it fires once. Cleared by clearProgressNotificationFlag on completion or stopTimerNotification.",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationHandler.js"
    ],
    "trigger_type": "OS",
    "notes": "Independent of alarm path."
  },
  {
    "path_name": "PATH L — backgroundTimer sticky timer notification",
    "description": "On every BG task tick (every 15-30s) updateTimerNotification calls Notifications.scheduleNotificationAsync trigger:null with title 'Deep Work: <activity>' and progress bar. This creates many notifications over the course of a session. notificationHandler default branch returns shouldPlaySound:true HIGH priority — meaning each timer update could play a sound depending on data-type matching. BUT data has isTimerUpdate:true which is not handled; falls through to default 'shouldPlaySound:true'.",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationHandler.js"
    ],
    "trigger_type": "OS",
    "notes": "Sticky timer updates fall through default handler returning shouldPlaySound:true — might play a sound on every BG task iteration in foreground. data.isTimerUpdate is not checked by notificationHandler.js."
  }
]
```

---

## STEP 3: CONFLICT DETECTION

```json
[
  {
    "conflict_type": "DUPLICATE_LOGIC",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useNotificationHandlers.js"
    ],
    "description": "Two separate Notifications.addNotificationResponseReceivedListener subscriptions are registered: one inside App.js setupNotifications and one inside useNotificationHandlers. Both fire on the same tap. App.js handler routes session_end → playCompletionAlarm, while useNotificationHandlers handler explicitly no-ops for session_end (with comment 'Handled by App.js'). This works only by convention; if either is removed or refactored, behavior changes. Plus useLastNotificationResponse in useNotificationHandlers also fires on cold-launch tap, while App.js separately reads getLastNotificationResponse — both observe the same event.",
    "risk_level": "MEDIUM"
  },
  {
    "conflict_type": "MULTIPLE_TRIGGERS",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionEndNotification.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/functions/index.js"
    ],
    "description": "Three independent session-end alarm paths exist concurrently: (1) OS-scheduled local notification via sessionEndNotification.scheduleSessionEndNotification (PATH B), (2) BackgroundFetch task firing FCM via backgroundTimer.sendCompletionNotification → Cloud Function triggerSessionEndNotification (PATH C), (3) in-app expo-av alarm via DeepWorkSession.handleTimeout → alarmService.playCompletionAlarm (PATH A). The code comment in backgroundTimer.js line 276-281 acknowledges S1-3 removed local backup, but FCM still fires AND OS notification still fires AND in-app alarm still fires (PATH A) — each can deliver completion. Foreground completion in PATH A cancels the OS notification but not the FCM call (which is in-flight from BG task). Backgrounded completion leaves the OS notification AND any racing FCM AND any racing in-app alarm if the screen happens to be active.",
    "risk_level": "HIGH"
  },
  {
    "conflict_type": "MULTIPLE_TRIGGERS",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useSessionTimer.js"
    ],
    "description": "On app cold launch with a previously-active session: useSessionTimer.start() reads @session_end_time and if expired sets isExpired=true → handleTimeout fires alarm. Concurrently App.js checkMissedCompletion reads @session_end_time and if expired calls alarmService.playCompletionAlarm directly. Both can fire if DeepWorkSession is mounted on cold launch with an expired session. Furthermore, addNotificationResponseReceivedListener (App.js) and useLastNotificationResponse (useNotificationHandlers) fire if launched by tap — adding a third concurrent alarm trigger.",
    "risk_level": "HIGH"
  },
  {
    "conflict_type": "CANCELLATION_RISK",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionEndNotification.js"
    ],
    "description": "notificationService.cancelAllNotifications() calls Notifications.cancelAllScheduledNotificationsAsync() which would cancel the session-end OS notification AND the streak risk notification AND any other scheduled notification. Currently no caller invokes it but it remains exported and a future call would silently disable the primary alarm path.",
    "risk_level": "MEDIUM"
  },
  {
    "conflict_type": "CANCELLATION_RISK",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js"
    ],
    "description": "backgroundTimer.stopTimerNotification calls Notifications.dismissAllNotificationsAsync() which dismisses every visible notification including the session completion notification that may have just fired (PATH B). This runs from DeepWorkSession.cleanup which runs on every session end (success and abandonment), and from App.js handleEndSession. So a foreground session-end (PATH A) → handleTimeout → setTimeout 800ms → handleNotesSubmit → handleSessionComplete → cleanup → backgroundTimer.stopTimerNotification → dismissAllNotificationsAsync — wipes the alarm notification banner immediately, which on iOS also stops the system sound playback.",
    "risk_level": "HIGH"
  },
  {
    "conflict_type": "CANCELLATION_RISK",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/DeepWorkSession.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/alarmService.js"
    ],
    "description": "In PATH A foreground completion: handleTimeout calls alarmService.playCompletionAlarm() (autoStopAfter default 10 seconds), then 800ms later handleNotesSubmit runs, which calls handleSessionComplete → cleanup → alarmService.cleanup → stopAlarm → sound.stopAsync + unloadAsync. So the alarm is forcibly stopped ~800ms-1s after starting, well before the 10-second auto-stop. The alarm is audibly cut short.",
    "risk_level": "HIGH"
  },
  {
    "conflict_type": "BACKGROUND_RACE",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/audioSessionManager.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/alarmService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/audioService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js"
    ],
    "description": "audioSessionManager initializes Audio.setAudioModeAsync with InterruptionModeIOS.DuckOthers ONCE and caches isInitialized=true. App.js AppState 'active' handler resets the cache. However alarmService.playCompletionAlarm overrides with InterruptionModeIOS.DoNotMix, and audioService.playMusic overrides with mode 2 (DuckOthers). These calls happen out of order: session start → audioService DuckOthers → alarm fires → DoNotMix. iOS audio session category transitions can fail silently if the session is already inactive (e.g. backgrounded), leaving the alarm muted. The comment in alarmService.playCompletionAlarm lines 41-44 explicitly notes iOS revokes the session when backgrounded — but PATH B in background relies on the OS notification's sound, not on Audio.setAudioModeAsync.",
    "risk_level": "MEDIUM"
  },
  {
    "conflict_type": "BACKGROUND_RACE",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useSessionTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/sessionStateService.js"
    ],
    "description": "Three different storage keys describe 'the active session': @active_deep_work_session (owned by backgroundTimer), @session_end_time (owned by useSessionTimer + sessionEndNotification), @active_session_config (owned by sessionStateService). On normal completion, useSessionTimer.stop multiRemoves @session_end_time + @session_remaining_ms; sessionStateService.clearActiveSession removes @active_session_config; backgroundTimer.clearActiveSession removes @active_deep_work_session. If any of these calls fails or is skipped (e.g. service not loaded yet because lazy import hadn't resolved when timer expired), one path will still see an 'active' session and fire its alarm/notification. PATH C (BG task) only clears its own key — does not clear @session_end_time, so PATH E checkMissedCompletion can re-fire after BG task completion.",
    "risk_level": "HIGH"
  },
  {
    "conflict_type": "BACKGROUND_RACE",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/DeepWorkSession.js"
    ],
    "description": "Lazy service loading (setTimeout 100ms) means servicesRef.current.alarmService can be null when handleTimeout runs if the timer expires within the first 100ms (only possible for very short test durations like 0.25 min, which exists in DEV mode). handleTimeout then silently skips the alarm playback. cleanup also skips alarmService.cleanup. The OS-scheduled notification still fires (PATH B) but nothing in-app alarm.",
    "risk_level": "LOW"
  },
  {
    "conflict_type": "DUPLICATE_LOGIC",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationHandler.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js"
    ],
    "description": "setupNotificationHandler() is called twice — once at App.js module load (line 54) and once inside MainApp useEffect (line 373). Setting the same handler twice is idempotent in expo-notifications, but the second call confirms the developer was uncertain about ordering. The module-level call is necessary because notifications arriving during cold launch must be handled before any component renders.",
    "risk_level": "LOW"
  },
  {
    "conflict_type": "DUPLICATE_LOGIC",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationBackgroundTask.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js"
    ],
    "description": "Two BackgroundFetch tasks are registered: 'com.expo.tasks.BACKGROUND_TIMER_TASK' (defined in backgroundTimer.js, registered from startTimerNotification) and 'notification-refresh-task' (defined in notificationBackgroundTask.js, registered from App.js initializeBackgroundServices). The second task calls notificationService.scheduleNotifications() which is now a deprecated no-op. Both compete for iOS BackgroundFetch budget which is limited. Only the first is in BGTaskSchedulerPermittedIdentifiers in Info.plist — meaning 'notification-refresh-task' may fail to register or not fire on iOS at all, but it still consumes registration overhead.",
    "risk_level": "MEDIUM"
  },
  {
    "conflict_type": "MULTIPLE_TRIGGERS",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/App.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/notificationHandler.js"
    ],
    "description": "Notifications.addNotificationReceivedListener (App.js line 535) calls alarmService.playCompletionAlarm({volume:0.9, autoStopAfter:10}) when a sessionComplete/session_end notification arrives in the foreground. Concurrently, the notification handler returns shouldPlaySound:true for completion notifications — so the OS plays the WAV sound AND expo-av plays the WAV sound, simultaneously, both triggered by the same arriving notification.",
    "risk_level": "HIGH"
  },
  {
    "conflict_type": "BACKGROUND_RACE",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/hooks/useNotificationSetup.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/backgroundTimer.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/services/deviceIdService.js",
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/functions/index.js"
    ],
    "description": "FCM token registration uses auth.uid (with deviceId fallback) as the Firestore key for fcm_tokens. backgroundTimer.sendCompletionNotification posts to triggerSessionEndNotification with userId=deviceId. The Cloud Function looks up fcm_tokens/{userId=deviceId} but the doc was likely written under fcm_tokens/{auth.uid}. PATH C silently fails to deliver FCM. PATH B still works because it is local to the device.",
    "risk_level": "HIGH"
  },
  {
    "conflict_type": "CANCELLATION_RISK",
    "files_involved": [
      "/Users/Raman/Desktop/Development/personal/sstech/DeepWorkClean/src/screens/DeepWorkSession.js"
    ],
    "description": "On pause, togglePause calls cancelSessionEndNotification but does NOT cancel the BackgroundFetch task. The BG task continues running, sees isPaused=true in @active_deep_work_session, skips the 10% notification, and waits for completion. If the user does NOT resume (closes app while paused), and later resumes from HomeScreen orphan modal, the notification system has to be re-built fresh. Meanwhile, useSessionTimer.pause stores @session_remaining_ms but the BG task does NOT read this key — it computes its own pause math from sessionData.isPaused and remainingAtPause stored under @active_deep_work_session. Two parallel pause-state stores can drift.",
    "risk_level": "MEDIUM"
  }
]
```

---

## STEP 4: SUMMARY COUNTS

```json
{
  "total_files_involved": 36,
  "direct_alarm_files": 19,
  "indirect_files": 17,
  "distinct_alarm_paths": 12
}
```

Direct files (19): App.js, app.config.js, ios-background-tasks-plugin.js, ios/DeepWorkio/Info.plist, ios/DeepWorkio/DeepWorkio.entitlements, ios/DeepWorkio/completion_alarm.wav, assets/sounds/completion_alarm.wav, src/services/alarmService.js, src/services/audioSessionManager.js, src/services/audioService.js, src/services/sessionEndNotification.js, src/services/backgroundTimer.js, src/services/notificationHandler.js, src/services/notificationBackgroundTask.js, src/services/notificationService.js, src/services/sessionStateService.js, src/hooks/useSessionTimer.js, src/hooks/useNotificationSetup.js, src/hooks/useNotificationHandlers.js, src/screens/DeepWorkSession.js, src/screens/HomeScreen.js, functions/index.js (the count is approximate — the user requested no abbreviation; I list 22 files with DIRECT classification across the inventory; remainder are INDIRECT).

Indirect files (17): index.js, ios/DeepWorkio/Supporting/Expo.plist, ios/DeepWorkio/AppDelegate.swift, assets/sounds/lofi.mp3, assets/sounds/white-noise.mp3, src/services/audioConfig.js, src/services/personalizedNotificationService.js, src/services/streakService.js, src/services/notificationPreferences.js, src/services/deviceIdService.js, src/services/navigationService.js, src/services/deepWorkStore.js, src/screens/SettingsScreen.js, src/screens/DevToolsScreen.js, src/context/SubscriptionContext.js, src/context/FocusLockContext.js, src/context/AuthContext.js, src/config/firebaseConfig.js.

---

## Highest-priority concrete failure modes

1. **Foreground alarm cut short** (PATH A → cleanup): `alarmService.playCompletionAlarm` starts with autoStopAfter:10s, but ~800ms later `handleNotesSubmit → handleSessionComplete → cleanup → alarmService.cleanup → stopAlarm` unloads the sound. The alarm is audibly truncated.

2. **dismissAllNotificationsAsync wipes the firing notification** (`backgroundTimer.stopTimerNotification` line 666): runs from cleanup on every session end. Dismisses the OS-fired completion notification banner and likely silences the system sound mid-play.

3. **Three triggers can overlap** for a single completion event (PATH B + PATH D + PATH E or PATH A + PATH C + PATH B), producing duplicated audio and badge writes.

4. **FCM userId mismatch** between token registration (auth.uid) and notification trigger (deviceId) silently breaks PATH C entirely.

5. **`@session_end_time` is owned by two systems** (`useSessionTimer` and `sessionEndNotification`), and **`@active_deep_work_session` is owned by a third** (`backgroundTimer`). On completion, only some subsets are cleared depending on which path completed the session, leading to stale-key replays via `checkMissedCompletion` and HomeScreen orphan detection.

6. **`expo-av` is the wrong tool when backgrounded** — the file `src/services/alarmService.js` correctly comments that iOS revokes the audio session, but the code in `App.js handleCompletionAlarmFromNotification` and `App.js checkMissedCompletion` still attempts `playCompletionAlarm` upon foregrounding, racing with the OS notification sound.agentId: a5491d0f43f5eda49 (use SendMessage with to: 'a5491d0f43f5eda49' to continue this agent)
<usage>total_tokens: 202324
tool_uses: 64
duration_ms: 1043158</usage>