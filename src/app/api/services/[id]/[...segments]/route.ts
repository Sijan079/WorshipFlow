import * as automationBatchRoute from "../automation-batches/route";
import * as automationBatchDeleteRoute from "../automation-batches/[batchId]/route";
import * as blockPeopleRoute from "../blocks/[blockId]/people/route";
import * as blockPersonRoute from "../blocks/[blockId]/people/[personId]/route";
import * as detailsRoute from "../details/route";
import * as extractorRoute from "../extractor/route";
import * as extractorAiRoute from "../extractor/ai/route";
import * as extractorDocxRoute from "../extractor/docx/route";
import * as jobsRoute from "../jobs/route";
import * as jobDownloadRoute from "../jobs/[jobId]/download/route";
import * as outputDownloadRoute from "../outputs/[outputId]/download/route";
import * as serviceSongsRoute from "../songs/route";
import * as serviceSongRoute from "../songs/[serviceSongId]/route";

type CatchAllParams = {
  params: Promise<{ id: string; segments: string[] }>;
};

type RouteParams = {
  params: Promise<Record<string, string>>;
};

type Handler = (request: Request, context: RouteParams) => Promise<Response>;
type ResolvedRoute = {
  module: Record<string, unknown>;
  params: Record<string, string>;
};

function withParams(params: Record<string, string>): RouteParams {
  return { params: Promise.resolve(params) };
}

function notFound() {
  return Response.json({ error: "Service API route not found" }, { status: 404 });
}

async function resolveRoute(context: CatchAllParams): Promise<ResolvedRoute | null> {
  const { id, segments } = await context.params;
  const [first, second, third, fourth] = segments;

  if (first === "extractor" && !second) {
    return { module: extractorRoute, params: { id } };
  }

  if (first === "extractor" && second === "ai" && !third) {
    return { module: extractorAiRoute, params: { id } };
  }

  if (first === "extractor" && second === "docx" && !third) {
    return { module: extractorDocxRoute, params: { id } };
  }

  if (first === "jobs" && !second) {
    return { module: jobsRoute, params: { id } };
  }

  if (first === "jobs" && second && third === "download" && !fourth) {
    return { module: jobDownloadRoute, params: { id, jobId: second } };
  }

  if (first === "outputs" && second && third === "download" && !fourth) {
    return { module: outputDownloadRoute, params: { id, outputId: second } };
  }

  if (first === "automation-batches" && !second) {
    return { module: automationBatchRoute, params: { id } };
  }

  if (first === "automation-batches" && second && !third) {
    return { module: automationBatchDeleteRoute, params: { id, batchId: second } };
  }

  if (first === "details" && !second) {
    return { module: detailsRoute, params: { id } };
  }

  if (first === "songs" && !second) {
    return { module: serviceSongsRoute, params: { id } };
  }

  if (first === "songs" && second && !third) {
    return { module: serviceSongRoute, params: { id, serviceSongId: second } };
  }

  if (first === "blocks" && second && third === "people" && !fourth) {
    return { module: blockPeopleRoute, params: { id, blockId: second } };
  }

  if (first === "blocks" && second && third === "people" && fourth) {
    return { module: blockPersonRoute, params: { id, blockId: second, personId: fourth } };
  }

  return null;
}

async function dispatch(request: Request, context: CatchAllParams, method: string) {
  const resolved = await resolveRoute(context);
  if (!resolved) {
    return notFound();
  }

  const handler = resolved.module[method as keyof typeof resolved.module] as Handler | undefined;
  if (!handler) {
    return new Response(null, { status: 405 });
  }

  return handler(request, withParams(resolved.params));
}

export async function GET(request: Request, context: CatchAllParams) {
  return dispatch(request, context, "GET");
}

export async function POST(request: Request, context: CatchAllParams) {
  return dispatch(request, context, "POST");
}

export async function PUT(request: Request, context: CatchAllParams) {
  return dispatch(request, context, "PUT");
}

export async function DELETE(request: Request, context: CatchAllParams) {
  return dispatch(request, context, "DELETE");
}
