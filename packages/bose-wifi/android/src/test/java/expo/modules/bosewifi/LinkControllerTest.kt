package expo.modules.bosewifi

import java.util.concurrent.Executor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Scriptable stand-in for the system: tracks registered requests and the process binding. */
private class FakeConnectivity(private val timeline: MutableList<String>) : ConnectivityApi<String> {
  val registered = mutableListOf<Pair<String, NetworkListener<String>>>()
  var boundTo: String? = null
  var wifi: List<String> = emptyList()
  var failNextRequest: Exception? = null

  override fun requestNetwork(ssid: String, bssid: String, timeoutMs: Int, listener: NetworkListener<String>) {
    failNextRequest?.let {
      failNextRequest = null
      throw it
    }
    registered += ssid to listener
    timeline += "registered $ssid"
  }

  override fun unregister(listener: NetworkListener<String>) {
    registered.removeAll { it.second === listener }
  }

  override fun bind(network: String?) {
    boundTo = network
  }

  override fun wifiNetworks(): List<String> = wifi

  fun listener(ssid: String): NetworkListener<String> = registered.single { it.first == ssid }.second
}

private class Outcome {
  val results = mutableListOf<JoinFailure?>()
  val settled get() = results.isNotEmpty()
  val code get() = results.single()?.error?.code
}

class LinkControllerTest {
  private val direct = Executor { it.run() }
  private lateinit var timeline: MutableList<String>
  private lateinit var api: FakeConnectivity
  private lateinit var controller: LinkController<String>

  @Before
  fun setUp() {
    timeline = mutableListOf()
    api = FakeConnectivity(timeline)
    controller = LinkController(
      api,
      direct,
      object : LinkEvents {
        override fun onLinkLost() {
          timeline += "linkLost"
        }

        override fun onLinkRestored() {
          timeline += "linkRestored"
        }
      },
    )
  }

  private fun join(ssid: String): Outcome {
    val outcome = Outcome()
    controller.join(ssid, "aa:bb:cc:dd:ee:ff", 90_000) { failure ->
      outcome.results += failure
      timeline += "settled $ssid ${failure?.error?.code ?: "OK"}"
    }
    return outcome
  }

  private fun release() {
    var done = false
    controller.release { done = true }
    assertTrue(done)
  }

  @Test
  fun availableResolvesOnceAndBinds() {
    val outcome = join("Bose ST 10 (DDEEFF)")
    val listener = api.listener("Bose ST 10 (DDEEFF)")

    listener.onAvailable("net1")
    listener.onAvailable("net1")

    assertEquals(listOf<JoinFailure?>(null), outcome.results)
    assertEquals("net1", api.boundTo)
    assertFalse(timeline.contains("linkRestored"))
  }

  @Test
  fun unavailableRejectsWithJoinUnavailable() {
    val outcome = join("Bose")

    api.listener("Bose").onUnavailable()

    assertEquals("JOIN_UNAVAILABLE", outcome.code)
    assertNull(api.boundTo)
    assertTrue(api.registered.isEmpty())
  }

  @Test
  fun newJoinSupersedesPendingBeforeRegistering() {
    val first = join("first")
    val firstListener = api.listener("first")
    val second = join("second")

    assertEquals("JOIN_SUPERSEDED", first.code)
    assertEquals(
      listOf("registered first", "settled first JOIN_SUPERSEDED", "registered second"),
      timeline,
    )
    assertEquals(listOf("second"), api.registered.map { it.first })

    // Late callbacks from the superseded request change nothing.
    firstListener.onAvailable("stale")
    assertNull(api.boundTo)
    assertFalse(second.settled)

    api.listener("second").onAvailable("net2")
    assertEquals(listOf<JoinFailure?>(null), second.results)
    assertEquals("net2", api.boundTo)
  }

  @Test
  fun releaseWhilePendingRejectsUnregistersUnbinds() {
    val outcome = join("Bose")
    val listener = api.listener("Bose")
    api.boundTo = "leftover"

    release()

    assertEquals("JOIN_RELEASED", outcome.code)
    assertTrue(api.registered.isEmpty())
    assertNull(api.boundTo)

    // Second release does nothing; late callbacks are ignored.
    api.boundTo = "other"
    release()
    listener.onAvailable("net1")
    assertEquals("other", api.boundTo)
    assertEquals(1, outcome.results.size)
  }

  @Test
  fun releaseAfterJoinUnbindsAndUnregisters() {
    val outcome = join("Bose")
    api.listener("Bose").onAvailable("net1")

    release()

    assertEquals(listOf<JoinFailure?>(null), outcome.results)
    assertTrue(api.registered.isEmpty())
    assertNull(api.boundTo)
  }

  @Test
  fun lostForBoundNetworkUnbindsAndEmits() {
    join("Bose")
    val listener = api.listener("Bose")
    listener.onAvailable("net1")

    listener.onLost("other")
    assertEquals("net1", api.boundTo)
    assertFalse(timeline.contains("linkLost"))

    listener.onLost("net1")
    assertNull(api.boundTo)
    assertEquals(1, timeline.count { it == "linkLost" })
  }

  @Test
  fun availableAfterLossRebindsAndEmitsRestored() {
    val outcome = join("Bose")
    val listener = api.listener("Bose")
    listener.onAvailable("net1")
    listener.onLost("net1")

    listener.onAvailable("net1b")

    assertEquals("net1b", api.boundTo)
    assertEquals(listOf("linkLost", "linkRestored"), timeline.filter { it.startsWith("link") })
    assertEquals(1, outcome.results.size)
  }

  @Test
  fun requestNetworkThrowsRejectsWithRequestFailedAndLeavesStateClean() {
    api.failNextRequest = SecurityException("boom")

    val outcome = join("Bose")

    assertEquals("REQUEST_FAILED", outcome.code)
    assertEquals("boom", outcome.results.single()?.message)
    assertTrue(api.registered.isEmpty())
    assertNull(api.boundTo)

    // A following join works normally.
    val next = join("Bose")
    api.listener("Bose").onAvailable("net1")
    assertEquals(listOf<JoinFailure?>(null), next.results)
    assertEquals("net1", api.boundTo)
  }

  @Test
  fun bindToConnectedWifiBindsWhenWifiPresent() {
    api.wifi = listOf("homeWifi")
    var result: Boolean? = null

    controller.bindToConnectedWifi { result = it }

    assertEquals(true, result)
    assertEquals("homeWifi", api.boundTo)
  }

  @Test
  fun bindToConnectedWifiReturnsFalseWithoutWifi() {
    var result: Boolean? = null

    controller.bindToConnectedWifi { result = it }

    assertEquals(false, result)
    assertNull(api.boundTo)
  }
}
