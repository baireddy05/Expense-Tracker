import java.util.Properties

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.compose.compiler)
  alias(libs.plugins.kotlin.serialization)
}

val rootEnv = Properties().apply {
  val envFile = rootProject.projectDir.parentFile?.resolve(".env")
  if (envFile != null && envFile.exists()) {
    envFile.inputStream().use { load(it) }
  }
}

fun envOrEmpty(key: String): String {
  val raw = rootEnv.getProperty(key, System.getenv(key) ?: "").trim()
  return raw.replace("\"", "\\\"")
}

android {
  namespace = "com.example.kharch"
  compileSdk = 36
  defaultConfig {
    applicationId = "com.kharch.app"
    minSdk = 26
    targetSdk = 36
    versionCode = 1
    versionName = "3.0.0"

    buildConfigField("String", "FIREBASE_API_KEY", "\"${envOrEmpty("VITE_FIREBASE_API_KEY")}\"")
    buildConfigField("String", "FIREBASE_PROJECT_ID", "\"${envOrEmpty("VITE_FIREBASE_PROJECT_ID")}\"")
    buildConfigField(
      "String",
      "GOOGLE_WEB_CLIENT_ID",
      "\"${envOrEmpty("VITE_GOOGLE_WEB_CLIENT_ID").ifBlank { "611669328733-a31ut80feabdob2nikrslq4i5ho613rk.apps.googleusercontent.com" }}\""
    )
  }

  buildTypes {
    release {
      signingConfig = signingConfigs.getByName("debug")
      isMinifyEnabled = true
      isShrinkResources = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  buildFeatures {
    compose = true
    aidl = false
    buildConfig = true
    shaders = false
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

kotlin {
  jvmToolchain(17)
}

dependencies {
  val composeBom = platform(libs.androidx.compose.bom)
  implementation(composeBom)
  androidTestImplementation(composeBom)

  // Core Android dependencies
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.activity.compose)
  implementation(libs.androidx.profileinstaller)

  // Arch Components
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)

  // Serialization
  implementation(libs.kotlinx.serialization.json)

  // Compose
  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.compose.material3)
  implementation(libs.androidx.compose.material.icons.extended)

  // Tooling
  debugImplementation(libs.androidx.compose.ui.tooling)

  // Instrumented tests
  androidTestImplementation(libs.androidx.compose.ui.test.junit4)
  debugImplementation(libs.androidx.compose.ui.test.manifest)

  // Local tests: jUnit, coroutines, Android runner
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)

  // Instrumented tests: jUnit rules and runners
  androidTestImplementation(libs.androidx.test.core)
  androidTestImplementation(libs.androidx.test.ext.junit)
  androidTestImplementation(libs.androidx.test.runner)
  androidTestImplementation(libs.androidx.test.espresso.core)

  // Navigation
  implementation(libs.androidx.navigation3.ui)
  implementation(libs.androidx.navigation3.runtime)
  implementation(libs.androidx.lifecycle.viewmodel.navigation3)

  // Authentication (Credential Manager + Google Identity)
  implementation(libs.androidx.credentials)
  implementation(libs.androidx.credentials.play.services.auth)
  implementation(libs.googleid)
}
