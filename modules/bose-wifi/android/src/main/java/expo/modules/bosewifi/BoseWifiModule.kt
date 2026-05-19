package expo.modules.bosewifi

import android.content.Context
import android.net.ConnectivityManager
import android.net.MacAddress
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiConfiguration
import android.net.wifi.WifiManager
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class BoseWifiModule : Module() {
  private var networkCallback: ConnectivityManager.NetworkCallback? = null
  private var boundNetwork: Network? = null

  override fun definition() = ModuleDefinition {
    Name("BoseWifi")

    AsyncFunction("connectToOpenNetwork") { ssid: String, bssid: String ->
      connectToOpenNetwork(ssid, bssid)
    }

    AsyncFunction("disconnect") {
      disconnect()
    }
  }

  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  private suspend fun connectToOpenNetwork(ssid: String, bssid: String): String {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    // Release any previous binding
    networkCallback?.let { connectivityManager.unregisterNetworkCallback(it) }
    connectivityManager.bindProcessToNetwork(null)
    networkCallback = null
    boundNetwork = null

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      connectViaNetworkSpecifier(ssid, bssid, connectivityManager)
    } else {
      val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      connectViaLegacyApi(wifiManager, ssid)
    }
  }

  @androidx.annotation.RequiresApi(Build.VERSION_CODES.Q)
  private suspend fun connectViaNetworkSpecifier(
    ssid: String,
    bssid: String,
    connectivityManager: ConnectivityManager
  ): String {
    return suspendCancellableCoroutine { continuation ->
      try {
        val specifier = WifiNetworkSpecifier.Builder()
          .setSsid(ssid)
          .setBssid(MacAddress.fromString(bssid))
          .setIsEnhancedOpen(false)
          .build()

        val request = NetworkRequest.Builder()
          .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
          .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
          .setNetworkSpecifier(specifier)
          .build()

        val callback = object : ConnectivityManager.NetworkCallback() {
          override fun onAvailable(network: Network) {
            boundNetwork = network
            connectivityManager.bindProcessToNetwork(network)
            continuation.resume("connected")
          }

          override fun onUnavailable() {
            continuation.resumeWithException(
              Exception("Could not connect to Bose AP")
            )
          }

          override fun onLost(network: Network) {
            connectivityManager.bindProcessToNetwork(null)
            boundNetwork = null
          }
        }

        networkCallback = callback
        connectivityManager.requestNetwork(request, callback)

        continuation.invokeOnCancellation {
          connectivityManager.unregisterNetworkCallback(callback)
          networkCallback = null
        }
      } catch (e: Exception) {
        continuation.resumeWithException(e)
      }
    }
  }

  @Suppress("DEPRECATION")
  private suspend fun connectViaLegacyApi(wifiManager: WifiManager, ssid: String): String {
    return suspendCancellableCoroutine { continuation ->
      try {
        val config = WifiConfiguration().apply {
          SSID = "\"$ssid\""
          allowedKeyManagement.set(WifiConfiguration.KeyMgmt.NONE)
        }

        val networkId = wifiManager.addNetwork(config)
        if (networkId == -1) {
          continuation.resumeWithException(Exception("Failed to add network configuration"))
          return@suspendCancellableCoroutine
        }

        wifiManager.disconnect()
        val enabled = wifiManager.enableNetwork(networkId, true)
        if (!enabled) {
          continuation.resumeWithException(Exception("Failed to enable network"))
          return@suspendCancellableCoroutine
        }

        val reconnected = wifiManager.reconnect()
        if (!reconnected) {
          continuation.resumeWithException(Exception("Failed to reconnect"))
          return@suspendCancellableCoroutine
        }

        continuation.resume("connected")
      } catch (e: Exception) {
        continuation.resumeWithException(e)
      }
    }
  }

  private fun disconnect(): String {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    networkCallback?.let {
      connectivityManager.unregisterNetworkCallback(it)
      networkCallback = null
    }
    connectivityManager.bindProcessToNetwork(null)
    boundNetwork = null
    return "disconnected"
  }
}
