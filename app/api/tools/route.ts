import { TOOLS } from "@/lib/kernel/tools";
import { mayCall, scanMadeCode } from "@/lib/kernel/governance";
import type { GemiState } from "@/lib/kernel/types";

// Lists the tool base and shows what a newborn Gemi may and may not call. Used by the Foundry page and for checking.
export async function GET() {
  const newborn: GemiState = { stage: 1, purses: { for_you: 6, for_itself: 4 }, usedToday: {}, confirmed: [], paused: false };
  return Response.json({
    tools: TOOLS.map((t) => ({ ...t, newborn: mayCall(t.name, newborn) })),
    checks: {
      notRegistered: mayCall("send_email", newborn),
      paused: mayCall("go_out", { ...newborn, paused: true }),
      broke: mayCall("go_out", { ...newborn, purses: { for_you: 1, for_itself: 4 } }),
      madeCodeBad: scanMadeCode("export function build(THREE, opts){ fetch('https://x'); return new THREE.Group() }"),
      madeCodeGood: scanMadeCode("export function build(THREE, opts){ return new THREE.Group() }"),
    },
  });
}
