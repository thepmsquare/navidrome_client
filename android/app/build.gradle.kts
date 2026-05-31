plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

import java.util.Properties
import java.io.FileInputStream

val keystorePropertiesFile = rootProject.projectDir.resolve("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

val constantsFile = file("../../lib/constants.dart")
var appName = "navidrome client by thepmsquare" // fallback

if (constantsFile.exists()) {
    val content = constantsFile.readText()
    val regex = Regex("""static const String appTitle = '(.+?)'""")
    val matchResult = regex.find(content)
    if (matchResult != null) {
        appName = matchResult.groupValues[1]
        println("App name extracted from constants.dart: '$appName'")
    } else {
        println("WARNING: Could not find appTitle in constants.dart, using fallback name.")
    }
} else {
    println("WARNING: constants.dart not found at ${constantsFile.absolutePath}, using fallback name.")
}

android {
    namespace = "com.thepmsquare.navidrome_client"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = keystoreProperties["storeFile"]?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String
        }
    }

    defaultConfig {
        applicationId = "com.thepmsquare.navidrome_client"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        resValue("string", "app_name", appName)
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

flutter {
    source = "../.."
}