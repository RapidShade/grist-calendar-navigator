let calendar;
let gristDoc;
let options = {};
let events = [];

function renderCalendar() {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: options.initialView || 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events: events,
    eventClick: function(info) {
      const recordId = info.event.extendedProps._gristRecord;
      if (!recordId) return;

      let targetPage = options.targetPages?.[0];
      if (options.targetPages?.length > 1) {
        const selected = prompt("Select a page:\n" + options.targetPages.join("\n"), targetPage);
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

function update(records, mappings) {
  const title = options.title || "Name";
  const start = options.startDate || "DateStart";
  const end = options.endDate || "DateEnd";
  const type = options.type || null;

  events = records.map(r => ({
    title: r.fields[title] || "(untitled)",
    start: r.fields[start],
    end: r.fields[end],
    color: type ? r.fields[type] : undefined,
    _gristRecord: r.id
  }));

  if (calendar) {
    calendar.removeAllEvents();
    calendar.addEventSource(events);
  } else {
    renderCalendar();
  }
}

window.addEventListener("load", function () {
  grist.ready({ requiredAccess: 'full' });
  grist.onOptions(function (opts) {
    options = opts || {};
  });
  grist.onRecords(update);
  gristDoc = grist;
});
