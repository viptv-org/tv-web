# Android and Android TV development

The initial machine setup is installed under `/home/node/viptv-org/.tooling`: Temurin JDK 17, Android SDK command-line tools, platforms/build tools, platform tools and emulator. Library requirements differ: android uses Platform 36 and mediamp uses Platform 35. Toolchains are local machine state, excluded from all repositories and release assets.

Load the environment in Bash:

```sh
source /home/node/viptv-org/design/scripts/android-env.sh
java -version
sdkmanager --list_installed
emulator -list-avds
```

AVDs: `viptv-phone-api35` and `viptv-tv-api36`. This container has no `/dev/kvm`, so no accelerated emulator or hardware validation is claimed. The AVD definitions/system images are configured; no emulator was booted. On a host with usable virtualization, run `emulator -avd viptv-phone-api35` or `emulator -avd viptv-tv-api36`, then the relevant Gradle connected tests. Do not mistake Android unit tests for TV focus/media acceptance.

Local verified commands, after sourcing the environment: `./gradlew testDebugUnitTest` in android and `./gradlew assemble` in mediamp. Both repositories are playback libraries. A viptv Compose application must be built from the design contract, with separate phone and TV input/decoder validation tracked in the design issue.

For another workstation, install JDK 17 and the Android SDK versions required by each repository's Gradle files, create phone and TV AVDs with its SDK Manager, then point JAVA_HOME/ANDROID_HOME at those installations. The convenience script assumes the initial workspace layout and is not a downloader. Verify downloaded toolchains through their vendor distribution/checksums before using them.
