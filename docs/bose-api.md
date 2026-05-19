## BOSE SOUNDTOUCH WEB API

- Version 1. Bose Corporation
- 1 Document Version History Contents
- 2 Acronyms and Definitions
- 3 Legal Notice
- 4 Discovery Overview
- 5 SoundTouch Ecosystem
- 5.1 SoundTouch Experience
- 5.2 SoundTouch Speaker
- 5.3 SoundTouch App
- 5.4 SoundTouch Cloud Server (Deprecated)
- 5.5 Putting It Together
- 6 Discovery Protocols
- 6.1 SSDP (Simple Service Discovery Protocol)
- 6.1.1 SSDP Client
- 6.1.2 SSDP Service Provider
- 6.2 MDNS
- 7 Examples
- 7.1 SSDP
- 7.1.1 Client search and service providers reply
- 7.1.2 Service provider comes online and announces itself
- 7.1.3 Service provider’s previous announcement is about to expire
- 7.1.4 Service provider becomes unavailable due to a graceful shutdown
- 7.2 Zero-configuration
- 7.2.1 Client searches for service providers
- 8 Additional Resources
- 8.1 Software Tools for Development and Debugging
- 8.2 Web Resources for Further Information
- 9 Beyond Discovery
- 10 Web API Overview
- 10.1 Special types used by the SoundTouch Web API
- 11 General Status and Errors
- 12 API Methods/URLs
- 12.1 /key
- 12.2 /select
- 12.3 /sources
- 12.4 /bassCapabilities
- 12.5 /bass
- 12.6 /getZone
- 12.7 /setZone
- 12.8 /addZoneSlave
- 12.9 /removeZoneSlave
- 12.10 /nowPlaying
- 12.11 /trackInfo
- 12.12 /volume
- 12.13 /presets
- 12.14 /info
- 12.15 /name
- 12.16 /capabilities
- 12.17 /audiodspcontrols
- 12.18 /audioproducttonecontrols
- 12.19 /audioproductlevelcontrols
- 13 WebSockets
- 13.1 WebSocket Asynchronous Notifications
- 13.1.1 PresetsChangedNotifyUI
- 13.1.2 RecentsUpdatedNotifyUI
- 13.1.3 AcctModeChangedNotifyUI
- 13.1.4 ErrorNotification
- 13.1.5 NowPlayingChange
- 13.1.6 VolumeChange
- 13.1.7 BassChange
- 13.1.8 ZoneMapChange
- 13.1.9 SWUpdateStatusChange
- 13.1.10 SiteSurveyResultsChange
- 13.1.11 SourcesChange
- 13.1.12 NowSelectionChange
- 13.1.13 NetworkConnectionStatus
- 13.1.14 InfoChange, e.g., the device name changed
- 14 BOSE SOUNDTOUCH WEB API TERMS OF USE
- ADDENDUM A – MINIMUM TERMS FOR EULA

## 4 Discovery Overview

This document intends to describe the methods by which a SoundTouch speaker can be
discovered on a given network. The SoundTouch ecosystem will be broken down into individual
components and the roles and relationships of these components will help illustrate working
examples of discovery in a number of different scenarios. Further below, this document will
cover the Web Services API provided by the SoundTouch speakers.

## 5 SoundTouch Ecosystem

The SoundTouch ecosystem consists of a variety of components that work in harmony to
deliver a unified experience to a customer. The following components exist:

- SoundTouch Speaker
- SoundTouch App
- SoundTouch Cloud Server (Deprecated)

## 5.1 SoundTouch Experience

```
The SoundTouch unified experience starts with a customer's home network. The SoundTouch
speaker and the SoundTouch App work together during the out of box setup process to
configure a SoundTouch speaker to a customer's home network. This setup can happen via
wired ethernet or via wifi configuration in order to connect the SoundTouch speaker on to the
customer's home wifi access point.
```

## 5.2 SoundTouch Speaker

```
This is a speaker that may be in the form of one of the following available products:
```

- SoundTouch Portable music system - a battery powered, small, portable mono speaker
  with a display and built in buttons on the top of the speaker
- SoundTouch 20 music system - a medium sized one-piece speaker with display and
  built in buttons on the top of the speaker
- SoundTouch 30 music system - a large sized one-piece speaker with display and built in
  buttons on the top of the speaker
- Wave SoundTouch music system
- SoundTouch Stereo JC music system
- SoundTouch SA-4 amplier package
- SoundTouch outdoor speaker systems
- Cinemate home theater systems
- Lifestyle home theater systems
- VideoWave entertainment systems

## 5.3 SoundTouch App

```
This is the rich user interface that runs as a native app on Apple iOS devices and Google
Android devices.
```

```
The role of the App in general is to find SoundTouch speakers on the network using one of the
discovery protocols (SSDP, Bonjour) described in this document.
```

- SoundTouch App – Apple iOS
- SoundTouch App – Google Android

## 5.4 SoundTouch Cloud Server (Deprecated)

The SoundTouch cloud creates, stores, and updates accounts in the cloud. A cloud server
provides a central storage location for all things related to a particular SoundTouch account.
This includes things like the list of SoundTouch speakers available to the account. Examples of
some other information stored on the cloud include some of the following:

- A list of associated SoundTouch speaker products and related info such as the speaker
  name
- A list of recents for each product
- A list of presets for each product
- A list of logged-in music services/sources in the account

## 5.5 Putting It Together

Each of the components working together form a SoundTouch ecosystem. Any given
ecosystem may combine one or more SoundTouch speakers, one or more SoundTouch apps,
along with a single home network and a single SoundTouch cloud account (deprecated).
Within the SoundTouch app, the device tray will present a list of SoundTouch speakers
provided by the SoundTouch cloud account. Each speaker will show up in one of two possible
states depending on the outcome of device discovery on the home network between the
SoundTouch app and the SoundTouch speakers. If a speaker is not discovered using one of
the discovery protocols, then the speaker will be presented as a dotted outline in the device
tray. If the speaker is discovered and is available, then the speaker will be presented as a
solid-colored image within the device tray, indicating that it is ready to be interacted with.

In this example of how the app searches for SoundTouch speakers, it demonstrates the two
roles played where the app plays the role of the client (searcher, seeker) and the speaker
plays the role of the service provider (announcer, advertiser).

Third party developers integrating SoundTouch control functionality into apps or systems will
need to implement these discovery protocols in order to find and communicate with
SoundTouch devices on the network. Throughout this document, developers should use the
SoundTouch App as the example to follow for their own implementations.

## 6 Discovery Protocols

There are two discovery protocols that are used within the SoundTouch ecosystem. The first is
Simple Service Discovery Protocol (SSDP), and the second is Zero-configuration which has
implementations known as Bonjour and MDNS. The protocols provide redundancy and
variation which work in favor of providing more reliable discovery in a number of different
environments where port availability might vary.

## 6.1 SSDP (Simple Service Discovery Protocol)

## 6.1.1 SSDP Client

When a client wants to find devices that provide a specific service, it will do an M-SEARCH
over UDP multicast port 1900, with a service type header containing the type of service it is
looking for.

The two services used are

- urn:schemas-upnp-org:device:MediaRenderer:1 for devices that can play audio
  (SoundTouch speakers)
- urn:schemas-upnp-org:device:MediaServer:1 for devices that contain media
  (SoundTouch app and music server)

A client that wants to use services must continuously listen to UDP multicast and unicast port
1900 to receive replies to searches and also announcements from service providers.

A search should only be performed once per service type while the client is continuously
listening. If the client stops listening for some period of time then wants to start using services
again it must start listening again and perform another M-SEARCH.

When a service provider replies to a search or announces itself, it will provide a Location
header and an expiration time in the Cache-control:max-age header. The UPnP specification
species that the max-age must be a minimum of 1800 seconds, or 30 minutes.

All further communication to the service provider should be done via the address contained in
the Location header.

The client must keep track of the device expiry. If it has not heard a new announcement
containing a new expiration time from a service provider by the expiry time, it must consider
the device no longer available. This is to handle devices that go offline unexpectedly.

## 6.1.2 SSDP Service Provider

A device that wants to provide services must continuously listen to UDP multicast port 1900 to
receive search requests from clients.

When a device becomes available and wants to provide services it must send a NOTIFY over
UDP multicast port 1900 for each service type it provides along with an ssdp:alive, its uuid (via
the USN header) and an expiration time (in the Cache-control: max-age header). The uPnP

specification species that max-age must be a minimum of 1800s (30m); it also recommends
that initial notifications be sent more than once, but not more than three times, at random
intervals between 0 and 100ms.

When a device receives an M-SEARCH request for a service it provides it must send a reply
back via UDP unicast port 1900 to the originating requester containing its uuid (in the USN
header) and an expiration time (in the Cache-control: max-age header). The uPnP specication
species that max-age must be a minimum of 1800s (30m).

The device must keep track of when its notification/reply expiration times are about to occur
and re-send another NOTIFY with a new expiration time before the expiration happens. The
uPnP spec recommends that new NOTIFY messages be sent at randomly distributed intervals
of less than 1/2 the expiration time.

When a device's services become unavailable it must send a NOTIFY over UDP multicast port
1900 for each service type that will be unavailable along with an ssdp:byebye.

If the device has multiple network interfaces, it must listen and send notifications on all
interfaces that it wishes to provide services on. I.e. it's up to the device to decide which
interfaces it wants to provide services on and then listen, announce, and reply on those
interfaces.

## 6.2 MDNS

MDNS is the protocol that has implementations that go by the name of Zero-configuration,
Bonjour, and Avahi. Each are different implementations of the same discovery protocol that
allow systems on the same network to automatically discover each other and their capabilities
via advertised services. For service providers running Zero-configuration, the service types
used are:

- \_soundtouch.\_tcp.local for general SoundTouch capabilities
- \_raop.\_tcp.local for specific Airplay capabilities if available on a particular SoundTouch
  speaker

## 7 Examples

## 7.1 SSDP

## 7.1.1 Client search and service providers reply

## 7.1.2 Service provider comes online and announces itself

## 7.1.3 Service provider’s previous announcement is about to expire

**itself:**

## 7.1.4 Service provider becomes unavailable due to a graceful shutdown

## 7.2 Zero-configuration

## 7.2.1 Client searches for service providers

## 8 Additional Resources

## 8.1 Software Tools for Development and Debugging

Some of the following tools might be of use during development and debugging:

- Wireshark
- Avahi
- Bonjour Browser
- A DLNA controller that uses SSDP to find a media renderer device

## 8.2 Web Resources for Further Information

- [http://en.wikipedia.org/wiki/Simple_Service_Discovery_Protocol](http://en.wikipedia.org/wiki/Simple_Service_Discovery_Protocol)
- [http://en.wikipedia.org/wiki/Multicast_DNS](http://en.wikipedia.org/wiki/Multicast_DNS)

## 9 Beyond Discovery

Discovery is the first phase in allowing the SoundTouch speakers to be found prior to engaging
in communication with the speaker via the available WS API. Please refer to the Bose
SoundTouch Web API sections below for more information about the SoundTouch WS API.

## 10 Web API Overview

```
These commands are the primary interface to command and control a Bose
SoundTouch. They are sent over HTTP on port 8090 to the SoundTouch device you
would like to connect to using the GET and POST methods.
```

## 10.1 Special types used by the SoundTouch Web API

### ART_STATUS {

### INVALID

### SHOW_DEFAULT_IMAGE

### DOWNLOADING

### IMAGE_PRESENT

### }

```
BOOL: "true" or "false"
```

```
INT: a 32-bit integer
```

```
IPADDR: an IP address, represented as a string
```

```
KEY_VALUE {
PLAY
PAUSE
STOP
PREV_TRACK
NEXT_TRACK
THUMBS_UP
THUMBS_DOWN
BOOKMARK
POWER
MUTE
VOLUME_UP
VOLUME_DOWN
PRESET_
PRESET_
PRESET_
PRESET_
PRESET_
PRESET_
AUX_INPUT
SHUFFLE_OFF
SHUFFLE_ON
REPEAT_OFF
```

### REPEAT_ONE

### REPEAT_ALL

### PLAY_PAUSE

### ADD_FAVORITE

### REMOVE_FAVORITE

### INVALID_KEY

### }

### KEY_S

### TATE

### {

press
releas
e
}

MACADDR: a MAC address, upcased, represented as a string

PLAY_STATUS {
PLAY_STATE
PAUSE_STATE
STOP_STATE
BUFFERING_STATE
INVALID_PLAY_STATUS
}

PRESET_ID: An integer, 1 through 6 inclusive

SOURCE_STATUS {
UNAVAILABLE
READY
}

AUDIO_MODE {
AUDIO_MODE_DIRECT
AUDIO_MODE_NORMAL
AUDIO_MODE_DIALOG
AUDIO_MODE_NIGHT
}

STRING: any valid XML-escaped string

UINT: a 32-bit unsigned integer

UINT64: a 64-bit unsigned integer

URL: a URL, encoded as a string

Any get* command results in a HTTP GET command
Any set* command results in a HTTP POST command, i.e. requires a payload

## 11 General Status and Errors

For calls that do not have a special return payload, the default response is:

<status>$STRING</status>

For calls that can produce errors, the error response is:

<errors deviceID="$STRING">
<error value="$INT" name="$STRING"
severity="$STRING">$STRING</error> ...
</errors>

For malformed requests, i.e., wrong value the response is:

<error>XML parse error (1:116): Error reading Attributes.</error>

<errors deviceID="D05FB8A9591D"><error value="1019"
name="CLIENT_XML_ERROR" severity="Unknown">1019</error></errors>

## 12 API Methods/URLs

## 12.1 /key

Description: Keys are used as a simple means to interact with the SoundTouch speaker.
For a full listing of supported keys please see the list under KEY VALUE in section 4.

```
Send a remote button press to the device
```

GET:

N/A

POST:

<key state="$KEY_STATE" sender="$KEY_SENDER">$KEY_VALUE</key>

In general, it is good practice to send 2 discrete HTTP POST calls, the first using “press”
as the key state, and the second using “release” as the key state. Doing so simulates
both the press and release action of clicking a key. Possible values for “$KEY STATE” are
“press” or “release”.

The back to back message bodies will look like the following:

<key state="press" sender="Gabbo">$KEY_VALUE</key>

<key state="release" sender="Gabbo">$KEY_VALUE</key>

## 12.2 /select

Description:

```
Use this /select API to select any of the available sources. Sources available via this
/select API will vary based on product and on the SoundTouch account. Use the
/sources API to query the availability for the device.
```

GET:

N/A

POST:

Examples:

Sources available via this /select API will vary based on product.

Use the /sources API to view the availability for the

device. Below are some samples for Product,

Bluetooth and AUX

<ContentItem source="AUX" sourceAccount="AUX"></ContentItem>

<ContentItem source="AUX" sourceAccount="AUX3"></ContentItem>

<ContentItem source="BLUETOOTH"></ContentItem>

<ContentItem source="PRODUCT" sourceAccount="TV"></ContentItem>

## 12.3 /sources

Description:

```
List all available content
```

sources GET:

<sources deviceID="$MACADDR">
<sourceItem source="$SOURCE" sourceAccount="$STRING"
status="$SOURCE_STATUS">$STRING</sourceItem>
...
</sources>

### POST:

### N/A

## 12.4 /bassCapabilities

Description: Some speakers do not support the ability to customize the bass levels, use
this to find out whether bass customization is supported

```
Get or set bassCapabilities
```

GET:

<bassCapabilities deviceID="$MACADDR">
<bassAvailable>$BOOL</bassAvailable>
<bassMin>$INT</bassMin>
<bassMax>$INT</bassMax>
<bassDefault>$INT</bassDefault>
</bassCapabilties>

### POST:

### N/A

## 12.5 /bass

Description: Sets or gets the current bass setting for a particular speaker. This may or

may not be a supported capability, use the /bassCapabilities to find out whether a speaker

supports bass configuration Get or set bass

GET:

<bass deviceID="$MACADDR">
<targetbass>$INT</targetbass>
<actualbass>$INT</actualbass>
</bass>

### POST:

<bass>$INT</bass>

## 12.6 /getZone

Description:

```
Gets the current state of the multi-room zone from particular
```

device GET:

<zone master="$MACADDR">
<member
ipaddress="$MASTER_IPADDR">"$MASTER_MACAD
DR"</member>
<member
ipaddress="$SLAVE1_IPADDR">"$SLAVE1_MACADDR
"</member> ...
</zone>

## 12.7 /setZone

Description: Creates a

```
multi-room zone
```

GET:
N/A

POST:

<zone master="$MACADDR"
senderIPAddress="$IPADDR"> <member
ipaddress="$IPADDR">$MACADDR</me
mber> ...
</zone>

## 12.8 /addZoneSlave

Description:

```
Add a slave to a “play everywhere” zone
```

GET:

N/A
POST:

<zone master="$MACADDR">
<member
ipaddress="$IPADDR">$MACADDR</me
mber> ...
</zone>

## 12.9 /removeZoneSlave

Description:

```
Take a slave out of a “play everywhere” zone
```

GET:

N/A

POST:

<zone master="$MACADDR">
<member
ipaddress="$IPADDR">$MACADDR</me
mber> ...
</zone>

## 12.10 /nowPlaying

Description:

Gets all info about the currently playing media

GET:

<nowPlaying deviceID="$MACADDR" source="$SOURCE">
<ContentItem source="$SOURCE" location="$STRING" sourceAccount="$STRING"
isPresetable="$BOOL">
<itemName>$STRING</itemName>
</ContentItem>
<track>$STRING</track>
<artist>$STRING</artist>
<album>$STRING</album>
<stationName>$STRING</stationName>
<art artImageStatus="$ART_STATUS">$URL</art>
<playStatus>$PLAY_STATUS</playStatus>
<description>$STRING</description>
<stationLocation>$STRING</stationLocation>

</nowPlaying>

### POST:

### N/A

## 12.11 /trackInfo

Description: Get

track information

GET:

<nowPlaying deviceID="$MACADDR" source="$SOURCE">
<ContentItem source="$SOURCE" location="$STRING"
sourceAccount="$STRING" isPresetable="$BOOL">
<itemName>$STRING</itemName>
</ContentItem>
<track>$STRING</track>
<artist>$STRING</artist>
<album>$STRING</album>
<stationName>$STRING</stationName>
<art artImageStatus="$ART_STATUS">$URL</art>
<playStatus>$PLAY_STATUS</playStatus>
<description>$STRING</description>
<stationLocation>$STRING</stationLocation>
</nowPlaying>

### POST:

### N/A

## 12.12 /volume

Description:

```
Get or Set the volume and mute status for this SoundTouch
```

```
device Volume ranges between 0, 100 inclusive.
```

GET:

<volume deviceID="$MACADDR">
<targetvolume>$INT</targetvolume>

<actualvolume>$INT</actualvolume>
<muteenabled>$BOOL</muteenabled>
</volume>

### POST:

```
The muteenabled setting is applied first, if present. The system will be unmuted if the
volume value is larger than the current volume setting.
```

<volume>$INT<muteenabled>$BOOL</muteenabled></volume>

## 12.13 /presets

Description: Presets are a core part of the SoundTouch ecosystem. A preset is used to
set and recall a specific music stream supported by the SoundTouch speaker

```
List of current Presets
```

GET:

<presets>
<preset id="$PRESET_ID" createdOn="$UINT64" updateOn="$UINT64">
<ContentItem source="$SOURCE" location="$STRING"
sourceAccount="$STRING" isPresetable="$BOOL">
<itemName>$STRING</itemName>
</ContentItem>
</preset>

</presets>

### POST:

### N/A

## 12.14 /info

Description:

```
Get device information; mostly static device info such as device id,
```

type, IP address (per component if applicable), cloud account ID,

software version, product version and component type and version

GET:

<info deviceID="$MACADDR">
<name>$STRING</name>
<type>$STRING</type>
<margeAccountUUID>$STRING</margeAccountUUID>
<components>
<component>
<componentCategory>$STRING</componentCategory>
<softwareVersion>$STRING</softwareVersion>
<serialNumber>$STRING</serialNumber>
</component
> ...
</components>
<margeURL>$URL</margeURL>
<networkInfo type="$STRING">
<macAddress>$MACADDR</macAddress>
<ipAddress>$IPADDR</ipAddress>
</networkInfo>

</info>

### POST:

### N/A

## 12.15 /name

Description: Set

```
the device name
```

GET:

N/A

POST:

<name>$STRING</name>

## 12.16 /capabilities

Description:

```
Retrieve specific system capabilities. Listed in the reply to GET of this URL may be
optional additional URLs. Clients should only attempt to access such URLs if they
are present in this reply.
For each capability, this reply provides a unique name to be used in identification, the url
to be used for access, and optionally other related information to be used by the
client.
```

GET:

<capabilities
deviceID="$MACADDR"> ...
<capability name="$STRING" url="/$STRING" info="$STRING"/>
<capability name="$STRING" url="/$STRING"
info="$STRING"/> ...
</capabilities>

### POST:

### N/A

## 12.17 /audiodspcontrols

Description:

```
Accesses the system DSP settings.
Only available if audiodspcontrols is listed in the reply to GET /capabilities.
supportedaudiomodes conveys the set of audiomode values that are supported by
the system and are accepted by POST.
```

GET:

<audiodspcontrols audiomode="$AUDIO_MODE" videosyncaudiodelay="0"
supportedaudiomodes="$AUDIO_MODE|$AUDIO_MODE..."/>

### POST:

```
If audiomode or videosyncaudiodelay are not included in the POST, they would not be
changed.
```

<audiodspcontrols audiomode="$AUDIO_MODE" videosyncaudiodelay="$UINT"/>

## 12.18 /audioproducttonecontrols

Description:

```
Accesses the system bass and treble settings.
Only available if audioproducttonecontrols is listed in the reply to GET /capabilities.
minValue, maxValue and step convey the restrictions imposed on the POST value.
```

GET:

<audioproducttonecontrols>
<bass value="$INT" minValue="$INT" maxValue="$INT" step="$UINT"/>
<treble value="$INT" minValue="$INT" maxValue="$INT" step="$UINT"/>
</audioproducttonecontrols>

### POST:

```
If bass or treble are not included in the POST, they would not be changed.
```

<audioproducttonecontrols>
<bass value="$INT" />
<treble value="$INT" />
</audioproducttonecontrols>

## 12.19 /audioproductlevelcontrols

Description:

```
Accesses the system front-center and rear-surround level settings.
Only available if audioproductlevelcontrols is listed in the reply to GET /capabilities.
minValue, maxValue and step convey the restrictions imposed on the POST value.
```

GET:

<audioproductlevelcontrols>
<frontCenterSpeakerLevel value="$INT" minValue="$INT" maxValue="$INT"
step="$UINT"/>
<rearSurroundSpeakersLevel value="$INT" minValue="$INT" maxValue="$INT"
step="$UINT"/> </audioproductlevelcontrols>

### POST:

```
If frontCenterSpeakerLevel or rearSurroundSpeakersLevel are not included in the POST,
they would not be changed.
```

<audioproductlevelcontrols>
<frontCenterSpeakerLevel value="$INT" />
<rearSurroundSpeakersLevel value="$INT" />
</audioproductlevelcontrols>

## 13 WebSockets

```
Notifications are server initiated WebSocket messages which inform client(s) of
changes in SoundTouch device. They serve to keep clients in sync with the
server. They are sent over HTTP on port 8080 via a WebSocket connection
which is initiated from a WebSocket client. The WebSocket connection offers an
advantage over HTTP because it allows for bidirectional communication, which
allows for asynchronous notifications to be initiated from the server side
(SoundTouch device) to the client connection.
```

## 13.1 WebSocket Asynchronous Notifications

After a successful WebSocket connection has been established, the simplest thing a client
can do is to listen for the asynchronous notifications that are published by the SoundTouch
device.

The incomplete example below shows examples of a single update notification describing
what changed on the SoundTouch device. This will help inform the client, if it is interested,
to perform a new request for the updated values. In some cases the notification does not
contain the changed information, but for convenience, in other cases it may. Creating the
websocket:

When creating a client websocket connection, be sure to specify the protocol as “gabbo”.
An example javascript example is shown below.

socket = new WebSocket("ws://$IP", "gabbo")

Examples:

<updates deviceID="$MACADDR">

</updates>

<updates deviceID="$MACADDR">
<volume>
<targetvolume>$INT</targetvolume>
<actualvolume>$INT</actualvolume>
</volume>
</updates>

## 13.1.1 PresetsChangedNotifyUI

Description: When a preset is changed in any way like added, cleared, or modified the
SoundTouch speaker will send this asynchronous notification. This is a signal for the
WAPI client to request the new list of presets via the /presets API

<updates deviceID="$MACADDR">
<presetsUpdated>
<presets>
<preset id="$INT">
<ContentItem source="$SOURCE" location="$STRING" sourceAccount=""
isPresetable="$BOOL">
<itemName>$STRING</itemName>
</ContentItem>
</preset>
<preset id="$INT">
<ContentItem source="$SOURCE" location="$STRING"
sourceAccount="$STRING" isPresetable="$BOOL">
<itemName>STRING</itemName>
</ContentItem>
</preset>
<preset id="$INT">
<ContentItem source="$SOURCE" location="$STRING"
sourceAccount="STRING" isPresetable="$BOOL">
<itemName>$STRING</itemName>
</ContentItem>
</preset>
<preset id="$INT" createdOn="$UINT64" updatedOn="$UINT64">
<ContentItem source="$SOURCE" location="$STRING" sourceAccount=""
isPresetable="$BOOL">
<itemName>$STRING</itemName>
</ContentItem>
</preset>
</presets>
</presetsUpdated>
</updates>

## 13.1.2 RecentsUpdatedNotifyUI

Description: When the recents list is changed in any way like a recent is added, removed,
or moved within the list, the SoundTouch speaker will send this asynchronous notification.
This is a signal for the WAPI client to request the new list of recents via the /recents API

<updates deviceID=’$MACADDR’>
<recentsUpdated>
<recents>
<recent deviceID="$MACADDR" utcTime="$UINT64">
<contentItem source="$SOURCE" location="$STRING"
sourceAccount="$STRING" isPresetable="$BOOL">
<itemName>$STRING</itemName>
</contentItem>
</recent>
<recent deviceID="$MACADDR" utcTime="$UINT64">
<contentItem source="$SOURCE" location="$STRING" sourceAccount=""
isPresetable="$BOOL">
<itemName>$STRING</itemName>
</contentItem>
</recent>
<recent deviceID="$MACADDR" utcTime="$UINT64">
<contentItem source="$SOURCE" location="$STRING" sourceAccount=""
isPresetable="$BOOL">
<itemName>$STRING</itemName>
</contentItem>
</recent>
</recents>
</recentsUpdated>
</updates>

## 13.1.3 AcctModeChangedNotifyUI

Description: When the SoundTouch speaker’s association with a cloud account changes
then this asynchronous notification will be sent

<updates deviceID=’$MACADDR’>
<acctModeUpdated>
</acctModeUpdated>
</updates>"

## 13.1.4 ErrorNotification

ErrorNotification

## 13.1.5 NowPlayingChange

<updates deviceID="$MACADDR">
<nowPlayingUpdated><nowPlaying deviceID="$MACADDR" source="$SOURCE">
<ContentItem source="$SOURCE" location="$STRING" sourceAccount=""
isPresetable="$BOOL">
<itemName>$STRING</itemName>
</ContentItem>
<track/>
<artist/>
<album/>
<stationName>$STRING</stationName>
<art artImageStatus="$ART_STATUS">$URL</art>
<playStatus>$PLAY_STATUS</playStatus>
<description>$STRING</description>
<stationLocation>$STRING</stationLocation>
</nowPlaying>
</nowPlayingUpdated>
</updates>

## 13.1.6 VolumeChange

<updates deviceID="$MACADDR">
<volumeUpdated/>
</updates>

## 13.1.7 BassChange

<updates deviceID="$MACADDR">
<bassUpdated/>
</updates>

## 13.1.8 ZoneMapChange

<updates deviceID="$MACADDR">
<zoneUpdated/>
</updates>

**\* Slave device joining a zone**

<updates deviceID="slave $MACADDR">
<zoneUpdated/>
</updates>
<updates deviceID="slave $MACADDR">
<volumeUpdated/>
</updates>
<updates deviceID="slave $MACADDR">
<volumeUpdated/>
</updates>
<updates deviceID="slave $MACADDR">
<nowPlayingUpdated/>
</updates>

**\* Slave device leaving a zone**

<updates deviceID="slave $MACADDR">
<zoneUpdated/>
</updates>
<updates deviceID="slave $MACADDR">
<nowPlayingUpdated/>
</updates>

**\* Master device notifies any time a slave device joins its zone**

<updates deviceID="slave $MACADDR">
<zoneUpdated/>
</updates>

<updates deviceID="slave $MACADDR">
<nowPlayingUpdated/>
</updates>

**\* Master device notifies any time a slave device leaves its zone**

<updates deviceID="$MACADDR">
<zoneUpdated/>
</updates>
<updates deviceID="$MACADDR">
<zoneUpdated/>
</updates>

## 13.1.9 SWUpdateStatusChange

Description: While this may happen in general, it is not important and there is no need to
take any action when this is received

<updates deviceID="$MACADDR">
<swUpdateStatusUpdated/>
</updates>

## 13.1.10 SiteSurveyResultsChange

Description: While this may happen in general, it is not important and there is no need to
take any action when this is received

<updates deviceID="$MACADDR">
<siteSurveyResultsUpdated/>
</updates>

## 13.1.11 SourcesChange

<updates deviceID="$MACADDR">
<sourcesUpdated/>
</updates>

## 13.1.12 NowSelectionChange

<updates deviceID="$MACADDR">
<nowSelectionUpdated>
<preset id="$INT">
<ContentItem source="$SOURCE" location="$STRING"
sourceAccount="$STRING" isPresetable="$BOOL">
<itemName>$STRING</itemName>
</ContentItem>
</preset>
</nowSelectionUpdated>
</updates>

## 13.1.13 NetworkConnectionStatus

<updates deviceID="$MACADDR">
<connectionStateUpdated/>
</updates>

## 13.1.14 InfoChange, e.g., the device name changed

<updates deviceID="$MACADDR">
<infoUpdated/>
</updates>
