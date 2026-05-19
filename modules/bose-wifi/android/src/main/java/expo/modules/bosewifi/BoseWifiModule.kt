package expo.modules.bosewifi

import android.content.Context
import android.net.ConnectivityManager
import android.net.MacAddress
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import androidx.annotation.RequiresApi
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class BoseWifiModule : Module() {

  private var networkCallback: ConnectivityManager.NetworkCallback? = null
  private var currentNetwork: Network? = null
  private var connectivityManager: ConnectivityManager? = null

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
  }

  @RequiresApi(Build.VERSION_CODES.Q)
  private fun connectWithSpecifier(ssid: String, bssid: String, promise: Promise) {
    val context = appContext.reactContext ?: run {
      promise.reject("NO_CONTEXT", "No Android context available", null)
      return
    }

    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    connectivityManager = cm

    releaseNetwork()

    val specifier = WifiNetworkSpecifier.Builder()
      .setSsid(ssid)
      .setBssid(MacAddress.fromString(bssid))
      .build()

    val request = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .setNetworkSpecifier(specifier)
      .build()

    var settled = false

    networkCallback = object : ConnectivityManager.NetworkCallback() {

      override fun onAvailable(network: Network) {
        if (settled) return
        settled = true
        currentNetwork = network
        cm.bindProcessToNetwork(network)
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
        if (settled) return
        settled = true
        currentNetwork = null
        promise.reject(
          "CONNECTION_FAILED",
          "Could not connect to Bose AP. Make sure the speaker is in setup mode (LED amber).",
          null,
        )
      }

      override fun onLost(network: Network) {
        if (network == currentNetwork) {
          currentNetwork = null
          cm.bindProcessToNetwork(null)
        }
      }
    }

    try {
      cm.requestNetwork(request, networkCallback!!, 30_000)
    } catch (e: Exception) {
      settled = true
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
  }
}
