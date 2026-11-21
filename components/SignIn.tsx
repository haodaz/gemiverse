"use client";
import { useState } from "react";

// Sign up / log in, with a switch between student and admin. There are no accounts yet: a student's Gemi lives in this browser,
// and the back office is open during the hackathon. The dialog says so, and takes each role to its own side.
const INK = "#2b2536", PUR = "#7c4dce";
export function SignIn() {
  const [open, setOpen] = useState(false), [role, setRole] = useState<"student" | "admin">("student");
  const go = () => { let has = false; try { has = !!localStorage.getItem("gemi.school"); } catch {} location.href = role === "admin" ? "/admin" : has ? "/room" : "/start"; };
  return (<>
    <button onClick={() => setOpen(true)} className="rounded-full border-2 px-5 py-2 text-[15px] font-semibold" style={{ borderColor: INK, color: INK }}>Sign up / Log in</button>
    {open && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#2b2536]/40" onClick={() => setOpen(false)}>
        <div className="w-[26rem] rounded-3xl border-2 bg-white p-7 text-[#2b2536]" style={{ borderColor: INK, boxShadow: "0 8px 0 #2b253633" }} onClick={(e) => e.stopPropagation()}>
          <h2 className="text-2xl font-semibold">Welcome to Gemiverse</h2>
          <div className="mt-4 grid grid-cols-2 rounded-full border-2 p-1" style={{ borderColor: INK }} role="tablist">
            {(["student", "admin"] as const).map((r) => <button key={r} role="tab" aria-selected={role === r} onClick={() => setRole(r)} className="rounded-full py-2 text-[15px] font-semibold" style={{ background: role === r ? INK : "transparent", color: role === r ? "#fff" : INK }}>{r === "student" ? "Student" : "Admin"}</button>)}
          </div>
          <p className="mt-4 min-h-[4.5rem] text-[15px] leading-relaxed text-[#5f576c]">{role === "student"
            ? "Your Gemi and everything it learns about you live in this browser. Accounts that follow you across devices open later."
            : "The back office: the shared base and its flywheel, what each Gemini model did, the measured results, and days run at speed. Open to everyone during the hackathon."}</p>
          <button onClick={go} className="mt-3 w-full rounded-full py-3 text-lg font-semibold text-white" style={{ background: PUR }}>{role === "student" ? "Continue as a student" : "Open the back office"}</button>
          <button onClick={() => setOpen(false)} className="mt-2 w-full py-1 text-sm text-[#8a8296]">Not now</button>
        </div>
      </div>)}
  </>);
}
