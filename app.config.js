// app.config.js
export default {
  expo: {
    name: "DeepWork.io",
    slug: "DeepWorkApp",
    version: "1.0.5",
    orientation: "portrait",
    icon: "./assets/applogo.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    plugins: [
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#2563EB",
          sounds: [
            "./assets/sounds/completion_alarm.wav"
          ]
        }
      ],
      "./ios-background-tasks-plugin.js",
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
            deploymentTarget: "15.1",
            newArchEnabled: false
          }
        }
      ],
      "expo-sqlite",
      "expo-asset",
      "@react-native-firebase/app",
      [
        "@react-native-firebase/messaging",
        {
          ios: {
            useFramework: "static"
          }
        }
      ]
    ],
    assets: [
      "./assets/sounds/completion_alarm.wav",
      "./assets/sounds/lofi.mp3",
      "./assets/sounds/white-noise.mp3"
    ],
    assetBundlePatterns: [
      "**/*",
      "assets/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.airraman.deepwork", 
      buildNumber: "30",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        UIBackgroundModes: [
          "fetch",
          "processing",
          "audio",
          "remote-notification"  
        ],
        BGTaskSchedulerPermittedIdentifiers: [
          "com.expo.tasks.BACKGROUND_TIMER_TASK"
        ],
        NSUserNotificationsUsageDescription: "This app uses notifications to remind you when your deep work sessions are complete and to track session progress.",
        CFBundleDisplayName: "DeepWork.io",
        ITSAppUsesNonExemptEncryption: false
      },
      config: {
        usesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.airraman.deepwork",
      versionCode: 1,
      permissions: [
        "NOTIFICATIONS",
        "VIBRATE",
        "FOREGROUND_SERVICE",
        "WAKE_LOCK"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "6154a390-07d0-416c-955b-63179fba2bc8"
      },
      // Firebase configuration from environment variables
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
    },
    owner: "airraman",
    runtimeVersion: "1.0.2",
    updates: {
      url: "https://u.expo.dev/6154a390-07d0-416c-955b-63179fba2bc8"
    }
  }
};