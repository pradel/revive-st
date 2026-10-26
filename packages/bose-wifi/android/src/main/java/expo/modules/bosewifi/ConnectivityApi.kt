package expo.modules.bosewifi

import android.net.ConnectivityManager
import android.net.MacAddress
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import java.util.concurrent.ConcurrentHashMap

/** Callbacks for a single network request. May be invoked on any thread. */
interface NetworkListener<N> {
  fun onAvailable(network: N)
  fun onUnavailable()
  fun onLost(network: N)
}

/** The slice of ConnectivityManager that [LinkController] needs. [N] is the platform network handle. */
interface ConnectivityApi<N> {
  /** Requests the Wi-Fi network [ssid]/[bssid] without internet capability. Throws if the request cannot be registered. */
  fun requestNetwork(ssid: String, bssid: String, timeoutMs: Int, listener: NetworkListener<N>)

  /** Unregisters the request made with [listener]. No-op if it is not registered. */
  fun unregister(listener: NetworkListener<N>)

  /** Binds the process to [network]; `null` unbinds. */
  fun bind(network: N?)

  /** Networks currently known to the system whose capabilities have TRANSPORT_WIFI. */
  fun wifiNetworks(): List<N>
}

class AndroidConnectivityApi(private val cm: ConnectivityManager) : ConnectivityApi<Network> {
  private val callbacks = ConcurrentHashMap<NetworkListener<Network>, ConnectivityManager.NetworkCallback>()

  override fun requestNetwork(ssid: String, bssid: String, timeoutMs: Int, listener: NetworkListener<Network>) {
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
      override fun onAvailable(network: Network) = listener.onAvailable(network)
      override fun onUnavailable() = listener.onUnavailable()
      override fun onLost(network: Network) = listener.onLost(network)
    }
    callbacks[listener] = callback
    try {
      cm.requestNetwork(request, callback, timeoutMs)
    } catch (e: Exception) {
      callbacks.remove(listener)
      throw e
    }
  }

  override fun unregister(listener: NetworkListener<Network>) {
    val callback = callbacks.remove(listener) ?: return
    try {
      cm.unregisterNetworkCallback(callback)
    } catch (_: IllegalArgumentException) {
      // Already released by the system (e.g. after onUnavailable).
    }
  }

  override fun bind(network: Network?) {
    cm.bindProcessToNetwork(network)
  }

  @Suppress("DEPRECATION")
  override fun wifiNetworks(): List<Network> =
    cm.allNetworks.filter {
      cm.getNetworkCapabilities(it)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
    }
}
