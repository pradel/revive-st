import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import { NextResponse, type NextRequest } from "next/server";

import { docsContentRoute, docsRoute } from "@/lib/shared";

// oxlint-disable-next-line typescript/unbound-method
const { rewrite: rewriteDocs } = rewritePath(
  `${docsRoute}{/*path}`,
  `${docsContentRoute}{/*path}/content.md`,
);
// oxlint-disable-next-line typescript/unbound-method
const { rewrite: rewriteSuffix } = rewritePath(
  `${docsRoute}{/*path}.md`,
  `${docsContentRoute}{/*path}/content.md`,
);

export default function proxy(request: NextRequest) {
  const result = rewriteSuffix(request.nextUrl.pathname);
  if (result) {
    return NextResponse.rewrite(new URL(result, request.nextUrl));
  }

  if (isMarkdownPreferred(request)) {
    // oxlint-disable-next-line no-shadow
    const result = rewriteDocs(request.nextUrl.pathname);

    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl));
    }
  }

  return NextResponse.next();
}
