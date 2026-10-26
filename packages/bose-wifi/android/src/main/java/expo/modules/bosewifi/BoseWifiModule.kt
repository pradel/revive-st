package expo.modules.bosewifi

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class BoseWifiModule : Module() {

  private val executor: ExecutorService = Executors.newSingleThreadExecutor()
  @Volatile private var link: LinkController<Network>? = null

  private val events = object : LinkEvents {
    override fun onLinkLost() = sendEvent("onLinkLost", mapOf<String, Any?>())
    override fun onLinkRestored() = sendEvent("onLinkRestored", mapOf<String, Any?>())
  }

  @Synchronized
  private fun linkController(promise: Promise): LinkController<Network>? {
    link?.let { return it }
    val context = appContext.reactContext ?: run {
      promise.reject("NO_CONTEXT", "No Android context available", null)
      return null
    }
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    return LinkController(AndroidConnectivityApi(cm), executor, events).also { link = it }
  }

  private fun startSettings(action: String, promise: Promise) {
    val ctx = appContext.reactContext ?: run {
      promise.reject("NO_CONTEXT", "No Android context available", null)
      return
    }
    ctx.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    promise.resolve(null)
  }

  override fun definition() = ModuleDefinition {
    Name("BoseWifi")

    Events("onLinkLost", "onLinkRestored")

    AsyncFunction("join") { ssid: String, bssid: String, timeoutMs: Int, promise: Promise ->
      val controller = linkController(promise) ?: return@AsyncFunction
      controller.join(ssid, bssid, timeoutMs) { failure ->
        if (failure == null) promise.resolve(null) else promise.reject(failure.error.code, failure.message, null)
      }
    }

    AsyncFunction("release") { promise: Promise ->
      val controller = link ?: run {
        promise.resolve(null)
        return@AsyncFunction
      }
      controller.release { promise.resolve(null) }
    }

    AsyncFunction("bindToConnectedWifi") { promise: Promise ->
      val controller = linkController(promise) ?: return@AsyncFunction
      controller.bindToConnectedWifi { bound -> promise.resolve(bound) }
    }

    AsyncFunction("openWifiPanel") { promise: Promise ->
      startSettings(Settings.Panel.ACTION_WIFI, promise)
    }

    AsyncFunction("openWifiSettings") { promise: Promise ->
      startSettings(Settings.ACTION_WIFI_SETTINGS, promise)
    }

    OnDestroy {
      link?.release {}
      executor.shutdown()
    }
  }
}
