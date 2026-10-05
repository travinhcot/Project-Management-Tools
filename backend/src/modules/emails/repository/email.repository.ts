import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Campaign,
  CampaignListQuery,
  CampaignRow,
  ClaimedCampaign,
  Delivery,
  DeliveryListQuery,
  DeliveryOutcome,
  KickoffRef,
  KickoffSummary,
  ResolveAction,
  SendJob,
} from "../model/email.model.ts";

type WithTotal<T> = T & { total_count: number | string };

function toCampaign(row: WithTotal<Campaign>): Campaign {
  const { total_count: _total, ...campaign } = row;
  return {
    ...campaign,
    estimated_recipients: Number(row.estimated_recipients),
    delivery_counts: Object.fromEntries(
      Object.entries(row.delivery_counts ?? {}).map(([key, n]) => [
        key,
        Number(n),
      ]),
    ),
  };
}

function toRow(row: CampaignRow): CampaignRow {
  return {
    id: row.id,
    semester_id: row.semester_id,
    project_id: row.project_id,
    kind: row.kind,
    status: row.status,
    scheduled_at: row.scheduled_at,
    parent_campaign_id: row.parent_campaign_id,
    cancelled_at: row.cancelled_at,
  };
}

export function createEmailRepository(client: SupabaseClient) {
  async function campaignPage(
    filters: {
      campaignId?: string;
      semesterId?: string;
      kind?: string;
      status?: string;
    },
    limit: number,
    offset: number,
  ) {
    const { data, error } = await client.rpc("admin_list_campaigns", {
      p_campaign_id: filters.campaignId ?? null,
      p_semester_id: filters.semesterId ?? null,
      p_kind: filters.kind ?? null,
      p_status: filters.status ?? null,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;
    return (data ?? []) as WithTotal<Campaign>[];
  }

  async function deliveryPage(
    campaignId: string,
    query: DeliveryListQuery,
    limit: number,
    offset: number,
  ) {
    const { data, error } = await client.rpc("admin_list_deliveries", {
      p_campaign_id: campaignId,
      p_status: query.status ?? null,
      p_search: query.search ?? null,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;
    return (data ?? []) as WithTotal<Delivery>[];
  }

  async function rowRpc(fn: string, params: Record<string, unknown>) {
    const { data, error } = await client.rpc(fn, params);
    if (error) throw error;
    return toRow(data as CampaignRow);
  }

  return {
    async listCampaigns(
      query: CampaignListQuery,
    ): Promise<{ rows: Campaign[]; total: number }> {
      const filters = {
        semesterId: query.semesterId,
        kind: query.kind,
        status: query.status,
      };
      const rows = await campaignPage(
        filters,
        query.size,
        (query.page - 1) * query.size,
      );
      let total = Number(rows[0]?.total_count ?? 0);
      if (rows.length === 0 && query.page > 1) {
        // Past the last page the window count has no row to ride on; ask for the first row.
        const first = await campaignPage(filters, 1, 0);
        total = Number(first[0]?.total_count ?? 0);
      }
      return { rows: rows.map(toCampaign), total };
    },

    async findCampaign(campaignId: string): Promise<Campaign | null> {
      const rows = await campaignPage({ campaignId }, 1, 0);
      return rows[0] ? toCampaign(rows[0]) : null;
    },

    async listDeliveries(
      campaignId: string,
      query: DeliveryListQuery,
    ): Promise<{ rows: Delivery[]; total: number }> {
      const rows = await deliveryPage(
        campaignId,
        query,
        query.size,
        (query.page - 1) * query.size,
      );
      let total = Number(rows[0]?.total_count ?? 0);
      if (rows.length === 0 && query.page > 1) {
        const first = await deliveryPage(campaignId, query, 1, 0);
        total = Number(first[0]?.total_count ?? 0);
      }
      return {
        rows: rows.map(({ total_count: _total, ...delivery }) => delivery),
        total,
      };
    },

    async findActiveKickoff(projectId: string): Promise<KickoffRef | null> {
      const { data, error } = await client
        .from("email_campaigns")
        .select("id,status,scheduled_at")
        .eq("project_id", projectId)
        .eq("kind", "KICKOFF")
        .in("status", ["DRAFT", "SCHEDULED", "PROCESSING"])
        .maybeSingle();
      if (error) throw error;
      return data as KickoffRef | null;
    },

    /** Latest non-cancelled kick-off per project, one query. */
    async latestKickoffs(
      projectIds: readonly string[],
    ): Promise<Map<string, KickoffSummary>> {
      const result = new Map<string, KickoffSummary>();
      if (projectIds.length === 0) return result;
      const { data, error } = await client
        .from("email_campaigns")
        .select("id,project_id,status,scheduled_at")
        .eq("kind", "KICKOFF")
        .neq("status", "CANCELLED")
        .in("project_id", [...projectIds])
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      for (const row of (data ?? []) as (KickoffSummary & {
        project_id: string;
      })[]) {
        if (result.has(row.project_id)) continue;
        result.set(row.project_id, {
          id: row.id,
          status: row.status,
          scheduled_at: row.scheduled_at,
        });
      }
      return result;
    },

    scheduleKickoff(input: {
      actorId: string;
      projectId: string;
      scheduledAt: string | null;
      sendNow: boolean;
      requestId: string;
    }) {
      return rowRpc("admin_schedule_kickoff", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_scheduled_at: input.scheduledAt,
        p_send_now: input.sendNow,
        p_request_id: input.requestId,
      });
    },

    scheduleDemo(input: {
      actorId: string;
      semesterId: string;
      scheduledAt: string | null;
      sendNow: boolean;
      requestId: string;
    }) {
      return rowRpc("admin_schedule_demo", {
        p_actor_id: input.actorId,
        p_semester_id: input.semesterId,
        p_scheduled_at: input.scheduledAt,
        p_send_now: input.sendNow,
        p_request_id: input.requestId,
      });
    },

    sendNow(input: { actorId: string; campaignId: string; requestId: string }) {
      return rowRpc("admin_send_campaign_now", {
        p_actor_id: input.actorId,
        p_campaign_id: input.campaignId,
        p_request_id: input.requestId,
      });
    },

    reschedule(input: {
      actorId: string;
      campaignId: string;
      scheduledAt: string;
      requestId: string;
    }) {
      return rowRpc("admin_reschedule_campaign", {
        p_actor_id: input.actorId,
        p_campaign_id: input.campaignId,
        p_scheduled_at: input.scheduledAt,
        p_request_id: input.requestId,
      });
    },

    cancel(input: { actorId: string; campaignId: string; requestId: string }) {
      return rowRpc("admin_cancel_campaign", {
        p_actor_id: input.actorId,
        p_campaign_id: input.campaignId,
        p_request_id: input.requestId,
      });
    },

    resend(input: { actorId: string; campaignId: string; requestId: string }) {
      return rowRpc("admin_resend_campaign", {
        p_actor_id: input.actorId,
        p_campaign_id: input.campaignId,
        p_request_id: input.requestId,
      });
    },

    async retryFailures(input: {
      actorId: string;
      campaignId: string;
      requestId: string;
    }): Promise<number> {
      const { data, error } = await client.rpc("admin_retry_failed_deliveries", {
        p_actor_id: input.actorId,
        p_campaign_id: input.campaignId,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return Number(data);
    },

    async resolveDelivery(input: {
      actorId: string;
      campaignId: string;
      deliveryId: string;
      action: ResolveAction;
      requestId: string;
    }): Promise<string> {
      const { data, error } = await client.rpc(
        "admin_resolve_unknown_delivery",
        {
          p_actor_id: input.actorId,
          p_campaign_id: input.campaignId,
          p_delivery_id: input.deliveryId,
          p_action: input.action,
          p_request_id: input.requestId,
        },
      );
      if (error) throw error;
      return data as string;
    },

    async claimDueCampaigns(limit: number): Promise<ClaimedCampaign[]> {
      const { data, error } = await client.rpc("email_claim_due_campaigns", {
        p_limit: limit,
      });
      if (error) throw error;
      return (
        (data ?? []) as {
          claimed_campaign_id: string;
          recipient_count: number;
        }[]
      ).map((row) => ({
        campaign_id: row.claimed_campaign_id,
        recipients: Number(row.recipient_count),
      }));
    },

    async claimDueDeliveries(
      limit: number,
      leaseSeconds: number,
    ): Promise<SendJob[]> {
      const { data, error } = await client.rpc("email_claim_due_deliveries", {
        p_limit: limit,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw error;
      return (data ?? []) as SendJob[];
    },

    async recordResult(input: {
      deliveryId: string;
      outcome: DeliveryOutcome;
      messageId?: string;
      errorCode?: string;
      errorSummary?: string;
    }): Promise<void> {
      const { error } = await client.rpc("email_record_delivery_result", {
        p_delivery_id: input.deliveryId,
        p_outcome: input.outcome,
        p_message_id: input.messageId ?? null,
        p_error_code: input.errorCode ?? null,
        p_error_summary: input.errorSummary ?? null,
      });
      if (error) throw error;
    },

    async finalizeDueCampaigns(): Promise<number> {
      const { data, error } = await client.rpc("email_finalize_due_campaigns");
      if (error) throw error;
      return Number(data);
    },
  };
}

export type EmailRepository = ReturnType<typeof createEmailRepository>;
