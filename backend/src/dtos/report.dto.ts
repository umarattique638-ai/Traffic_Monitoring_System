import type { ReportDocument } from '../models/report.model.js';

/** A saved report, without its CSV. */
export function toReportDTO(r: ReportDocument) {
  return {
    id: r._id.toString(),
    range: r.range,
    from: r.from,
    to: r.to,
    timezone: r.timezone,
    filename: r.filename,
    rows: r.rows,
    bytes: r.bytes,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
  };
}
