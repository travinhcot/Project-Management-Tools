import type { Metadata } from "next";
import { AuditLogPage } from "@/features/audit-log/pages/AuditLogPage";
import {
  getAuditEvents,
  getAuditFilterOptions,
} from "@/features/audit-log/service/audit-log.service";
import type { AuditFilters } from "@/features/audit-log/models/audit-event";

export const metadata: Metadata = { title: "Audit log" };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const NAME = /^[A-Z][A-Z0-9_]{0,63}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseFilters(params: SearchParams): AuditFilters {
  const action = first(params.action) ?? "";
  const entityType = first(params.entity_type) ?? "";
  const from = first(params.from) ?? "";
  const to = first(params.to) ?? "";
  const page = Number(first(params.page));
  return {
    action: NAME.test(action) ? action : "",
    entityType: NAME.test(entityType) ? entityType : "",
    from: DAY.test(from) ? from : "",
    to: DAY.test(to) ? to : "",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const [list, options] = await Promise.all([getAuditEvents(filters), getAuditFilterOptions()]);
  return <AuditLogPage list={list} filters={filters} options={options} />;
}
