// Sign-in links from the cloud save's emails (lib/cloudSave) are only taken on the browser that asked
// for one in the last day: anyone could otherwise send a link that signs a player's device into an
// account of their choosing. Opened anywhere else, the link is ignored and the player types the code
// from the email instead.

const ASKED_KEY = 'wwhEmailLinkAsked';
const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

export const noteEmailLinkAsked = () => {
  try {
    localStorage.setItem(ASKED_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the code from the email still works
  }
};

export const emailLinkExpected = (): boolean => {
  try {
    const asked = Number(localStorage.getItem(ASKED_KEY));
    return asked > 0 && Date.now() - asked < LINK_LIFETIME_MS;
  } catch {
    return false;
  }
};

export const forgetEmailLink = () => {
  try {
    localStorage.removeItem(ASKED_KEY);
  } catch {
    // Nothing to forget
  }
};
