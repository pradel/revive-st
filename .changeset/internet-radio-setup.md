---
"@revive-st/app": patch
---

App: setting up a speaker for internet radio is redesigned. A first screen explains what happens and asks before anything changes; progress shows four plain steps instead of a telnet log, and a failure says what went wrong with a way out (try again, or check again after a slow restart). Setup now writes all four server addresses before saving them, reads them back before and after the restart, finds the speaker again if it comes back on another address, and finishes only once the speaker has contacted the server. A setup keeps running when you leave the screen, and the speaker's settings show its progress. The speaker's status reads "Ready" only when it uses the server and is paired with an account.
