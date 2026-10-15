import { InfoHint } from "@/components/ui";
import { ARTI_THRESHOLD } from "@/lib/format";

/** Label header risk threshold (Limit/Appetite/Tolerance) beserta ikon info penjelasannya. */
export function ThresholdHint({ jenis }: { jenis: keyof typeof ARTI_THRESHOLD }) {
  const a = ARTI_THRESHOLD[jenis];
  return (
    <span className="inline-flex items-center gap-1.5">
      {jenis}
      <InfoHint title={jenis}>
        <p>{a.isi}</p>
        <p className="mt-1.5 text-slate-500">{a.aksi}</p>
      </InfoHint>
    </span>
  );
}
