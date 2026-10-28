---
"bose-api-speaker-client": patch
"@revive-st/app": patch
"@revive-st/api": patch
---

Text and attribute values from the speaker are decoded once when parsed, so titles like "Sebastian &amp; Rajé" show as "Sebastian & Rajé". Values sent back to the speaker, such as preset names and locations, are no longer escaped twice.
