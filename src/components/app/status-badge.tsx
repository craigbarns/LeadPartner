import { Badge } from "@/components/ui/badge";
import {
  commissionStatusColor,
  commissionStatusLabel,
  statusColor,
  statusLabel,
} from "@/lib/constants";
import type { CommissionStatus, OpportunityStatus } from "@/types/database";

export function OpportunityStatusBadge({ status }: { status: OpportunityStatus }) {
  return <Badge variant={statusColor(status)}>{statusLabel(status)}</Badge>;
}

export function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  return <Badge variant={commissionStatusColor(status)}>{commissionStatusLabel(status)}</Badge>;
}
