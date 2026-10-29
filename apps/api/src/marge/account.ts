import { Schema } from "effect";

/**
 * The Marge account a speaker is paired with (its `margeAccountUUID`). Each
 * household gets an unguessable one, so knowing it is what grants access to
 * the household's presets.
 */
export const AccountId = Schema.String.check(Schema.isNonEmpty()).pipe(
  Schema.brand("AccountId"),
);
export type AccountId = typeof AccountId.Type;
