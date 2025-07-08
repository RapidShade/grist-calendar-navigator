
let calendar;
let options = {};
let gristDoc;

function updateCalendar(records, mappings) {
  const fields = mappings?.columns || {};
  const titleCol = fields.title;
  const startCol = fields.startDate;
  const endCol = fields.endDate;
  const colorCol = fields.type;

  if (!startCol || !titleCol) {
    document.getElementById("calendar").innerHTML = "<p style='padding:1em;'>Missing required column settings (start date or title).</p>";
    return;
  }

  const events = records.map(r => ({
    title: r.fields[titleCol] || "(untitled)",
    start: r.fields[startCol],
    end: r.fields[endCol],
    color: colorCol ? r.fields[colorCol] : undefined,
    _gristRecord: r.id
  }));

  calendar.removeAllEvents();
  calendar.addEventSource(events);
}

function initCalendar() {
  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    eventClick: function(info) {
      const recordId = info.event.extendedProps._gristRecord;
      if (!recordId) return;

      let targetPage = options.targetPages?.[0];
      if (options.targetPages?.length > 1) {
        const selected = prompt("Select target page:\n" + options.targetPages.join("\n"), targetPage);
        if (!selected || !options.targetPages.includes(selected)) return;
        targetPage = selected;
      }

      if (targetPage && gristDoc.setActivePage) {
        gristDoc.setActivePage(targetPage);
      }

      if (gristDoc.docApi && gristDoc.docApi.setCursorPos) {
        gristDoc.docApi.setCursorPos(0, recordId - 1);
      }
    }
  });
  calendar.render();
}

window.addEventListener("load", function () {
  grist.ready({ requiredAccess: "full" });

  grist.onOptions(function(opts) {
    options = opts || {};
  });

  grist.onColumns(function(mappings) {
    initCalendar();
    grist.onRecords(function(records) {
      updateCalendar(records, mappings);
    });
  });

  gristDoc = grist;
});
