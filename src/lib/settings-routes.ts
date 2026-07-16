import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { getActiveWorkspaceId } from "@/lib/security-context";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type SafeParseSchema<T> = {
  safeParse(input: unknown):
    | { success: true; data: T }
    | { success: false; error: { format(): unknown } };
};

export type SettingsListDelegate = {
  count(args: { where: { workspaceId: string } }): Promise<number>;
  findMany(args: { where: { workspaceId: string }; orderBy: unknown }): Promise<unknown[]>;
  create(args: { data: Record<string, unknown> & { workspaceId: string; isDefault: boolean } }): Promise<unknown>;
  findUnique(args: { where: { id: string; workspaceId: string } }): Promise<{ isDefault: boolean } | null>;
  update(args: { where: { id: string; workspaceId: string }; data: Record<string, unknown> }): Promise<unknown>;
  delete(args: { where: { id: string; workspaceId: string } }): Promise<unknown>;
};

type CollectionMessages = {
  load: string;
  create: string;
  notFound: string;
  defaultDelete: string;
  update: string;
  delete: string;
};

type CollectionConfig<TCreate, TUpdate> = {
  delegate: SettingsListDelegate;
  seed(workspaceId: string): Promise<unknown>;
  createSchema: SafeParseSchema<TCreate>;
  updateSchema: SafeParseSchema<TUpdate>;
  orderBy: unknown;
  path: string;
  messages: CollectionMessages;
};

export function createSettingsCollectionHandlers<TCreate extends Record<string, unknown>, TUpdate extends Record<string, unknown>>(
  config: CollectionConfig<TCreate, TUpdate>,
) {
  async function GET() {
    try {
      const workspaceId = await getActiveWorkspaceId(prisma);
      await config.seed(workspaceId);
      const records = await config.delegate.findMany({
        where: { workspaceId },
        orderBy: config.orderBy,
      });
      return NextResponse.json(records);
    } catch (error: unknown) {
      console.error(`GET ${config.path} error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, config.messages.load) }, { status: 500 });
    }
  }

  async function POST(request: Request) {
    try {
      const workspaceId = await getActiveWorkspaceId(prisma);
      const parsed = config.createSchema.safeParse(await request.json());

      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
      }

      const record = await config.delegate.create({
        data: { ...parsed.data, workspaceId, isDefault: false },
      });
      return NextResponse.json(record, { status: 201 });
    } catch (error: unknown) {
      console.error(`POST ${config.path} error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, config.messages.create) }, { status: 500 });
    }
  }

  async function PUT(request: Request, { params }: RouteParams) {
    try {
      const { id } = await params;
      const workspaceId = await getActiveWorkspaceId(prisma);
      const parsed = config.updateSchema.safeParse(await request.json());

      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
      }

      const record = await config.delegate.update({
        where: { id, workspaceId },
        data: parsed.data,
      });
      return NextResponse.json(record);
    } catch (error: unknown) {
      console.error(`PUT ${config.path}/[id] error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, config.messages.update) }, { status: 500 });
    }
  }

  async function DELETE(_request: Request, { params }: RouteParams) {
    try {
      const { id } = await params;
      const workspaceId = await getActiveWorkspaceId(prisma);
      const record = await config.delegate.findUnique({ where: { id, workspaceId } });

      if (!record) {
        return NextResponse.json({ error: config.messages.notFound }, { status: 404 });
      }

      if (record.isDefault) {
        return NextResponse.json({ error: config.messages.defaultDelete }, { status: 400 });
      }

      await config.delegate.delete({ where: { id, workspaceId } });
      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      console.error(`DELETE ${config.path}/[id] error:`, error);
      return NextResponse.json({ error: getErrorMessage(error, config.messages.delete) }, { status: 500 });
    }
  }

  return { GET, POST, PUT, DELETE };
}
