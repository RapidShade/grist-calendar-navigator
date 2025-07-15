import { GristDocAPI } from "https://docs.getgrist.com/grist-plugin-api.js";

window.addEventListener("load", async () => {
  console.log("RapidShade: Navigator Listener JS v0.7");

  const hash = window.location.hash;
  console.log("RapidShade: Current hash is", hash);

  const match = hash.match(/^#grist-navigate:([^:]+):(\d+)$/);
  if (!match) {
    console.log("RapidShade: No matching navigation hash");
    return;
  }

  const [_, table, rowIdStr] = match;
  const rowId = parseInt(rowIdStr, 10);

  if (isNaN(rowId)) {
    console.error("RapidShade: Invalid row ID in hash:", rowIdStr);
    return;
  }

  const gristDoc = await GristDocAPI.getDocAPI();
  console.log("RapidShade: Grist API injected");

  const sections = await gristDoc.getVisibleViewSections();
  console.log("RapidShade: Found view sections:", sections);

  for (const section of sections) {
    const sectionDetails = await gristDoc.getViewSection(section);
    if (sectionDetails.table === table) {
      console.log("RapidShade: Matching section found", sectionDetails);
      await gristDoc.setCursorPos(section, rowId, 0);
      console.log(`RapidShade: Cursor set to row ${rowId} in section ${section}`);
      break;
    }
  }
});
