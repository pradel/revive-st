package expo.modules.bosewifi

import android.content.Context
import android.net.ConnectivityManager
import android.net.MacAddress
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class BoseWifiModule : Module() {
  private var networkCallback: ConnectivityManager.NetworkCallback? = null
  private var boundNetwork: Network? = null

  override fun definition() = ModuleDefinition {
    Name("BoseWifi")

    AsyncFunction("connectToOpenNetwork") { ssid: String, bssid: String ->
      val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

      networkCallback?.let { connectivityManager.unregisterNetworkCallback(it) }
      connectivityManager.bindProcessToNetwork(null)
      networkCallback = null
      boundNetwork = null

      runBlocking {
        suspendCancellableCoroutine<String> { continuation ->
          val specifier = WifiNetworkSpecifier.Builder()
            .setSsid(ssid)
            .setBssid(MacAddress.fromString(bssid))
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
              continuation.resumeWithException(Exception("Could not connect to Bose AP"))
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
        }
      }
    }

    AsyncFunction("disconnect") {
      val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

      networkCallback?.let {
        connectivityManager.unregisterNetworkCallback(it)
        networkCallback = null
      }
      connectivityManager.bindProcessToNetwork(null)
      boundNetwork = null
      "disconnected"
    }
  }

  private val context: Context
    get() = requireNotNull(appContext.reactContext)
}
