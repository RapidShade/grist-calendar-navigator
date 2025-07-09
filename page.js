// to keep all calendar related logic;
console.log("RapidShade: page.js version - " + new Date().toLocaleTimeString()); // KEEP THIS LINE AT THE VERY TOP

let calendarHandler;
let gristApiInitialized = false; // Flag to track Grist API readiness

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

let TZDate = null; // Will be set by tui.Calendar initialization

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
  if (!calendarHandler || !calendarHandler.calendar) {
    return ''; // Return empty if calendar isn't ready
  }
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
      // Ensure gristApiInitialized and record ID exists before calling setCursorPos
      if (gristApiInitialized && info.event.id) {
        focusWidget();
        await grist.setCursorPos({rowId: info.event.id});
      }
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
    if (!calendarViewPerspective) return; // Defensive check
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

  async handleDoubleClickAction(recordId) {
    const targets = this._doubleClickTargets;

    if (!targets || targets.length === 0) {
      // No custom targets configured, fall back to default Grist behavior
      console.log("RapidShade: No custom double-click targets configured. Falling back to default behavior.");
      if (gristApiInitialized) {
        await grist.setCursorPos({rowId: recordId});
        await grist.commandApi.run('viewAsCard');
      } else {
        console.warn("RapidShade: Grist API not initialized for double-click fallback.");
      }
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
    if (!gristApiInitialized) {
      console.warn("RapidShade: Grist API not initialized for navigation.");
      alert(`Grist API not ready. Could not navigate to "${pageName}".`);
      return;
    }
    try {
      // First navigate to the page
      await grist.navigate({ page: pageName });

      // After navigating, attempt to select the row by recordId (which should be the Grist rowId)
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

  getEvents() { return this._allEvents; }
  setEvents(events) { this._allEvents = events; }

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
      if (!isEventInRange) {
        continue;
      }
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
    { name: "startDate", title: t("Start Date"), optional: false, type: "Date,DateTime", description: t("starting point of event"), allowMultiple: false, strictType: true },
    { name: "endDate", title: t("End Date"), optional: true, type: "Date,DateTime", description: t("ending point of event"), allowMultiple: false, strictType: true },
    { name: "isAllDay", title: t("Is All Day"), optional: true, type: "Bool", description: t("is event all day long"), strictType: true },
    { name: "title", title: t("Title"), optional: false, type: "Text", description: t("title of event"), allowMultiple: false },
    { name: "type", title: t("Type"), optional: true, type: "Choice,ChoiceList", description: t("event category and style"), allowMultiple: false },
    // New properties for Double-Click Target 1
    { name: "targetPage1", title: t("Target Page 1"), optional: true, type: "Text", description: t("Name of the first page to navigate to on double-click."), allowMultiple: false },
    { name: "targetIdField1", title: t("ID Field 1"), optional: true, type: "Text", description: t("Name of the ID column on Target Page 1 for record lookup."), allowMultiple: false },
    // New properties for Double-Click Target 2
    { name: "targetPage2", title: t("Target Page 2"), optional: true, type: "Text", description: t("Name of the second page to navigate to on double-click."), allowMultiple: false },
    { name: "targetIdField2", title: t("ID Field 2"), optional: true, type: "Text", description: t("Name of the ID column on Target Page 2 for record lookup."), allowMultiple: false },
    // New properties for Double-Click Target 3
    { name: "targetPage3", title: t("Target Page 3"), optional: true, type: "Text", description: t("Name of the third page to navigate to on double-click."), allowMultiple: false },
    { name: "targetIdField3", title: t("ID Field 3"), optional: true, type: "Text", description: t("Name of the ID column on Target Page 3 for record lookup."), allowMultiple: false }
  ];
}

function updateUIAfterNavigation() {
  if (!calendarHandler || !calendarHandler.calendar) {
    return; // Don't proceed if calendar isn't ready
  }
  calendarHandler.renderVisibleEvents();
  // update name of the month and year displayed on the top of the widget
  document.getElementById('calendar-title').innerText = getMonthName();
  // refresh colors of selected event (in month view it's different from in other views)
  calendarHandler.refreshSelectedRecord();
}

// --- DEFINE columnsMappingOptions BEFORE ready() if it's a global constant ---
const columnsMappingOptions = getGristOptions();

// This function should ONLY set up Grist listeners
async function configureGristSettings() {
  // CRUD operations on records in table
  grist.onRecords(updateCalendar);
  // When cursor (selected record) change in the table
  grist.onRecord(gristSelectedRecordChanged); // This now passes record, not just rowId
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
    console.log("RapidShade: Received user attributes:", userAttrs);
    const options = userAttrs || {};

    window.gristCalendar.doubleClickActionTargetPage1 = options.targetPage1;
    window.gristCalendar.doubleClickActionTargetIdField1 = options.targetIdField1;
    window.gristCalendar.doubleClickActionTargetPage2 = options.targetPage2;
    window.gristCalendar.doubleClickActionTargetIdField2 = options.targetIdField2;
    window.gristCalendar.doubleClickActionTargetPage3 = options.targetPage3;
    window.gristCalendar.doubleClickActionTargetIdField3 = options.targetIdField3;

    // Ensure all options are defined, even if empty strings or null
    Object.keys(window.gristCalendar).forEach(key => {
      if (key.startsWith('doubleClickActionTarget') && (window.gristCalendar[key] === null || window.gristCalendar[key] === undefined)) {
        window.gristCalendar[key] = ''; // Ensure they are empty strings if not set
      }
    });

    // === NEW LOGIC: Pass configured targets to CalendarHandler ===
    const targets = [];
    if (window.gristCalendar.doubleClickActionTargetPage1 && window.gristCalendar.doubleClickActionTargetIdField1) {
      targets.push({
        page: window.gristCalendar.doubleClickActionTargetPage1,
        idField: window.gristCalendar.doubleClickActionTargetIdField1
      });
    }
    if (window.gristCalendar.doubleClickActionTargetPage2 && window.gristCalendar.doubleClickActionTargetIdField2) {
      targets.push({
        page: window.gristCalendar.doubleClickActionTargetPage2,
        idField: window.gristCalendar.doubleClickActionTargetIdField2
      });
    }
    if (window.gristCalendar.doubleClickActionTargetPage3 && window.gristCalendar.doubleClickActionTargetIdField3) {
      targets.push({
        page: window.gristCalendar.doubleClickActionTargetPage3,
        idField: window.gristCalendar.doubleClickActionTargetIdField3
      });
    }
    // Update the CalendarHandler with the new targets
    if (calendarHandler) { // Ensure calendarHandler is initialized
      calendarHandler.setDoubleClickTargets(targets);
    } else {
      console.warn("RapidShade: calendarHandler not yet initialized when userAttributes received. Targets will be set on initialization.");
    }
  });
}

// Function to put focus on the widget whenever clicked or a row is selected programmatically.
function focusWidget() {
  if (gristApiInitialized) {
    grist.setAccessLevel('full');
  }
}

// Fetches all records from the mapped table and updates the calendar.
// Called on grist.onRecords, and also initially.
async function updateCalendar(records, mappings) {
  // Pass mappings to colTypesFetcher (CRUCIAL FIX)
  colTypesFetcher.setMappings(mappings);
  const currentMappings = mappings;

  if (records.length > 0) {
    const [startType, endType] = await colTypesFetcher.getColTypes();
    const events = new Map();
    for (const record of records) {
      const startDate = getAdjustedDate(record.startDate, startType);
      const endDate = getAdjustedDate(record.endDate, endType);
      if (isRecordValid(record)) {
        events.set(record.id, {
          id: record.id,
          calendarId: CALENDAR_NAME,
          title: record.title,
          start: new TZDate(startDate),
          end: new TZDate(endDate),
          isAllDay: record.isAllDay ?? false,
          category: record.isAllDay ? 'allday' : 'time',
          backgroundColor: record.type && currentMappings.type && grist.columnTypes.get(currentMappings.type) && grist.columnTypes.get(currentMappings.type).type === 'Choice' && grist.columnTypes.get(currentMappings.type).choices.find(c => c.value === record.type)?.color,
          raw: record, // Original record, for convenience
        });
      }
    }
    if (calendarHandler) { // Ensure calendarHandler is initialized before using
      calendarHandler.setEvents(events);
      calendarHandler.renderVisibleEvents();
    }

    if (currentMappings.startDate && currentMappings.title && currentMappings.id) {
      if (!gristApiInitialized) { // Only call grist.ready once
        await grist.ready({
          required: [currentMappings.startDate, currentMappings.title, currentMappings.id],
          optional: [currentMappings.endDate, currentMappings.isAllDay, currentMappings.type, "targetPage1", "targetIdField1", "targetPage2", "targetIdField2", "targetPage3", "targetIdField3"],
          widgetOptions: getGristWidgetOptions()
        });
        gristApiInitialized = true;
        // After grist.ready is truly done, then configure the rest.
        configureGristSettings();
        // Initial update of UI after the calendar and Grist API are ready
        updateUIAfterNavigation();
      }
    }
  } else {
    // If no records, clear events and ensure required mappings are still set for grist.ready
    if (calendarHandler) { // Ensure calendarHandler is initialized before using
      calendarHandler.setEvents(new Map());
      calendarHandler.renderVisibleEvents(); // Clear displayed events
    }
    if (mappings.startDate && mappings.title && mappings.id) {
      if (!gristApiInitialized) { // Only call grist.ready once
        await grist.ready({
          required: [mappings.startDate, mappings.title, mappings.id],
          optional: [mappings.endDate, mappings.isAllDay, mappings.type, "targetPage1", "targetIdField1", "targetPage2", "targetIdField2", "targetPage3", "targetIdField3"],
          widgetOptions: getGristWidgetOptions()
        });
        gristApiInitialized = true;
        configureGristSettings();
        updateUIAfterNavigation();
      }
    }
  }
}

// Adjusts date depending on column type (Date vs DateTime).
function getAdjustedDate(date, colType) {
  const isDateTime = colType === 'DateTime';
  return date === null ? undefined : new Date(isDateTime ? date : date * 1000);
}

// When selected record changes in the Grist table.
// Corrected signature: grist.onRecord now passes the record object
async function gristSelectedRecordChanged(record, mappings) {
  if (record && calendarHandler && calendarHandler.calendar) { // Ensure record and calendar are ready
    colTypesFetcher.setMappings(mappings); // Update mappings for colTypesFetcher
    await calendarHandler.selectRecord(record);
    calendarHandler.refreshSelectedRecord();
  }
}

// Updates the calendar view when the widget settings (options) change.
async function onGristSettingsChanged(options, mappings) {
  // Defensive check: ensure calendarHandler and its calendar instance are ready
  if (!calendarHandler || !calendarHandler.calendar) {
    console.warn("RapidShade: calendarHandler or its calendar instance not ready for onGristSettingsChanged.");
    return;
  }

  // Pass mappings to colTypesFetcher
  colTypesFetcher.setMappings(mappings);

  if (options.defaultView && calendarHandler.calendar.getViewName() !== options.defaultView) {
    calendarHandler.changeView(options.defaultView);
  }
  // Update colors if they are changed in the options
  const newMainColor = options.mainColor ?? 'var(--grist-theme-input-readonly-border)';
  if (calendarHandler._mainColor !== newMainColor) {
      calendarHandler._mainColor = newMainColor;
      calendarHandler.calendar.setOptions({
          calendars: [{id: CALENDAR_NAME, backgroundColor: newMainColor, borderColor: newMainColor}]
      });
  }

  const newCalendarBackgroundColor = options.calendarBackgroundColor ?? 'var(--grist-theme-page-panels-main-panel-bg)';
  if (calendarHandler._calendarBackgroundColor !== newCalendarBackgroundColor) {
      calendarHandler._calendarBackgroundColor = newCalendarBackgroundColor;
      calendarHandler.calendar.setTheme({
          common: {backgroundColor: newCalendarBackgroundColor}
      });
  }
  const newSelectedColor = options.selectedColor ?? 'var(--grist-theme-top-bar-button-primary-fg)';
  if (calendarHandler._selectedColor !== newSelectedColor) {
    calendarHandler._selectedColor = newSelectedColor;
    calendarHandler.refreshSelectedRecord(); // Re-highlight to apply new color
  }
  const newBorderStyle = options.borderStyle ?? '1px solid var(--grist-theme-table-body-border)';
  if (calendarHandler._borderStyle !== newBorderStyle) {
      calendarHandler._borderStyle = newBorderStyle;
      // Reapply entire theme to update borders
      calendarHandler.calendar.setTheme(calendarHandler._calendarTheme());
  }
  const newAccentColor = options.accentColor ?? 'var(--grist-theme-accent-text)';
  if (calendarHandler._accentColor !== newAccentColor) {
      calendarHandler._accentColor = newAccentColor;
      calendarHandler.calendar.setTheme(calendarHandler._calendarTheme());
  }
  const newTextColor = options.textColor ?? 'var(--grist-theme-text)';
  if (calendarHandler._textColor !== newTextColor) {
      calendarHandler._textColor = newTextColor;
      calendarHandler.calendar.setTheme(calendarHandler._calendarTheme());
  }
  const newSelectionColor = options.selectionColor ?? 'var(--grist-theme-selection)';
  if (calendarHandler._selectionColor !== newSelectionColor) {
      calendarHandler._selectionColor = newSelectionColor;
      calendarHandler.calendar.setTheme(calendarHandler._calendarTheme());
  }
}

// Widget options for the right-hand panel
function getGristWidgetOptions() {
  return {
    defaultView: {
      title: t("Default View"),
      type: "Choice",
      choices: [
        { value: "day", label: t("Day") },
        { value: "week", label: t("Week") },
        { value: "month", label: t("Month") },
      ],
      description: t("Default calendar view"),
      defaultValue: "week",
    },
    mainColor: {
      title: t("Main Color"),
      type: "Text",
      description: t("Main color for events and calendar elements (CSS variable or hex)"),
      defaultValue: 'var(--grist-theme-input-readonly-border)'
    },
    calendarBackgroundColor: {
      title: t("Calendar Background Color"),
      type: "Text",
      description: t("Background color of the calendar area (CSS variable or hex)"),
      defaultValue: 'var(--grist-theme-page-panels-main-panel-bg)'
    },
    selectedColor: {
      title: t("Selected Event Color"),
      type: "Text",
      description: t("Color to highlight the selected event (CSS variable or hex)"),
      defaultValue: 'var(--grist-theme-top-bar-button-primary-fg)'
    },
    borderStyle: {
      title: t("Border Style"),
      type: "Text",
      description: t("CSS border style for calendar grids"),
      defaultValue: '1px solid var(--grist-theme-table-body-border)'
    },
    accentColor: {
      title: t("Accent Color"),
      type: "Text",
      description: t("Accent color for indicators (CSS variable or hex)"),
      defaultValue: 'var(--grist-theme-accent-text)'
    },
    textColor: {
      title: t("Text Color"),
      type: "Text",
      description: t("General text color for calendar elements (CSS variable or hex)"),
      defaultValue: 'var(--grist-theme-text)'
    },
    selectionColor: {
      title: t("Selection Color"),
      type: "Text",
      description: t("Color for grid selections (CSS variable or hex)"),
      defaultValue: 'var(--grist-theme-selection)'
    }
  };
}


// ColTypesFetcher object to determine if date columns are Date or DateTime
const colTypesFetcher = {
  _colTypes: ['Date', 'Date'], // Default values for startDate, endDate.
  _tableId: null,
  _currentMappings: null, // NEW: Store current mappings received from Grist

  setMappings(mappings) { // NEW: Method to set mappings from Grist callbacks
    this._currentMappings = mappings;
  },

  async gotNewMappings(tableId) {
    this._tableId = tableId;
    await this.fetch();
  },

  async fetch() {
    if (!this._tableId || !this._currentMappings || !gristApiInitialized) { // Ensure mappings and API are available before fetching
      console.log("RapidShade: colTypesFetcher.fetch() - Missing tableId, mappings, or Grist API not initialized. Skipping metadata fetch.");
      return;
    }
    const gristDoc = new grist.DocAPI(this._tableId);
    try {
      const meta = await gristDoc.fetchTable('GristMetadata');
      const col = meta.columns.find(c => c.id === '_grist_Datetime');
      // For older Grist versions, there's no _grist_Datetime table, so treat all as Date.
      if (!col) {
        this._colTypes = ['Date', 'Date'];
        return;
      }
      const dateTimeCols = new Set(col.colIds);
      // Use the stored mappings to determine column types
      const mappings = this._currentMappings;
      this._colTypes = [
        dateTimeCols.has(mappings.startDate) ? 'DateTime' : 'Date',
        dateTimeCols.has(mappings.endDate) ? 'DateTime' : 'Date',
      ];
    } catch (e) {
      console.log("RapidShade: Failed to fetch column types from GristMetadata", e);
      this._colTypes = ['Date', 'Date']; // Fallback to Date in case of error
    }
  },
  getColTypes() { return this._colTypes; },
  setAccessLevel(level) {
    // If the access level doesn't support fetching metadata, then we don't try to fetch it.
    if (level === 'none' || level === 'read') {
      this._tableId = null;
    }
  }
};


// Function to handle calendar view changes from the UI buttons
function changeCalendarView(viewName) {
  if (calendarHandler) {
    calendarHandler.changeView(viewName);
  }
}

// --- Grist Widget Configuration (runs once when widget is loaded) ---
ready(async function() {
  calendarHandler = new CalendarHandler(); // Initialize the CalendarHandler
  // The first grist.ready call just gets the initial mappings.
  // We explicitly set widgetOptions here as well, so the panel appears.
  await grist.ready({
    columns: columnsMappingOptions,
    required: ["startDate", "title"],
    optional: ["endDate", "isAllDay", "type", "targetPage1", "targetIdField1", "targetPage2", "targetIdField2", "targetPage3", "targetIdField3"],
    widgetOptions: getGristWidgetOptions() // Pass widget options here
  });
  gristApiInitialized = true;

  // Now that Grist API is ready and calendarHandler is initialized,
  // set up the main listeners.
  configureGristSettings();

  // Add event listeners for view control buttons (IDs will be added in index.html)
  document.getElementById('dayView')?.addEventListener('change', () => changeCalendarView('day'));
  document.getElementById('weekView')?.addEventListener('change', () => changeCalendarView('week'));
  document.getElementById('monthView')?.addEventListener('change', () => changeCalendarView('month'));

  // Add event listeners for navigation buttons (using class names as they are common)
  document.getElementById('calendarPrev')?.addEventListener('click', () => calendarHandler.calendarPrevious());
  document.getElementById('calendarNext')?.addEventListener('click', () => calendarHandler.calendarNext());
  document.getElementById('calendarToday')?.addEventListener('click', () => calendarHandler.calendarToday());

  // Initial update of UI after the calendar and Grist API are ready
  updateUIAfterNavigation();
});


document.addEventListener('dblclick', async (ev) => {
  if (!ev.target || !calendarHandler || !calendarHandler.calendar || !gristApiInitialized) { return; }

  const eventDom = ev.target.closest("[data-event-id]");
  if (!eventDom) {
    // If no event was double-clicked, allow default Grist behavior or do nothing.
    return;
  }

  // First get the id of the event at hand.
  const eventId = Number(eventDom.dataset.eventId);
  if (!eventId || Number.isNaN(eventId)) { return; }

  // Now get the model from the calendar.
  const event = calendarHandler.calendar.getEvent(eventId, CALENDAR_NAME);
  if (!event) { return; }

  // Now delegate to the new handleDoubleClickAction in CalendarHandler
  await calendarHandler.handleDoubleClickAction(event.id);
});

// Helper for upserting events; either creates a new event, or updates an existing one.
async function upsertEvent(eventInfo) {
  if (!gristApiInitialized) {
    console.warn("RapidShade: Grist API not initialized for upsertEvent.");
    alert('Grist API not ready. Failed to save event.');
    return;
  }
  const recordId = eventInfo.id;
  // raw contains current values, including unmapped ones. Not directly used for updates.

  // Map back to Grist column names
  const updates = {};
  if (eventInfo.title !== undefined) updates.title = eventInfo.title;
  if (eventInfo.start !== undefined) updates.startDate = eventInfo.start.getTime() / 1000;
  if (eventInfo.end !== undefined) updates.endDate = eventInfo.end.getTime() / 1000;
  if (eventInfo.isAllDay !== undefined) updates.isAllDay = eventInfo.isAllDay;

  try {
    if (recordId) {
      // Update existing record
      await grist.updateRecords({ id: recordId, fields: updates });
      console.log('RapidShade: Event updated:', recordId, updates);
    } else {
      // Create new record
      const newRecordIds = await grist.addRecords({ fields: updates });
      console.log('RapidShade: Event added, new ID:', newRecordIds[0]);
    }
  } catch (error) {
    console.error('RapidShade: Failed to upsert event:', error);
    alert('Failed to save event. Check your mappings and permissions.');
  }
}

// Helper for deleting events.
async function deleteEvent(eventInfo) {
  if (!gristApiInitialized) {
    console.warn("RapidShade: Grist API not initialized for deleteEvent.");
    alert('Grist API not ready. Failed to delete event.');
    return;
  }
  try {
    await grist.deleteRecords([eventInfo.id]);
    console.log('RapidShade: Event deleted:', eventInfo.id);
  } catch (error) {
    console.error('RapidShade: Failed to delete event:', error);
    alert('Failed to delete event. Check your permissions.');
  }
}
