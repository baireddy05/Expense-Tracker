-keepattributes *Annotation*,InnerClasses,Signature,Exceptions,SourceFile,LineNumberTable

# Project BuildConfig and domain models
-keep class com.example.kharch.BuildConfig { *; }
-keep class com.example.kharch.model.** { *; }

# kotlinx.serialization runtime & generated $$serializer classes
-keep class kotlinx.serialization.** { *; }
-dontwarn kotlinx.serialization.**
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1>$Companion {
    kotlinx.serialization.KSerializer serializer(...);
}
-if @kotlinx.serialization.Serializable class **
-keep class <1>$$serializer { *; }

# Credential Manager & Google Identity
-keep class androidx.credentials.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }
-dontwarn androidx.credentials.**
-dontwarn com.google.android.libraries.identity.googleid.**

-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}
