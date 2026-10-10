// Pages seen in this visit to the game (counted by AppBoot as the address changes), so a page can
// tell whether there's one of the game's own to go back to - unlike document.referrer, which only
// knows where the visit began
let pagesSeen = 0;

export const notePageSeen = () => {
  pagesSeen++;
};

// (AppBoot counts the page before the page's own effects run: it comes first in the layout)
export const cameFromAnotherPage = () => pagesSeen > 1;
