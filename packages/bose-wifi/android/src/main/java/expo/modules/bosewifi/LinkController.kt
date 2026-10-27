package expo.modules.bosewifi

import java.util.concurrent.Executor

enum class JoinError(val code: String) {
  UNAVAILABLE("JOIN_UNAVAILABLE"),
  SUPERSEDED("JOIN_SUPERSEDED"),
  RELEASED("JOIN_RELEASED"),
  REQUEST_FAILED("REQUEST_FAILED"),
}

class JoinFailure(val error: JoinError, val message: String)

interface LinkEvents {
  fun onLinkLost()
  fun onLinkRestored()
}

/**
 * Owns the single Wi-Fi network request and the process binding.
 *
 * Every public call and every connectivity callback is posted to [executor]; all state is read and
 * written only there. Each join callback is invoked exactly once.
 */
class LinkController<N>(
  private val api: ConnectivityApi<N>,
  private val executor: Executor,
  private val events: LinkEvents,
) {
  private inner class Request(private val onSettled: (JoinFailure?) -> Unit) : NetworkListener<N> {
    var settled = false
      private set

    fun settle(failure: JoinFailure?) {
      if (settled) return
      settled = true
      onSettled(failure)
    }

    override fun onAvailable(network: N) = executor.execute { handleAvailable(this, network) }

    override fun onUnavailable() = executor.execute { handleUnavailable(this) }

    override fun onLost(network: N) = executor.execute { handleLost(this, network) }
  }

  private var request: Request? = null
  private var bound: N? = null
  private var linkDown = false

  /** Requests [ssid]/[bssid]; [onSettled] receives `null` once bound, or the failure. */
  fun join(ssid: String, bssid: String, timeoutMs: Int, onSettled: (JoinFailure?) -> Unit) =
    executor.execute {
      clear(JoinFailure(JoinError.SUPERSEDED, "Superseded by a new join request"))
      val next = Request(onSettled)
      request = next
      try {
        api.requestNetwork(ssid, bssid, timeoutMs, next)
      } catch (e: Exception) {
        request = null
        next.settle(JoinFailure(JoinError.REQUEST_FAILED, e.message ?: "requestNetwork failed"))
      }
    }

  /** Rejects a pending join, unregisters, unbinds. Idempotent. */
  fun release(onDone: () -> Unit) =
    executor.execute {
      clear(JoinFailure(JoinError.RELEASED, "Released"))
      onDone()
    }

  /** Binds to the currently connected Wi-Fi network, replacing any request; `false` if there is none. */
  fun bindToConnectedWifi(onDone: (Boolean) -> Unit) =
    executor.execute {
      val network = api.wifiNetworks().firstOrNull()
      if (network == null) {
        onDone(false)
      } else {
        clear(JoinFailure(JoinError.SUPERSEDED, "Superseded by a manual bind"))
        bound = network
        api.bind(network)
        onDone(true)
      }
    }

  private fun clear(pendingFailure: JoinFailure) {
    val current = request
    if (current == null && bound == null) return
    request = null
    if (current != null) {
      current.settle(pendingFailure)
      api.unregister(current)
    }
    bound = null
    linkDown = false
    api.bind(null)
  }

  private fun handleAvailable(source: Request, network: N) {
    if (source !== request) return
    if (!source.settled) {
      bound = network
      api.bind(network)
      source.settle(null)
    } else if (linkDown) {
      linkDown = false
      bound = network
      api.bind(network)
      events.onLinkRestored()
    }
  }

  private fun handleUnavailable(source: Request) {
    if (source !== request) return
    request = null
    source.settle(JoinFailure(JoinError.UNAVAILABLE, "The speaker network is unavailable"))
    api.unregister(source)
    if (bound != null) {
      bound = null
      linkDown = false
      api.bind(null)
    }
  }

  private fun handleLost(source: Request, network: N) {
    if (source !== request || bound == null || bound != network) return
    bound = null
    linkDown = true
    api.bind(null)
    events.onLinkLost()
  }
}
