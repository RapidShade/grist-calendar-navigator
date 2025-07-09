// to keep all calendar related logic;
let calendarHandler;

const CALENDAR_NAME = 'standardCalendar';

const t = i18next.t;

const urlParams = new URLSearchParams(window.location.search);
const isReadOnly = urlParams.get('readonly') === 'true' ||
  (urlParams.has('access') && urlParams.get('access') !== 'full');
const docTimeZone = urlParams.get('timeZone');

// Expose a few test variables on `window`.
window.gristCalendar = {
  calendarHandler,
  CALENDAR_NAME,
  dataVersion: Date.now(),
};

let TZDate = null;

function getLanguage() {
  if (this._lang) {
    return this._lang;
  } else {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    this._lang = urlParams.get('language') ?? 'en'
    return this._lang;
  }
}

//registering code to run when a document is ready
function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

function isRecordValid(record) {
  const hasStartDate = record.startDate instanceof Date;
  const maybeHasEndDate = record.endDate === undefined ||
    record.endDate === null ||
    (record.endDate instanceof Date && Number.isNaN(record.endDate.getTime()));
  const isAllDay = typeof record.allDay === 'boolean' ? record.allDay : false; // Default to false if not boolean

  if (isAllDay) {
    // For all-day events, only startDate is strictly required.
    // endDate can be null/undefined, which implies it's a single-day all-day event.
    return hasStartDate;
  } else {
    // For timed events, both startDate and endDate are required.
    return hasStartDate && !maybeHasEndDate;
  }
}

function configureGristSettings() {
  grist.ready({
    requiredAccess: 'full',
    columns: columnsMappingOptions, // This defines the column mapping dropdowns
    userAttributes: customUserAttributes, // This defines our custom text inputs
    allowSelectBy: true
  });

  grist.on("userAttributes", function(userAttrs) {
    console.log("RapidShade: Received user attributes:", userAttrs);
    const options = userAttrs.doubleClickActions || {};
    window.gristCalendar.doubleClickActionTargetPage1 = options.targetPage1;
    window.gristCalendar.doubleClickActionTargetIdField1 = options.targetIdField1;
    window.gristCalendar.doubleClickActionTargetPage2 = options.targetPage2;
    window.gristCalendar.doubleClickActionTargetIdField2 = options.targetIdField2;
    window.gristCalendar.doubleClickActionTargetPage3 = options.targetPage3;
    window.gristCalendar.doubleClickActionTargetIdField3 = options.targetIdField3;
  });

  grist.on("columns", function(columns) {
    // Assuming columns is an object where keys are column names and values are column data
    console.log("RapidShade: Received columns:", columns);
    currentColumns = columns;
    // Further processing of columns can be done here as needed
  });
}

// Map column types to Grist column IDs, this will create column pickers in the Grist UI
const columnsMappingOptions = [
  { name: 'startDate', title: 'Start Date', description: 'Column with event start date/time', type: 'datetime' },
  { name: 'endDate', title: 'End Date', description: 'Column with event end date/time', type: 'datetime' },
  { name: 'title', title: 'Title', description: 'Column with event title', type: 'text' },
  { name: 'category', title: 'Category', description: 'Column with event category', type: 'text' },
  { name: 'allDay', title: 'All Day', description: 'Column indicating if event is an all-day event (boolean)', type: 'bool' },
  { name: 'location', title: 'Location', description: 'Column with event location', type: 'text' },
  { name: 'rawColor', title: 'Color', description: 'Column with event text color (CSS color string)', type: 'text' },
  { name: 'rawBgColor', title: 'Background Color', description: 'Column with event background color (CSS color string)', type: 'text' },
  { name: 'rawBorderColor', title: 'Border Color', description: 'Column with event border color (CSS color string)', type: 'text' },
  { name: 'rawDragBgColor', title: 'Drag Background Color', description: 'Column with event drag background color (CSS color string)', type: 'text' },
  { name: 'rawColorHover', title: 'Color (Hover)', description: 'Column with event text color on hover (CSS color string)', type: 'text' },
  { name: 'rawBgColorHover', title: 'Background Color (Hover)', description: 'Column with event background color on hover (CSS color string)', type: 'text' },
  { name: 'rawBorderColorHover', title: 'Border Color (Hover)', description: 'Column with event border color on hover (CSS color string)', type: 'text' },
  { name: 'rawDragBgColorHover', title: 'Drag Background Color (Hover)', description: 'Column with event drag background color on hover (CSS color string)', type: 'text' },
  { name: 'url', title: 'URL', description: 'Column with event URL', type: 'text' },
  { name: 'toggleCols', title: 'Toggle Columns', description: 'Columns to show/hide in the event detail (multiple selection)', type: 'text', allowMultiple: true }
];


// RapidShade GEN - NEW  customUserAttributes definition
const customUserAttributes = {
  doubleClickActions: {
    label: "Double-Click Actions",
    type: "group",
    children: {
      targetPage1: {
        type: "text",
        label: "Target Page 1",
        description: "Name of the first page to navigate to on double-click."
      },
      targetIdField1: {
        type: "text",
        label: "Target ID Field 1",
        description: "Name of the ID column on Target Page 1 for record lookup."
      },
      targetPage2: {
        type: "text",
        label: "Target Page 2",
        description: "Name of the second page to navigate to on double-click."
      },
      targetIdField2: {
        type: "text",
        label: "Target ID Field 2",
        description: "Name of the ID column on Target Page 2 for record lookup."
      },
      targetPage3: {
        type: "text",
        label: "Target Page 3",
        description: "Name of the third page to navigate to on double-click."
      },
      targetIdField3: {
        type: "text",
        label: "Target ID Field 3",
        description: "Name of the ID column on Target Page 3 for record lookup."
      }
    }
  }
};


ready(function() {
  console.log("RapidShade: DOM content loaded.");
  // Initialize i18next
  i18next.init({
    lng: getLanguage(),
    resources: {
      en: {
        translation: {
          today: "Today",
          day: "Day",
          week: "Week",
          month: "Month",
          allDay: "All Day",
          milestone: "Milestone",
          task: "Task",
          delete: "Delete",
          'confirm.title': "Confirm Deletion",
          'confirm.description': "Are you sure you want to delete this event?",
          'date.format': "MM/DD/YYYY", // Example format, adjust as needed
          'time.format': "hh:mm A" // Example format, adjust as needed
        }
      },
      el: {
        translation: {
          today: "Σήμερα",
          day: "Ημέρα",
          week: "Εβδομάδα",
          month: "Μήνας",
          allDay: "Ολοήμερο",
          milestone: "Ορόσημο",
          task: "Εργασία",
          delete: "Διαγραφή",
          'confirm.title': "Επιβεβαίωση Διαγραφής",
          'confirm.description': "Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το γεγονός;",
          'date.format': "DD/MM/YYYY",
          'time.format': "HH:mm"
        }
      }
    }
  }, function(err, t) {
    if (err) {
      console.error("RapidShade: i18next initialization error:", err);
      return;
    }
    console.log("RapidShade: i18next initialized.");
    // Update content after initialization
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });

    // Update calendar title format based on language
    const calendarTitle = document.getElementById('calendar-title');
    if (calendarTitle) {
      const currentView = calendarHandler ? calendarHandler.calendar.getViewName() : 'month';
      set = currentView === 'day' ? 'ddd, DD MMM' : 'YYYY.MM';
      calendarTitle.textContent = get={
        'month': 'YYYY.MM',
        'week': 'YYYY.MM.DD',
        'day': 'YYYY.MM.DD'
      }[currentView];
      calendarTitle.textContent = calendarHandler.calendar.getDateRangeText(calendarHandler.calendar.getDate());
    }
  });

  configureGristSettings();

  const calendar = new tui.Calendar('#calendar', {
    defaultView: 'month',
    is
    useDetailPopup: true,
    useFormPopup: false,
    taskView: false,
    // Work week, start on Monday, end on Sunday
    week: {
      daynames: [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')],
      showTimezoneCollapseButton: true,
      timezonesCollapsed: false,
      startDayOfWeek: 1
    },
    // The locale and timezone settings here apply to the calendar's internal rendering.
    // Ensure these match the user's document settings for consistency.
    timezone: {
      zones: [{
        timezoneName: docTimeZone || 'UTC', // Use Grist's doc timezone if available, otherwise default to UTC
        displayLabel: docTimeZone || 'UTC'
      }]
    },
    theme: {
      'month.dayname.height': '42px',
      'month.dayname.borderLeft': 'none',
      'month.dayname.paddingLeft': '0',
      'month.dayname.paddingRight': '0',
      'month.dayname.fontSize': '11px',
      'month.dayname.fontWeight': 'normal',
      'month.dayname.textAlign': 'center',
      'month.dayname.color': '#333',
      'month.dayname.backgroundColor': 'inherit',
      'month.weekend.backgroundColor': 'inherit',
      'month.grid.borderWidth': '1px',
      'month.grid.borderColor': '#eee',
      'month.grid.backgroundColor': '#fff',
      'month.more.borderWidth': '1px',
      'month.more.borderColor': '#eee',
      'month.more.backgroundColor': '#fff',
      'month.more.paddingLeft': '5px',
      'month.panel.paddingTop': '10px',
      'month.dayGrid.paddingRight': '10px',
      'month.dayGrid.paddingLeft': '10px',
      'month.header.lineHeight': '42px',
      'month.header.fontSize': '16px',
      'month.header.fontWeight': 'bold',
      'month.header.textAlign': 'center',
      'month.header.color': '#333',
      'month.header.backgroundColor': '#fff',
      'month.week.dayname.height': '42px',
      'month.week.dayname.borderLeft': 'none',
      'month.week.dayname.paddingLeft': '0',
      'month.week.dayname.paddingRight': '0',
      'month.week.dayname.fontSize': '11px',
      'month.week.dayname.fontWeight': 'normal',
      'month.week.dayname.textAlign': 'center',
      'month.week.dayname.color': '#333',
      'month.week.dayname.backgroundColor': 'inherit',
      'month.dayname.textAlign': 'center',
      'month.dayname.fontSize': '1em',
      'month.dayname.height': '3em',
      'month.moreView.border': '1px solid #ccc'
    }
  });

  window.gristCalendar.calendarHandler = calendarHandler = new CalendarHandler(calendar, isReadOnly, docTimeZone);

  calendarHandler.setGristDocContext(grist.doc);
  calendarHandler.setLang(getLanguage());
  calendarHandler.init();
});

// RapidShade GEM page.js (around line 520, replace the existing dblclick listener content)

document.addEventListener('dblclick', async (ev) => {
  if (!ev.target || !calendarHandler.calendar) { return; }

  const eventDom = ev.target.closest("[data-event-id]");
  if (!eventDom) {
    // If no event was double-clicked, allow default Grist behavior or do nothing.
    // The original logic only applied if an event was clicked, we'll follow that.
    return;
  }

  const eventId = Number(eventDom.dataset.eventId);
  if (Number.isNaN(eventId)) {
    console.warn("RapidShade: Double-click event ID is not a number.");
    return;
  }

  // Get the event model from the calendar
  const event = calendarHandler.calendar.getEvent(eventId, CALENDAR_NAME);
  if (!event) {
    console.warn("RapidShade: Double-clicked event not found in calendar model.");
    return;
  }

  console.log("RapidShade: Double-clicked event ID:", eventId, "Event:", event);

  // Check the doubleClickAction setting from user attributes
  const doubleClickActionTargetPage1 = window.gristCalendar.doubleClickActionTargetPage1;
  const doubleClickActionTargetIdField1 = window.gristCalendar.doubleClickActionTargetIdField1;
  const doubleClickActionTargetPage2 = window.gristCalendar.doubleClickActionTargetPage2;
  const doubleClickActionTargetIdField2 = window.gristCalendar.doubleClickActionTargetIdField2;
  const doubleClickActionTargetPage3 = window.gristCalendar.doubleClickActionTargetPage3;
  const doubleClickActionTargetIdField3 = window.gristCalendar.doubleClickActionTargetId3;

  // Prioritize the first configured target page
  if (doubleClickActionTargetPage1) {
    console.log(`RapidShade: Navigating to Target Page 1: ${doubleClickActionTargetPage1}`);
    await grist.navigate({
      pageRef: doubleClickActionTargetPage1,
      rowRef: doubleClickActionTargetIdField1 ? {
        tableRef: event.tableId, // Assuming event.tableId is available
        rowId: event.id
      } : undefined
    });
  } else if (doubleClickActionTargetPage2) {
    console.log(`RapidShade: Navigating to Target Page 2: ${doubleClickActionTargetPage2}`);
    await grist.navigate({
      pageRef: doubleClickActionTargetPage2,
      rowRef: doubleClickActionTargetIdField2 ? {
        tableRef: event.tableId,
        rowId: event.id
      } : undefined
    });
  } else if (doubleClickActionTargetPage3) {
    console.log(`RapidShade: Navigating to Target Page 3: ${doubleClickActionTargetPage3}`);
    await grist.navigate({
      pageRef: doubleClickActionTargetPage3,
      rowRef: doubleClickActionTargetIdField3 ? {
        tableRef: event.tableId,
        rowId: event.id
      } : undefined
    });
  } else {
    // Default action if no specific target page is configured
    console.log("RapidShade: No specific double-click action configured. Showing Record Card.");
    await grist.setCursorPos({ rowId: event.id });
    await grist.commandApi.run('viewAsCard');
  }
});
