import type { FileSlot, LinkSlot, ResourceSlot } from "../model/resource.model.ts";

import { invalid, uuidParam } from "../../../shared/query-params.ts";
import { FILE_SLOTS, LINK_SLOTS, RESOURCE_SLOTS } from "../model/resource.model.ts";

export const projectIdParam = (value: unknown) =>
  uuidParam(value, "project id");
export const fileIdParam = (value: unknown) => uuidParam(value, "file id");

export function slotParam(value: unknown): ResourceSlot {
  if (
    typeof value !== "string" ||
    !RESOURCE_SLOTS.includes(value as ResourceSlot)
  )
    invalid(`slot must be one of ${RESOURCE_SLOTS.join(", ")}.`);
  return value as ResourceSlot;
}

export function fileSlotParam(value: unknown): FileSlot {
  const slot = slotParam(value);
  if (!FILE_SLOTS.includes(slot as FileSlot))
    invalid(`Slot ${slot} does not accept files.`);
  return slot as FileSlot;
}

export function linkSlotParam(value: unknown): LinkSlot {
  const slot = slotParam(value);
  if (!LINK_SLOTS.includes(slot as LinkSlot))
    invalid(`Slot ${slot} does not accept links.`);
  return slot as LinkSlot;
}
