// Makes sure every signed-in user has a workout program and a weekly menu.
// An on-device version is shown instantly; the AI version replaces it when (and if) it arrives.
import { generateMenu, generateProgram } from "./api";
import { localProgram } from "./data/localCoach";
import { localMenu } from "./data/recipes";
import { getState, setState, sharedSchedule, type UserData } from "./store";

const inFlight = new Set<string>();

function patch(email: string, fn: (d: UserData) => UserData) {
  setState((s) => (s.data[email] ? { ...s, data: { ...s.data, [email]: fn(s.data[email]) } } : s));
}

export function ensurePlans(email: string) {
  const d = getState().data[email];
  if (!d) return;

  if (!d.menu && !inFlight.has(`menu:${email}`)) {
    inFlight.add(`menu:${email}`);
    const schedule = sharedSchedule(d);
    const stamp = new Date().toISOString();
    patch(email, (x) => ({ ...x, menu: localMenu(x.profile, schedule), menuAi: false, menuAt: stamp, shopChecked: {} }));
    generateMenu(d.profile, schedule)
      .then(({ data, ai }) => {
        // replace only the automatic offline menu the user has not regenerated since
        if (ai) patch(email, (x) => (x.menuAt === stamp && !x.menuAi ? { ...x, menu: data, menuAi: true, menuAt: new Date().toISOString(), shopChecked: {} } : x));
      })
      .finally(() => inFlight.delete(`menu:${email}`));
  }

  if (!d.program && !inFlight.has(`program:${email}`)) {
    inFlight.add(`program:${email}`);
    patch(email, (x) => ({ ...x, program: localProgram(x.profile), programAuto: true }));
    generateProgram(d.profile)
      .then(({ data, ai }) => {
        if (ai) patch(email, (x) => (x.programAuto && x.workouts.length === 0 ? { ...x, program: data, programAuto: false } : x));
      })
      .finally(() => inFlight.delete(`program:${email}`));
  }
}
