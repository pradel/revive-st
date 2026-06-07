package expo.modules.bosewifi

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.MacAddress
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.annotation.RequiresApi
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class BoseWifiModule : Module() {

  private var networkCallback: ConnectivityManager.NetworkCallback? = null
  private var currentNetwork: Network? = null
  private var connectivityManager: ConnectivityManager? = null
  private var pendingPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("BoseWifi")

    AsyncFunction("connectToOpenNetwork") { ssid: String, bssid: String, promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        promise.reject("UNSUPPORTED", "Android 10 (API 29) or higher is required", null)
        return@AsyncFunction
      }
      connectWithSpecifier(ssid, bssid, promise)
    }

    AsyncFunction("disconnect") { promise: Promise ->
      releaseNetwork()
      promise.resolve(null)
    }

    AsyncFunction("isConnected") { promise: Promise ->
      promise.resolve(currentNetwork != null)
    }

    AsyncFunction("openWifiSettings") { promise: Promise ->
      val ctx = appContext.reactContext ?: run {
        promise.reject("NO_CONTEXT", "No Android context available", null)
        return@AsyncFunction
      }
      val intent = Intent(Settings.ACTION_WIFI_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(null)
    }

    AsyncFunction("openWifiSettingsPanel") { promise: Promise ->
      val ctx = appContext.reactContext ?: run {
        promise.reject("NO_CONTEXT", "No Android context available", null)
        return@AsyncFunction
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val intent = Intent(Settings.Panel.ACTION_WIFI)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
      } else {
        val intent = Intent(Settings.ACTION_WIFI_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
      }
      promise.resolve(null)
    }
  }

  @RequiresApi(Build.VERSION_CODES.Q)
  private fun connectWithSpecifier(ssid: String, bssid: String, promise: Promise) {
    val context = appContext.reactContext ?: run {
      promise.reject("NO_CONTEXT", "No Android context available", null)
      return
    }

    Log.d("BoseWifi", "connectWithSpecifier: SSID=\"$ssid\" BSSID=\"$bssid\"")

    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    connectivityManager = cm

    pendingPromise?.let {
      Log.d("BoseWifi", "connectWithSpecifier: cancelling previous pending promise")
      it.reject("CONNECTION_CANCELLED", "Superseded by a new connection request", null)
    }
    pendingPromise = promise

    releaseNetwork()

    Log.d("BoseWifi", "Building WifiNetworkSpecifier...")
    val specifier = WifiNetworkSpecifier.Builder()
      .setSsid(ssid)
      .setBssid(MacAddress.fromString(bssid))
      .build()

    Log.d("BoseWifi", "Building NetworkRequest (no internet capability)...")
    val request = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .setNetworkSpecifier(specifier)
      .build()

    var settled = false

    Log.d("BoseWifi", "Registering network callback with 90s timeout...")
    networkCallback = object : ConnectivityManager.NetworkCallback() {

      override fun onAvailable(network: Network) {
        Log.d("BoseWifi", "onAvailable: network=$network settled=$settled")
        if (settled) return
        settled = true
        currentNetwork = network
        cm.bindProcessToNetwork(network)

        Log.d("BoseWifi", "onAvailable: bound to network, resolving promise")
        pendingPromise = null
        promise.resolve(
          mapOf(
            "success" to true,
            "ip" to "192.0.2.1",
            "telnetPort" to 17000,
            "apiPort" to 8090,
            "message" to "Connected — traffic bound to Bose AP",
          ),
        )
      }

      override fun onUnavailable() {
        Log.d("BoseWifi", "onUnavailable: settled=$settled")
        if (settled) return
        settled = true
        currentNetwork = null
        pendingPromise = null
        Log.d("BoseWifi", "onUnavailable: rejecting promise with CONNECTION_FAILED")
        promise.reject(
          "CONNECTION_FAILED",
          "Could not connect to Bose AP. Make sure the speaker is in setup mode (LED amber).",
          null,
        )
      }

      override fun onLost(network: Network) {
        Log.d("BoseWifi", "onLost: network=$network currentNetwork=$currentNetwork")
        if (network == currentNetwork) {
          currentNetwork = null
          cm.bindProcessToNetwork(null)
          Log.d("BoseWifi", "onLost: unbound, currentNetwork cleared")
        }
      }
    }

    try {
      Log.d("BoseWifi", "Calling requestNetwork with 90s timeout...")
      cm.requestNetwork(request, networkCallback!!, 90_000)
      Log.d("BoseWifi", "requestNetwork returned — waiting for callback")
    } catch (e: Exception) {
      Log.e("BoseWifi", "requestNetwork threw: ${e.message}", e)
      settled = true
      pendingPromise = null
      promise.reject("REQUEST_FAILED", e.message ?: "Unknown error", e)
    }
  }

  private fun releaseNetwork() {
    val cm = connectivityManager ?: return
    networkCallback?.let {
      try {
        cm.unregisterNetworkCallback(it)
      } catch (_: Exception) { /* already unregistered */ }
    }
    cm.bindProcessToNetwork(null)
    networkCallback = null
    currentNetwork = null
    pendingPromise = null
  }
}
