package expo.modules.fallbacklocation

import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// location for devices without google play services, where
// gps first, the network provider only while GPS has no recent fix.
//
class FallbackLocationModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())

  // main thread only
  private val watches = mutableMapOf<Int, List<LocationListener>>()
  private val oneShots = mutableSetOf<OneShotRequest>()
  private var destroyed = false

  // a network fix is only used if GPS hasn't produced one for this long
  private val gpsStaleMs = 10_000L

  private val locationManager: LocationManager?
    get() = appContext.reactContext?.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

  override fun definition() = ModuleDefinition {
    Name("FallbackLocation")

    Events("onLocation")

    AsyncFunction("getLastKnown") { maxAgeMs: Double? ->
      val manager = locationManager ?: return@AsyncFunction null
      val newest = enabledProviders(manager)
        .mapNotNull { provider ->
          try {
            manager.getLastKnownLocation(provider)
          } catch (e: SecurityException) {
            null
          }
        }
        .maxByOrNull { it.time }
        ?: return@AsyncFunction null
      if (maxAgeMs != null && System.currentTimeMillis() - newest.time > maxAgeMs) {
        return@AsyncFunction null
      }
      toMap(newest)
    }

    AsyncFunction("getCurrent") { timeoutMs: Double, highAccuracy: Boolean, promise: Promise ->
      mainHandler.post { getCurrent(timeoutMs.toLong(), highAccuracy, promise) }
    }

    AsyncFunction("startWatch") { id: Int, intervalMs: Double, promise: Promise ->
      mainHandler.post { startWatch(id, intervalMs.toLong(), promise) }
    }

    Function("stopWatch") { id: Int ->
      mainHandler.post { stopWatch(id) }
    }

    OnDestroy {
      mainHandler.post { shutdown() }
    }
  }

  // providers this device has at all (a head unit may have no network provider)
  private fun existingProviders(manager: LocationManager): List<String> =
    (if (USE_NETWORK_PROVIDER) listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
     else listOf(LocationManager.GPS_PROVIDER))
      .filter { manager.allProviders.contains(it) }

  companion object {
    private const val USE_NETWORK_PROVIDER = true
  }

  private fun enabledProviders(manager: LocationManager): List<String> =
    existingProviders(manager).filter { provider ->
      try {
        manager.isProviderEnabled(provider)
      } catch (e: Exception) {
        false
      }
    }

  // one getCurrent call: its listeners, its timeout and its promise, settled exactly once
  private inner class OneShotRequest(
    private val manager: LocationManager,
    private val promise: Promise,
    private val timeoutMs: Long
  ) {
    val listeners = mutableListOf<LocationListener>()
    var bestNetworkFix: Location? = null
    private var settled = false
    val timeout = Runnable { finish(bestNetworkFix) }

    fun finish(location: Location?) {
      if (settled) return
      settled = true
      cleanUp()
      if (location != null) {
        promise.resolve(toMap(location))
      } else {
        promise.reject("E_LOCATION_TIMEOUT", "No location fix within ${timeoutMs}ms", null)
      }
    }

    fun fail(code: String, message: String, cause: Throwable?) {
      if (settled) return
      settled = true
      cleanUp()
      promise.reject(code, message, cause)
    }

    private fun cleanUp() {
      mainHandler.removeCallbacks(timeout)
      listeners.forEach { manager.removeUpdates(it) }
      listeners.clear()
      oneShots.remove(this)
    }
  }

  private fun getCurrent(timeoutMs: Long, highAccuracy: Boolean, promise: Promise) {
    if (destroyed) {
      promise.reject("E_LOCATION_UNAVAILABLE", "Location module was destroyed", null)
      return
    }
    val manager = locationManager
    if (manager == null) {
      promise.reject("E_LOCATION_UNAVAILABLE", "LocationManager unavailable", null)
      return
    }
    val providers = enabledProviders(manager)
    if (providers.isEmpty()) {
      promise.reject("E_LOCATION_SERVICES_DISABLED", "Location services are disabled", null)
      return
    }

    val request = OneShotRequest(manager, promise, timeoutMs)
    oneShots.add(request)

    for (provider in providers) {
      val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
          // high accuracy waits for GPS; a network fix is kept as the timeout fallback
          if (highAccuracy && provider == LocationManager.NETWORK_PROVIDER && providers.contains(LocationManager.GPS_PROVIDER)) {
            request.bestNetworkFix = location
            return
          }
          request.finish(location)
        }

        override fun onProviderEnabled(provider: String) = Unit
        override fun onProviderDisabled(provider: String) = Unit
        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
      }
      try {
        // added before registering: if registration throws, cleanup still removes it
        request.listeners.add(listener)
        manager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
      } catch (e: SecurityException) {
        request.fail("E_LOCATION_UNAUTHORIZED", "Location permission not granted", e)
        return
      }
    }

    mainHandler.postDelayed(request.timeout, timeoutMs)
  }

  private fun startWatch(id: Int, intervalMs: Long, promise: Promise) {
    if (destroyed) {
      promise.reject("E_LOCATION_UNAVAILABLE", "Location module was destroyed", null)
      return
    }
    stopWatch(id)
    val manager = locationManager
    if (manager == null) {
      promise.reject("E_LOCATION_UNAVAILABLE", "LocationManager unavailable", null)
      return
    }
    // registered even while switched off, so updates start as soon as the user enables location
    val providers = existingProviders(manager)
    var lastGpsFixAt = 0L

    val listeners = providers.map { provider ->
      object : LocationListener {
        override fun onLocationChanged(location: Location) {
          if (provider == LocationManager.GPS_PROVIDER) {
            lastGpsFixAt = System.currentTimeMillis()
          } else if (System.currentTimeMillis() - lastGpsFixAt < gpsStaleMs) {
            return
          }
          sendEvent("onLocation", mapOf("id" to id, "location" to toMap(location)))
        }

        override fun onProviderEnabled(provider: String) = Unit
        override fun onProviderDisabled(provider: String) = Unit
        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
      }
    }

    try {
      providers.zip(listeners).forEach { (provider, listener) ->
        manager.requestLocationUpdates(provider, intervalMs, 0f, listener, Looper.getMainLooper())
      }
    } catch (e: SecurityException) {
      listeners.forEach { manager.removeUpdates(it) }
      promise.reject("E_LOCATION_UNAUTHORIZED", "Location permission not granted", e)
      return
    }
    watches[id] = listeners
    promise.resolve(null)
  }

  private fun stopWatch(id: Int) {
    val listeners = watches.remove(id) ?: return
    val manager = locationManager ?: return
    listeners.forEach { manager.removeUpdates(it) }
  }

  // module torn down (reload, app exit): no GPS listener or pending timeout may outlive it
  private fun shutdown() {
    destroyed = true
    oneShots.toList().forEach { it.fail("E_LOCATION_UNAVAILABLE", "Location module was destroyed", null) }
    watches.keys.toList().forEach { stopWatch(it) }
  }

  // same shape and raw values as expo-location's LocationObject on Android
  private fun toMap(location: Location): Map<String, Any?> = mapOf(
    "coords" to mapOf(
      "latitude" to location.latitude,
      "longitude" to location.longitude,
      "altitude" to location.altitude,
      "accuracy" to location.accuracy.toDouble(),
      "altitudeAccuracy" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        location.verticalAccuracyMeters.toDouble()
      } else {
        null
      },
      "heading" to location.bearing.toDouble(),
      "speed" to location.speed.toDouble()
    ),
    "timestamp" to location.time.toDouble(),
    "mocked" to location.isFromMockProvider
  )
}
