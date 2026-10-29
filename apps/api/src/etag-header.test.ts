import { once } from "node:events";
import {
  createServer,
  get,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import { assert, it } from "@effect/vitest";

import { EtagCasingServerResponse } from "./etag-header.ts";

const headers = { etag: "abc", "content-type": "text/xml" };

/** The raw header names of one response whose head `writeHead` writes. */
const rawHeaderNames = async (
  writeHead: (response: ServerResponse) => void,
): Promise<string[]> => {
  const server = createServer(
    { ServerResponse: EtagCasingServerResponse },
    (_request, response) => {
      writeHead(response);
      response.end();
    },
  );
  server.listen(0);
  await once(server, "listening");
  try {
    const { port } = server.address() as AddressInfo;
    const [response] = (await once(get({ port, path: "/" }), "response")) as [
      IncomingMessage,
    ];
    response.resume();
    return response.rawHeaders.filter((_name, index) => index % 2 === 0);
  } finally {
    server.close();
  }
};

it.each([
  [
    "headers only",
    (response: ServerResponse) => response.writeHead(200, headers),
  ],
  [
    "a status message",
    (response: ServerResponse) => response.writeHead(200, "OK", headers),
  ],
  // How @effect/platform-node writes every response head.
  [
    "an undefined status message",
    (response: ServerResponse) => response.writeHead(200, undefined, headers),
  ],
] as const)(
  "spells etag as ETag, keeping other headers, given %s",
  async (_label, writeHead) => {
    const names = await rawHeaderNames(writeHead);
    assert.include(names, "ETag");
    assert.notInclude(names, "etag");
    assert.include(names, "content-type");
  },
);
