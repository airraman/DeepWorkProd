# Development Branch Workflow

## Branch Strategy

### `main` branch (Production)
- Bundle ID: `com.airraman.deepwork`
- Display name: "DeepWork.io"
- Ready for App Store submission
- **NEVER** change bundle ID here

### `development` branch (Testing)
- Bundle ID: `com.airraman.deepwork.dev`
- Display name: "DeepWork.io (Dev)"
- For testing new features
- Installs alongside production app

---

## Daily Development

### Working on Features
```bash
git checkout development
# Make changes, test, commit
git push
```

### Building for Testing
```bash
git checkout development
npx expo run:ios --device
# Installs "DeepWork.io (Dev)" on phone
```

### Deploying to Production
```bash
# 1. Switch to main
git checkout main

# 2. Merge code (cherry-pick if needed)
git merge development --no-commit

# 3. VERIFY production config
grep bundleIdentifier app.config.js
# Must show: "com.airraman.deepwork" (NO .dev)

# 4. Build for App Store
eas build --platform ios --profile production
```

---

## Current Status
✅ Development branch created with Focus Lock Swift module
✅ Dev bundle ID configured (.dev suffix)
✅ Production branch unchanged (200hrs data safe)
