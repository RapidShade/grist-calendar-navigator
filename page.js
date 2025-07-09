// to keep all calendar related logic;
console.log("RapidShade: page.js version - " + new Date().toLocaleTimeString()); // KEEP THIS LINE AT THE VERY TOP

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
  // Initialize these here to ensure they always exist, even if undefined initially
  doubleClickActionTargetPage1: undefined,
  doubleClickActionTargetIdField1: undefined,
  doubleClickActionTargetPage2: undefined,
  doubleClickActionTargetIdField2: undefined,
  doubleClickActionTargetPage3: undefined,
  doubleClickActionTargetIdField3: undefined,
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
    record.endDate instanceof Date ;
    const hasTitle = typeof record.title === 'string';
  const maybeHasIsAllDay = record.isAllDay === undefined || typeof record.isAllDay === 'boolean';
  return hasStartDate && maybeHasEndDate && hasTitle && maybeHasIsAllDay;
}

function getMonthName() {
  return calendarHandler.calendar.getDate().toDate().toLocaleString(getLanguage(), {month: 'long', year: 'numeric'})
}

class CalendarHandler {
  //TODO: switch to new variables once they are published.
  _mainColor =  'var(--grist-theme-input-readonly-border)';
    _calendarBackgroundColor =  'var(--grist-theme-page-panels-main-panel-bg)';
  _selectedColor = 'var(--grist-theme-top-bar-button-primary-fg)';
  _borderStyle =  '1px solid var(--grist-theme-table-body-border)';
  _accentColor =  'var(--grist-theme-accent-text)';
  _textColor =  'var(--grist-theme-text)';
  _selectionColor =  'var(--grist-theme-selection)';
  _calendarTheme = () => {return {
    common: {
      backgroundColor: this._calendarBackgroundColor,
      border: this._borderStyle,
      holiday: {color: this._textColor},
      gridSelection: {
        backgroundColor: this._selectionColor,
        border: `1px solid ${this._selectionColor}`
      },
      dayName: {
        color: this._textColor,
      },
      today: {
        color: this._textColor,
      },
      saturday:{
        color: this._textColor,
      }
    },
    week:{
      timeGrid:{
        borderRight: this._borderStyle,
      },
      timeGridLeft:{
        borderRight: this._borderStyle,
      },
      panelResizer:{
        border: this._borderStyle,
      },
      dayName:{
        borderBottom: this._borderStyle,
        borderTop: this._borderStyle,
      },
      dayGrid:{
        borderRight: this._borderStyle,
      },
      dayGridLeft:{
        borderRight: this._borderStyle,
      },
      timeGridHourLine:{
        borderBottom: this._borderStyle
      },
      gridSelection: this._accentColor,

      pastTime:{
        color: this._textColor,
      },
      futureTime:{
        color: this._textColor,
    },
      nowIndicatorLabel: {
        color: 'var(--grist-theme-accent-text)',
      },
      nowIndicatorPast: {
        border: '1px dashed var(--grist-theme-accent-border)',
      },
      nowIndicatorBullet: {
        backgroundColor: 'var(--grist-theme-accent-text)',
      },
      nowIndicatorToday: {
        border: '1px solid var(--grist-theme-accent-border)',
      },
      today: {
        color: this._textColor,
        backgroundColor: 'inherit',
      },
    },
    month: {
      dayName:{
        borderLeft: this._borderStyle,
        backgroundColor: 'inherit',
      },
      dayExceptThisMonth: {
        color: this._textColor,
      },
      holidayExceptThisMonth: {
        color: this._textColor,
      },
    }}
  }

  _getCalendarOptions() {
    return {
      week: {
        taskView: false,
        dayNames: [t('Sun'), t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat')],
      },
      month: {
        dayNames: [t('Sun'), t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat')],
      },
      usageStatistics: false,
      theme: this._calendarTheme(),
      defaultView: 'week',
      isReadOnly,
      template: {
        time(event) {
          const {title} = event;
          const sanitizedTitle = title.replace('"','&quot;').trim();
          return `<span title="${sanitizedTitle}">${title}</span>`;
        },
        allday(event) {
          const {title} = event;
          const sanitizedTitle = title.replace('"','&quot;').trim();
          return `<span title="${sanitizedTitle}">${title}</span>`;
        },
        popupDelete(){
          return t('Delete')
        },
        poupSave(){
          return t('Save')
        },
        popupEdit(){
          return t('Edit')
        },
        popupUpdate(){
          return t('Update')
        },
        allDayTitle() {
          return t('All Day')
        },
        popupIsAllday() {
          return t('All Day')
        }

      },
      calendars: [
        {
          id: CALENDAR_NAME,
          name: 'Personal',
          backgroundColor: this._mainColor,
          color: this._textColor,
          borderColor: this._mainColor,
        },
      ],
      useFormPopup: !isReadOnly,
      useDetailPopup: false, // We use our own logic to show this popup.
      gridSelection: {
        // Enable adding only via dbClick.
        enableDblClick: true,
        enableClick: false,
      },
    };
  }

  constructor() {
    const container = document.getElementById('calendar');
    if (isReadOnly) {
      container.classList.add('readonly')
    }
    const options = this._getCalendarOptions();
    this.calendar = new tui.Calendar(container, options);

    // Not sure how to get a reference to this constructor, so doing it in a roundabout way.
    TZDate = this.calendar.getDate().constructor;

    this.calendar.on('clickEvent', async (info) => {
      focusWidget();
      await grist.setCursorPos({rowId: info.event.id});
    });

    this.calendar.on('selectDateTime', async (info) => {
      this.calendar.clearGridSelections();

      // If this click results in the form popup, focus the title field in it.
      setTimeout(() => container.querySelector('input[name=title]')?.focus(), 0);
    });

    // Creation happens via the event-edit form.
    this.calendar.on('beforeCreateEvent', (eventInfo) => upsertEvent(eventInfo));

    // Updates happen via the form or when dragging the event or its end-time.
    this.calendar.on('beforeUpdateEvent', (update) => upsertEvent({id: update.event.id, ...update.changes}));

    // Deletion happens via the event-edit form.
    this.calendar.on('beforeDeleteEvent', (eventInfo) => deleteEvent(eventInfo));

    container.addEventListener('mousedown', () => {
      focusWidget();
      // Clear existing selection; this follows the suggested workaround in
      // https://github.com/nhn/tui.calendar/issues/1300#issuecomment-1273902472
      this.calendar.clearGridSelections();
    });

    container.addEventListener('mouseup', () => {
      // Fix dragging after a tap, when 'mouseup' follows the 'mousedown' so quickly that ToastUI
      // misses adding a handler, and doesn't stop the drag. If ToastUI handles it, it will stop
      // the drag or switch to a popup open. If on the next tick, the drag is still on, cancel it.
      setTimeout(() => {
        if (this.calendar.getStoreState('dnd').draggingState !== 0) {
          this.calendar.getStoreDispatchers('dnd').cancelDrag();
        }
      }, 0);
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        this.calendar.getStoreDispatchers('popup').hideFormPopup();
        this.calendar.getStoreDispatchers('popup').hideDetailPopup();
      } else if (ev.key === 'Enter') {
        // On a view popup, click "Edit"; on the edit popup, click "Save". Just try both to keep
        // it simple, since only one button will be present in practice.
        container.querySelector('button.toastui-calendar-edit-button')?.click();
        container.querySelector('button.toastui-calendar-popup-confirm')?.click();
      }
    });

    // All events, indexed by id.
    this._allEvents = new Map();

    // Ids of visible events that fall within the current date range. */
    this._visibleEventIds = new Set();
  }

  _isMultidayInMonthViewEvent(rec)  {
    const startDate = rec.start.toDate();
    const endDate = rec.end.toDate();
    const isItMonthView = this.calendar.getViewName() === 'month';
    const isEventMultiDay = startDate.getDate() !== endDate.getDate() ||
      startDate.getMonth() !== endDate.getMonth() ||
      startDate.getFullYear() !== endDate.getFullYear();
    return isItMonthView &&  !isEventMultiDay
  }

  async selectRecord(record) {
    if (!isRecordValid(record) || this._selectedRecordId === record.id) {
      return;
    }

    if (this._selectedRecordId) {
      this._clearHighlightEvent(this._selectedRecordId);
    }
    const [startType] = await colTypesFetcher.getColTypes();
    const startDate = getAdjustedDate(record.startDate, startType);
    this.calendar.setDate(startDate);
    this._selectedRecordId = record.id;
    updateUIAfterNavigation();

    // If the view has a vertical timeline, scroll to the start of the event.
    if (!record.isAllday && this.calendar.getViewName() !== 'month') {
      setTimeout(() => {
        const event = this.calendar.getElement(record.id, CALENDAR_NAME);
        if (!event) { return; }

        // Only scroll into view if the event is not fully on-screen.
        const container = event.closest('.toastui-calendar-time');
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;
        const eventTop = event.offsetTop;
        const eventBottom = eventTop + event.clientHeight;
        const isOnscreen = eventTop >= containerTop && eventBottom <= containerBottom;
        if (!isOnscreen) {
          event.scrollIntoView({behavior: 'smooth'});
        }
      }, 0);
    }
  }

  _highlightEvent(eventId) {
    const event = this.calendar.getEvent(eventId, CALENDAR_NAME);
    if (!event) { return; }
    // If this event is shown on month view as a dot.
    const shouldPaintBackground = this._isMultidayInMonthViewEvent(event);
    // We will highlight it by changing the background color. Otherwise we will change the border color.
    const partToColor = shouldPaintBackground ? 'backgroundColor' : 'borderColor';
    this.calendar.updateEvent(eventId, CALENDAR_NAME, {
      ...{
        borderColor: event.raw?.['backgroundColor'] ?? this._mainColor,
        backgroundColor: event.raw?.['backgroundColor'] ?? this._mainColor,
      },
      [partToColor]: this._selectedColor
    });
  }

  _clearHighlightEvent(eventId) {
    const event = this.calendar.getEvent(eventId, CALENDAR_NAME);
    if (!event) { return; }
    // We will highlight it by changing the background color. Otherwise we will change the border color.
    this.calendar.updateEvent(eventId, CALENDAR_NAME, {
      borderColor: event.raw?.['backgroundColor'] ?? this._mainColor,
      backgroundColor: event.raw?.['backgroundColor'] ?? this._mainColor,
    });
  }

  // change calendar perspective between week, month and day.
  changeView(calendarViewPerspective) {
    this.calendar.changeView(calendarViewPerspective);
    updateUIAfterNavigation();
  }

  // navigate to the previous time period
  calendarPrevious() {
    this.calendar.prev();
    updateUIAfterNavigation();
  }

  // navigate to the next time period
  calendarNext() {
    this.calendar.next();
    updateUIAfterNavigation();
  }

  //navigate to today
  calendarToday() {
    this.calendar.today();
    updateUIAfterNavigation();
  }

  refreshSelectedRecord(){
    if (this._selectedRecordId) {
      this._highlightEvent(this._selectedRecordId);
    }
  }

// page.js (inside CalendarHandler class, e.g., after refreshSelectedRecord, around line 269)

  async handleDoubleClickAction(recordId) {
    const targets = this._doubleClickTargets;

    if (!targets || targets.length === 0) {
      // No custom targets configured, fall back to default Grist behavior
      // (select row in source table and potentially show Record Card if Grist does that by default)
      console.log("RapidShade: No custom double-click targets configured. Falling back to default behavior.");
      await grist.setCursorPos({rowId: recordId});
      // The original dblclick listener already calls grist.commandApi.run('viewAsCard'),
      // so we just need to ensure the cursor is set.
      await grist.commandApi.run('viewAsCard'); // Explicitly call viewAsCard here for clarity
      return;
    }

    if (targets.length === 1) {
      // Only one target page, navigate directly
      const target = targets[0];
      await this._navigateToPageAndRecord(target.page, target.idField, recordId);
    } else {
      // Multiple target pages, show selection dialog
      await this._showPageSelectionDialog(recordId, targets);
    }
  }

  async _navigateToPageAndRecord(pageName, idFieldName, recordId) {
    try {
      // The grist.navigate API can take 'row' for rowId, but not directly a lookup for another field.
      // So we navigate to the page and then use setSelectedRows.
      // NOTE: This assumes the target page displays a table that contains the `idFieldName`
      // and that the `recordId` from the calendar *is* a value in that `idFieldName` column.
      // If your target table uses a *different* ID for the same logical record,
      // you would need more advanced logic involving fetching the target table and performing a lookup.
      await grist.navigate({ page: pageName });

      // After navigating, we need to find the specific row in the new table based on idFieldName.
      // For simplicity, we will assume `recordId` passed from the calendar *is* the Grist `rowId`
      // for the target table as well.
      await grist.setSelectedRows([recordId]);

      console.log(`RapidShade: Mapped to page "${pageName}" and attempted to select record with ID: ${recordId} using field: ${idFieldName}`);
    } catch (error) {
      console.error(`RapidShade: Failed to navigate to page "${pageName}" with record ID ${recordId}:`, error);
      alert(`Could not navigate to "${pageName}". Make sure the page exists and the ID field is correctly configured.`);
    }
  }

  async _showPageSelectionDialog(recordId, targets) {
    // Check if a modal is already open
    let modal = document.getElementById('grist-calendar-page-selection-modal');
    if (modal) {
        // If it exists, clear its content for a fresh display
        modal.innerHTML = '';
    } else {
        // Create the modal element if it doesn't exist
        modal = document.createElement('div');
        modal.id = 'grist-calendar-page-selection-modal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.backgroundColor = 'var(--grist-theme-page-panels-main-panel-bg)';
        modal.style.padding = '20px';
        modal.style.border = '1px solid var(--grist-theme-border)';
        modal.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        modal.style.zIndex = '9999'; // Ensure it's on top
        modal.style.borderRadius = '5px';
        modal.style.color = 'var(--grist-theme-text)';
        document.body.appendChild(modal);
    }

    // Modal content
    const header = document.createElement('h3');
    header.style.marginBottom = '15px';
    header.textContent = t('Select a page to view the record:');
    modal.appendChild(header);

    targets.forEach((target, index) => {
      const button = document.createElement('button');
      button.dataset.pageIndex = index;
      button.textContent = target.page;
      button.style.display = 'block'; // Make buttons stack vertically
      button.style.width = '100%';
      button.style.padding = '10px';
      button.style.marginBottom = '10px';
      button.style.backgroundColor = 'var(--grist-theme-top-bar-button-primary-bg)';
      button.style.color = 'var(--grist-theme-top-bar-button-primary-fg)';
      button.style.border = 'none';
      button.style.borderRadius = '3px';
      button.style.cursor = 'pointer';
      button.style.fontSize = '16px';
      button.style.fontWeight = 'bold';
      button.onmouseover = () => button.style.opacity = '0.9';
      button.onmouseout = () => button.style.opacity = '1';
      modal.appendChild(button);
    });

    const cancelButton = document.createElement('button');
    cancelButton.id = 'cancelSelection';
    cancelButton.textContent = t('Cancel');
    cancelButton.style.display = 'block';
    cancelButton.style.width = '100%';
    cancelButton.style.padding = '10px';
    cancelButton.style.marginTop = '15px';
    cancelButton.style.backgroundColor = 'var(--grist-theme-disabled-button-bg)';
    cancelButton.style.color = 'var(--grist-theme-disabled-button-fg)';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '3px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.onmouseover = () => cancelButton.style.opacity = '0.9';
    cancelButton.onmouseout = () => cancelButton.style.opacity = '1';
    modal.appendChild(cancelButton);

    return new Promise((resolve) => {
      const handleClick = async (event) => {
        const index = event.target.dataset.pageIndex;
        if (index !== undefined) {
          const target = targets[parseInt(index)];
          await this._navigateToPageAndRecord(target.page, target.idField, recordId);
          document.body.removeChild(modal);
          resolve();
        } else if (event.target.id === 'cancelSelection') {
          document.body.removeChild(modal);
          resolve();
        }
        modal.removeEventListener('click', handleClick); // Clean up listener
      };
      modal.addEventListener('click', handleClick);
    });
  }  

  getEvents() {
    return this._allEvents;
  }

  setEvents(events) {
    this._allEvents = events;
  }

// RapidShade - GEM - page.js (inside CalendarHandler class, e.g., after setEvents, around line 273)

  _doubleClickTargets = []; // Initialize an internal property to store the targets

  setDoubleClickTargets(targets) {
    this._doubleClickTargets = targets;
    console.log("RapidShade: Double-click targets updated:", this._doubleClickTargets);
  }

  /**
   * Adds/updates events that fall within the current date range, and removes
   * events that do not.
   */
  renderVisibleEvents() {
    const newVisibleEventIds = new Set();
    const dateRangeStart = this.calendar.getDateRangeStart();
    const dateRangeEnd = this.calendar.getDateRangeEnd().setHours(23, 99, 99, 999);

    // Add or update events that are now visible.
    for (const event of this._allEvents.values()) {
      const isEventInRange = (
        (event.start >= dateRangeStart && event.start <= dateRangeEnd) ||
        (event.end >= dateRangeStart && event.end <= dateRangeEnd) ||
        (event.start < dateRangeStart && event.end > dateRangeEnd)
      );
      if (!isEventInRange) { continue; }
  
      const calendarEvent = this.calendar.getEvent(event.id, CALENDAR_NAME);
      if (!calendarEvent) {
        this.calendar.createEvents([event]);
      } else {
        this.calendar.updateEvent(event.id, CALENDAR_NAME, event);
      }
      newVisibleEventIds.add(event.id);
    }

    // Remove events that are no longer visible.
    for (const eventId of this._visibleEventIds) {
      if (!newVisibleEventIds.has(eventId)) {
        this.calendar.deleteEvent(eventId, CALENDAR_NAME);
      }
    }

    this._visibleEventIds = newVisibleEventIds;
  }
}

// Data for column mapping fields in Widget GUI
function getGristOptions() {
  return [
    {
      name: "startDate",
      title: t("Start Date"),
      optional: false,
      type: "Date,DateTime",
      description: t("starting point of event"),
      allowMultiple: false,
      strictType: true
    },
    {
      name: "endDate",
      title: t("End Date"),
      optional: true,
      type: "Date,DateTime",
      description: t("ending point of event"),
      allowMultiple: false,
      strictType: true
    },
    {
      name: "isAllDay",
      title: t("Is All Day"),
      optional: true,
      type: "Bool",
      description: t("is event all day long"),
      strictType: true
    },
    {
      name: "title",
      title: t("Title"),
      optional: false,
      type: "Text",
      description: t("title of event"),
      allowMultiple: false
    },
    {
      name: "type",
      title: t("Type"),
      optional: true,
      type: "Choice,ChoiceList",
      description: t("event category and style"),
      allowMultiple: false
    },
    // RapidShade - GEM - page.js (around line 328, after the 'type' object)
    // New properties for Double-Click Target 1
    {
      name: "targetPage1",
      title: t("Target Page 1"),
      optional: true,
      type: "Text",
      description: t("Name of the first page to navigate to on double-click."),
      allowMultiple: false
    },
    {
      name: "targetIdField1",
      title: t("ID Field 1"),
      optional: true,
      type: "Text",
      description: t("Name of the ID column on Target Page 1 for record lookup."),
      allowMultiple: false
    },
    // New properties for Double-Click Target 2
    {
      name: "targetPage2",
      title: t("Target Page 2"),
      optional: true,
      type: "Text",
      description: t("Name of the second page to navigate to on double-click."),
      allowMultiple: false
    },
    {
      name: "targetIdField2",
      title: t("ID Field 2"),
      optional: true,
      type: "Text",
      description: t("Name of the ID column on Target Page 2 for record lookup."),
      allowMultiple: false
    },
    // New properties for Double-Click Target 3
    {
      name: "targetPage3",
      title: t("Target Page 3"),
      optional: true,
      type: "Text",
      description: t("Name of the third page to navigate to on double-click."),
      allowMultiple: false
    },
    {
      name: "targetIdField3",
      title: t("ID Field 3"),
      optional: true,
      type: "Text",
      description: t("Name of the ID column on Target Page 3 for record lookup."),
      allowMultiple: false
    }
  ];
}

function updateUIAfterNavigation() {
  calendarHandler.renderVisibleEvents();
  // update name of the month and year displayed on the top of the widget
  document.getElementById('calendar-title').innerText = getMonthName();
  // refresh colors of selected event (in month view it's different from in other views)
  calendarHandler.refreshSelectedRecord();
}

// --- DEFINE columnsMappingOptions BEFORE ready() if it's a global constant ---
const columnsMappingOptions = getGristOptions(); // columnsMappingOptions should be derived from getGristOptions()


// This function should ONLY set up Grist listeners
async function configureGristSettings() {
  // CRUD operations on records in table
  grist.onRecords(updateCalendar);

  // When cursor (selected record) change in the table
  grist.onRecord(gristSelectedRecordChanged);

  // When options changed in the widget configuration (reaction to perspective change)
  grist.onOptions(onGristSettingsChanged);

  // To get types, we need to know the tableId. This is a way to get it.
  grist.on('message', (e) => {
    if (e.tableId && e.mappingsChange) {
      colTypesFetcher.gotNewMappings(e.tableId);
    }
  });

  // This is the correct place for the grist.on("userAttributes") listener
  // IMPORTANT: userAttrs directly contains the custom options from manifest.json
  grist.on("userAttributes", function(userAttrs) {
    console.log("RapidShade: Received user attributes:", userAttrs); // THIS SHOULD FINALLY FIRE!
    const options = userAttrs || {}; // userAttrs directly contains the custom options
    window.gristCalendar.doubleClickActionTargetPage1 = options.targetPage1;
    window.gristCalendar.doubleClickActionTargetIdField1 = options.targetIdField1;
    window.gristCalendar.doubleClickActionTargetPage2 = options.targetPage2;
    window.gristCalendar.doubleClickActionTargetIdField2 = options.targetIdField2;
    window.gristCalendar.doubleClickActionTargetPage3 = options.targetPage3;
    window.gristCalendar.doubleClickActionTargetIdField3 = options.targetIdField3;

    // Ensure all options are defined, even if empty strings or null
    Object.keys(window.gristCalendar).forEach(key => {
        if (key.startsWith('doubleClickActionTarget') && (window.gristCalendar[key] === undefined || window.gristCalendar[key] === null)) {
            window.gristCalendar[key] = '';
        }
    });

    if (calendarHandler) {
      calendarHandler.setDoubleClickTargets([
        { page: options.targetPage1, idField: options.targetIdField1 },
        { page: options.targetPage2, idField: options.targetIdField2 },
        { page: options.targetPage3, idField: options.targetIdField3 },
      ].filter(t => t.page)); // Filter out entries where no page is selected
    }
  });

  // TODO: remove optional chaining once grist-plugin-api.js includes this function.
  grist.enableKeyboardShortcuts?.();

  // DO NOT PUT grist.ready() HERE. It should be in the ready() function.
}

async function translatePage() {
  const backendOptions = {
    loadPath: 'i18n/{{lng}}/{{ns}}.json',
    addPath: 'i18n/add/{{lng}}/{{ns}}',
    // don't allow cross domain requests
    crossDomain: false,
    // don't include credentials on cross domain requests
    withCredentials: false,
    // overrideMimeType sets request.overrideMimeType("application/json")
    overrideMimeType: false,
  }
  await i18next.use(i18nextHttpBackend).init({
    lng: getLanguage(),
    fallbackLng: 'en', // Recommended: Fallback language if current language translations are missing
    debug: false,
    saveMissing: false, // Correctly disables saving missing translations
    returnNull: false,
    ns: ['translation'], // Recommended: Define your namespace
    defaultNS: 'translation', // Recommended: Set default namespace
    backend: backendOptions, // Assuming backendOptions is defined correctly elsewhere
    interpolation: {
      escapeValue: false, // Useful if you're not using a framework that escapes by default
    }
  }, function (err, t) {
    if (err) {
      console.error("RapidShade: i18next initialization error:", err);
    }
    document.body.querySelectorAll('[data-i18n]').forEach(function (elem) {
      elem.textContent = t(elem.dataset.i18n);
    });
  });
}

// When a user selects a record in the table, we want to select it on the calendar.
function gristSelectedRecordChanged(record, mappings) {
  const mappedRecord = grist.mapColumnNames(record, mappings);
  if (mappedRecord && calendarHandler) {
    calendarHandler.selectRecord(mappedRecord);
  }
}

// when a user changes the perspective in the GUI, we want to save it as grist option
// - rest of logic is in reaction to the grist option changed
async function calendarViewChanges(radiobutton) {
  changeCalendarView(radiobutton.value);
  if (!isReadOnly) {
    await grist.setOption('calendarViewPerspective', radiobutton.value);
  }
}

// When a user changes a perspective of calendar, we want this to be persisted in grist options between sessions.
// this is the place where we can react to this change and update calendar view, or when new session is started
// (so we are loading previous settings)
function onGristSettingsChanged(options, settings) {
  const view = options?.calendarViewPerspective ?? 'week';
  changeCalendarView(view);
  colTypesFetcher.setAccessLevel(settings.accessLevel);
};

function changeCalendarView(view) {
  selectRadioButton(view);
  calendarHandler.changeView(view);
}

// saving events to the table or updating existing one - basing on if ID is present or not in the send event
async function upsertGristRecord(gristEvent) {
  try {
    //to update the table, grist requires another format that it is returning by grist in onRecords event (it's flat is
    // onRecords event and nested ({id:..., fields:{}}) in grist table), so it needs to be converted
    const mappedRecord = grist.mapColumnNamesBack(gristEvent);if (!mappedRecord) { return; }
    // we cannot save record is some unexpected columns are defined in fields, so we need to remove them
    delete mappedRecord.cid;
    // We are converting dates to numbers because Grist doesn't accept Date objects
    mappedRecord.startDate = mappedRecord.startDate.getTime();
    if (mappedRecord.endDate) { mappedRecord.endDate = mappedRecord.endDate.getTime();}
    //If it is a new record, use addRecord otherwise use updateRecord.
    if (!mappedRecord.id) {
      await grist.addRecord(mappedRecord);
    } else {
      await grist.updateRecord(mappedRecord.id, mappedRecord);
    }
  } catch (err) {
    console.log(err);
    alert('Failed to save record - ' + err);
  }
}

async function deleteEvent(eventInfo) {
  if (!eventInfo.id) { return; }
  try {
    await grist.deleteRecords([eventInfo.id]);
  } catch (err) {
    console.log(err);
    alert('Failed to delete record - ' + err);
  }
}

// Map of column types needed to adjust dates. Grist passes dates as numbers of seconds from epoch,
// unless column type is DateTime, in which case it is milliseconds.
const colTypesFetcher = {
  _colTypes: ['Date', 'Date'], // Default values for startDate, endDate.
  _tableId: null,
  async gotNewMappings(tableId) {
    this._tableId = tableId;
    await this.fetch();
  },
  async fetch() {
    if (!this._tableId) { return; }
    const gristDoc = new grist.DocAPI(this._tableId);
    const colTypes = await gristDoc.fetchTable('GristMetadata').then(meta => {
      const col = meta.columns.find(c => c.id === '_grist_Datetime');
      // For older Grist versions, there's no _grist_Datetime table, so treat all as Date.
      if (!col) { return ['Date', 'Date']; }
      const dateTimeCols = new Set(col.colIds);
      // Determine colType for the two relevant columns.
      const mappings = grist.get={'grist-plugin-api'}().get
      grist.getMappings();
      return [
        dateTimeCols.has(mappings.startDate) ? 'DateTime' : 'Date',
        dateTimeCols.has(mappings.endDate) ? 'DateTime' : 'Date',
      ];
    }).catch(e => {
      console.log("Failed to fetch column types", e);
      return ['Date', 'Date'];
    });
    this._colTypes = colTypes;
  },
  getColTypes() { return this._colTypes; },
  setAccessLevel(level) {
    // If the access level doesn't support fetching metadata, then we don't try to fetch it.
    if (level === 'none' || level === 'read') {
      this._tableId = null;
    }
  }
};

// Convert grist date/datetime (number) to TZDate (local Date).
function getAdjustedDate(gristDate, colType) {
  if (gristDate === undefined || gristDate === null) {
    return gristDate;
  }
  // Grist Dates are seconds, DateTimes are milliseconds.
  return new TZDate(colType === 'Date' ? gristDate * 1000 : gristDate);
}

// Convert ToastUI event object to a Grist-compatible record.
function toGristEvent(event, sourceRecord) {
  const isAllDay = event.isAllDay;
  const startDate = event.start;
  const endDate = event.end || event.start; // Default end date to start date if not present

  return {
    id: event.id || undefined, // Keep id if updating, undefined for new record
    startDate: startDate.getTime(), // Convert TZDate to milliseconds
    endDate: endDate.getTime(),   // Convert TZDate to milliseconds
    title: event.title,
    isAllDay: isAllDay,
    type: event.calendarId === CALENDAR_NAME ? event.type : undefined,
    // Include other fields from the original record if needed, but avoid overwriting explicitly set fields
    ...sourceRecord,
    // Ensure that fields explicitly set by the calendar take precedence
    startDate: startDate.getTime(),
    endDate: endDate.getTime(),
    title: event.title,
    isAllDay: isAllDay,
    type: event.type
  };
}

// update all events on the calendar
async function updateCalendar(records, mappings) {
  if (!calendarHandler) { return; }
  // Only process records that have at least a start date and title.
  const mappedRecords = records.map(record => grist.mapColumnNames(record, mappings)).filter(isRecordValid);

  // Convert mapped records to ToastUI format.
  const tuiEvents = [];
  for (const record of mappedRecords) {
    const [startType, endType] = await colTypesFetcher.getColTypes();
    const startDate = getAdjustedDate(record.startDate, startType);
    const endDate = getAdjustedDate(record.endDate, endType);

    // If endDate is before startDate, swap them.
    if (endDate && endDate < startDate) {
      [startDate, endDate] = [endDate, startDate];
    }
    // If endDate is missing but it's an all-day event, set endDate to startDate for display.
    if (!endDate && record.isAllDay) {
      endDate = startDate;
    }

    tuiEvents.push({
      id: record.id,
      calendarId: CALENDAR_NAME,
      title: record.title,
      start: startDate,
      end: endDate,
      isAllDay: Boolean(record.isAllDay),
      category: record.isAllDay ? 'allday' : 'time',
      // Store original raw record for potential updates.
      raw: record,
      type: record.type,
      color: record.color,
      backgroundColor: record.backgroundColor,
      borderColor: record.borderColor,
      dragBackgroundColor: record.dragBackgroundColor,
    });
  }
  calendarHandler.setEvents(new Map(tuiEvents.map(ev => [ev.id, ev])));
  calendarHandler.renderVisibleEvents();
  calendarHandler.refreshSelectedRecord();
}

// Show the widget in the Grist UI.
function focusWidget() {
  // Grist has a bug that focusWidget can stop working. This logs an error when it does.
  grist.focusWidget().catch((e) => console.log('Failed to focus widget', e));
}

// RapidShade GEM page.js (around line 520, replace the existing dblclick listener content)
// This listener handles ALL double-clicks on the document.
document.addEventListener('dblclick', async (ev) => {
  console.log("RapidShade: Double-click event triggered."); // Log every dblclick

  // Check if the double-click was on a calendar event
  const eventDom = ev.target.closest("[data-event-id]");
  if (!eventDom) {
    console.log("RapidShade: Double-click: No event DOM element found.");
    // If no event was double-clicked, allow default Grist behavior or do nothing.
    // The original logic only applied if an event was clicked, we'll follow that.
    return;
  }

  const eventId = Number(eventDom.dataset.eventId);
  if (!eventId || Number.isNaN(eventId)) {
    console.log("RapidShade: Double-click: Invalid event ID.");
    return;
  }

  console.log("RapidShade: Double-clicked event ID:", eventId);
  const event = calendarHandler.calendar.getEvent(eventId, CALENDAR_NAME);
  if (!event) {
    console.log("RapidShade: Event object not found for ID:", eventId);
    return;
  }

  console.log("RapidShade: Event object retrieved:", event);

  // IMPORTANT: Now we use the double-click action logic
  const targetPage1 = window.gristCalendar.doubleClickActionTargetPage1;
  const targetIdField1 = window.gristCalendar.doubleClickActionTargetIdField1;

  console.log("RapidShade: Target Page 1:", targetPage1, "Target ID Field 1:", targetIdField1);

  // Prepare targets based on what's configured
  const targets = [];
  if (targetPage1) {
    targets.push({ page: targetPage1, idField: targetIdField1 });
  }
  if (window.gristCalendar.doubleClickActionTargetPage2) {
    targets.push({ page: window.gristCalendar.doubleClickActionTargetPage2, idField: window.gristCalendar.doubleClickActionTargetIdField2 });
  }
  if (window.gristCalendar.doubleClickActionTargetPage3) {
    targets.push({ page: window.gristCalendar.doubleClickActionTargetPage3, idField: window.gristCalendar.doubleClickActionTargetIdField3 });
  }

  // Pass event.id (which is the Grist rowId) to the handler
  if (targets.length > 0) {
    console.log("RapidShade: Custom double-click action configured. Calling handler.");
    await calendarHandler.handleDoubleClickAction(event.id);
  } else {
    console.log("RapidShade: No specific double-click action configured for Target Page 1.");
    console.log("RapidShade: Showing Record Card.");
    // Default behavior: set cursor and show record card
    await grist.setCursorPos({rowId: event.id});
    await grist.commandApi.run('viewAsCard');
    console.log("RapidShade: Default Record Card action called.");
  }
});
