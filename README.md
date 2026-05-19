# Cargo Stacker

A Vite/React cargo stacking game with shared web assets and native wrappers.

## Web

```bash
npm install
npm run dev
npm run build
```

## Android

```bash
npm run android:sync
npm run android:build
```

The debug APK is written under `android/app/build/outputs/apk/debug/`.

## iOS

```bash
npm run ios:sync
```

The iOS project is generated under `ios/`. Building and signing it requires macOS with Xcode:

```bash
npm run ios:open
```

## Windows

```bash
npm run windows:build
```

The packaged Windows executable is written under `release/windows/`.
