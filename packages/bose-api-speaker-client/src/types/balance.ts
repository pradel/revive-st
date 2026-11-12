/**
 * A stereo pair's left/right balance, as `/balance` reports it; negative is
 * to the left. Both speakers of a pair report the same value. An unpaired
 * speaker reports `balanceAvailable: false`.
 */
export interface BalanceResponse {
  deviceID: string;
  balanceAvailable: boolean;
  balanceMin: number;
  balanceMax: number;
  balanceDefault: number;
  /** The value last set. */
  targetBalance: number;
  /** The value playing, which ramps towards `targetBalance`. */
  actualBalance: number;
}
