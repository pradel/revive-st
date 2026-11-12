/** A speaker's side in a stereo pair: the master plays LEFT. */
export type GroupRole = "LEFT" | "RIGHT";

export interface GroupMember {
  deviceId: string;
  role: GroupRole;
  ipAddress: string;
}

/**
 * A stereo pair of two SoundTouch 10s, as `/getGroup` reports it. Distinct
 * from a multiroom zone.
 */
export interface SpeakerGroup {
  id: string;
  name: string;
  masterDeviceId: string;
  roles: GroupMember[];
  senderIpAddress?: string;
  /** `status` as the speaker reports it: GROUP_OK, GROUP_ERROR, GROUP_CONNECTING, … */
  status?: string;
}

/** A pair to create with `/addGroup`, sent to the master only. */
export interface NewGroup {
  name: string;
  masterDeviceId: string;
  roles: GroupMember[];
}
