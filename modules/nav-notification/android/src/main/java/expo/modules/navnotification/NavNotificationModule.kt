package expo.modules.navnotification

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * updates the text of the already-running location foreground-service
 * notification (the one expo-location posts) using NotificationManager.notify.
*/
class NavNotificationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NavNotification")

    AsyncFunction("update") { body: String ->
      updateNotification(body)
    }
  }

  private fun updateNotification(body: String): Boolean {
    val context: Context = appContext.reactContext ?: return false
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      ?: return false

    val active = try {
      nm.activeNotifications
    } catch (e: Exception) {
      return false
    }

    // expo-location's foreground-service notification is tagged CATEGORY_SERVICE.
    // fall back to any notification from our own package if the category is absent.
    val sbn = active.firstOrNull { it.notification?.category == Notification.CATEGORY_SERVICE }
      ?: active.firstOrNull { it.packageName == context.packageName }
      ?: return false

    return try {
      // recover the existing notification's builder so we keep its channel,
      // icon, content intent, and flags and only change the text.
      val rebuilt = Notification.Builder.recoverBuilder(context, sbn.notification)
        .setContentText(body)
        .setOngoing(true)
        .build()
      nm.notify(sbn.tag, sbn.id, rebuilt)
      true
    } catch (e: Exception) {
      false
    }
  }
}
