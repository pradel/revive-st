import { HttpApi } from "effect/http-api";

import { BmxApi } from "./bmx.ts";
import { InternalApi } from "./internal.ts";
import { MargeApi } from "./marge.ts";

export class ReviveApi extends HttpApi.make("revive-st")
  .add(MargeApi)
  .add(BmxApi)
  .add(InternalApi) {}
