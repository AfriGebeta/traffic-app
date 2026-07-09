package expo.modules.navnotification

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.drawable.Icon
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition


class NavNotificationModule : Module() {
  private var exitReceiver: BroadcastReceiver? = null

  private fun exitAction(context: Context) = context.packageName + ".NAV_EXIT"

  override fun definition() = ModuleDefinition {
    Name("NavNotification")

    Events("onNavExit")

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      val receiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
          if (intent?.action == exitAction(context)) {
            sendEvent("onNavExit")
          }
        }
      }
      val filter = IntentFilter(exitAction(context))
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        context.registerReceiver(receiver, filter)
      }
      exitReceiver = receiver
    }

    OnDestroy {
      exitReceiver?.let { receiver ->
        try {
          appContext.reactContext?.unregisterReceiver(receiver)
        } catch (e: Exception) {
          // already unregistered
        }
      }
      exitReceiver = null
    }

    AsyncFunction("update") { body: String ->
      updateNotification(body)
    }
  }

  private fun buildExitAction(context: Context): Notification.Action {
    val intent = Intent(exitAction(context)).setPackage(context.packageName)
    val pendingIntent = PendingIntent.getBroadcast(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return Notification.Action.Builder(null as Icon?, "Exit", pendingIntent).build()
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

      val rebuilt = Notification.Builder.recoverBuilder(context, sbn.notification)
        .setContentText(body)
        .setOngoing(true)
        .setActions(buildExitAction(context))
        .build()
      nm.notify(sbn.tag, sbn.id, rebuilt)
      true
    } catch (e: Exception) {
      false
    }
  }
}
