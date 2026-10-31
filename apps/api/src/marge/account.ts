import { Schema } from "effect";

/**
 * The Marge account a speaker is paired with (its `margeAccountUUID`). Each
 * household gets an unguessable one, so knowing it is what grants access to
 * the household's presets. Speakers paired elsewhere keep their own: a Bose
 * account number, a word. At most 64 characters, so made-up ids stay small.
 */
export const AccountId = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(64),
).pipe(Schema.brand("AccountId"));
export type AccountId = typeof AccountId.Type;
