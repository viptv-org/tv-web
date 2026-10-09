# Android and Android TV development


Load the environment in Bash:

```sh
source /home/node/viptv-org/design/scripts/android-env.sh
java -version
sdkmanager --list_installed
emulator -list-avds
```

AVDs: `viptv-phone-api35` and `viptv-tv-api36`. This container has no `/dev/kvm`, so no accelerated emulator or hardware validation is claimed. The AVD definitions/system images are configured; no emulator was booted. On a host with usable virtualization, run `emulator -avd viptv-phone-api35` or `emulator -avd viptv-tv-api36`, then the relevant Gradle connected tests. Do not mistake Android unit tests for TV focus/media acceptance.


For another workstation, install JDK 17 and the Android SDK versions required by each repository's Gradle files, create phone and TV AVDs with its SDK Manager, then point JAVA_HOME/ANDROID_HOME at those installations. The convenience script assumes the initial workspace layout and is not a downloader. Verify downloaded toolchains through their vendor distribution/checksums before using them.
