// The public vocabulary of growth needs, from the merged base design (Carbon's 11). Resources are tagged with these; no person is.
export const NEEDS: Record<string, { label: string; means: string }> = {
  find_my_people: { label: "find my people", means: "belonging and peers around shared interests" },
  build_a_skill: { label: "build a skill", means: "a concrete method learned through guided practice" },
  explore_a_field: { label: "explore a field", means: "sample a discipline's big questions without committing" },
  get_experience: { label: "get experience", means: "test abilities in real settings: projects, competitions, roles" },
  make_and_express: { label: "make and express", means: "compose, perform, craft, or engage with original work" },
  get_mentorship_and_feedback: { label: "get feedback", means: "advice or critique from advisors, librarians, peers" },
  decide_a_direction: { label: "decide a direction", means: "clarify a major or path by comparing options" },
  fund_my_path: { label: "fund my path", means: "prizes, grants, stipends, paid campus work" },
  contribute_beyond_self: { label: "contribute", means: "civic dialogue, public scholarship, neighbourhood work" },
  navigate_systems: { label: "navigate systems", means: "libraries, catalogs, policies, academic workflows" },
  rest_and_recover: { label: "rest and recover", means: "step away from pressure: mindfulness, snacks, play, music" },
};
export const needList = () => Object.entries(NEEDS).map(([id, n]) => `${id}: ${n.means}`).join("\n");
