/**
 * StoryTimelines Extension for SillyTavern
 * Version: 2.0.0
 * Author: MossMilkRat & Claude
 * Description: Adds story date/time fields to lorebook entries and timeline view
 * License: MIT
 */

(function() {
    'use strict';
    
    const MODULE_NAME = 'storytimelines';
    
    // Extension settings
    let settings = {
        dateTimeFormat: '24hour',
        defaultView: 'all' // 'all', 'year', 'month', 'week', 'day'
    };
    
    // State
    let currentWorldInfo = null;
    let observerInitialized = false;
    
    /**
     * Initialize the extension
     */
    async function init() {
        console.log('StoryTimelines: ===== STARTING INITIALIZATION =====');
        
        await loadSettings();
        console.log('StoryTimelines: Settings loaded');
        
        // Add to extensions menu
        addExtensionsMenuButton();
        
        // Add View Timeline button to World Info interface
        addTimelineButton();
        
        // Create timeline viewer modal (HIDDEN by default)
        createTimelineViewer();
        
        // Create settings UI
        createSettingsUI();
        
        // Observe DOM for lorebook entry editor to add toggle button
        observeLorebookEditor();
        
        // Register slash command
        registerSlashCommand();
        
        // Double-check viewer is hidden
        setTimeout(() => {
            const viewer = document.getElementById('storytimeline-viewer');
            if (viewer) {
                const isVisible = viewer.classList.contains('storytimeline-viewer-visible') || 
                                 window.getComputedStyle(viewer).display !== 'none';
                if (isVisible) {
                    console.error('StoryTimelines: VIEWER IS VISIBLE ON INIT - FORCING HIDE');
                    viewer.classList.add('storytimeline-viewer-hidden');
                    viewer.classList.remove('storytimeline-viewer-visible');
                } else {
                    console.log('StoryTimelines: Viewer confirmed hidden');
                }
            }
        }, 500);
        
        console.log('StoryTimelines: ===== INITIALIZATION COMPLETE =====');
    }
    
    /**
     * Add button to extensions menu
     */
    function addExtensionsMenuButton() {
        const extensionsMenu = document.getElementById('extensionsMenu');
        if (!extensionsMenu) {
            setTimeout(addExtensionsMenuButton, 500);
            return;
        }
        
        if (document.getElementById('storytimeline-ext-button')) {
            return; // Already added
        }
        
        const button = document.createElement('div');
        button.id = 'storytimeline-ext-button';
        button.className = 'list-group-item flex-container flexGap5';
        button.title = 'Story Timeline';
        button.style.cursor = 'pointer';
        
        button.innerHTML = `
            <div class="fa-solid fa-clock extensionsMenuExtensionButton"></div>
            Story Timeline
        `;
        
        button.addEventListener('click', showTimelineViewer);
        extensionsMenu.appendChild(button);
        
        console.log('StoryTimelines: Added to extensions menu');
    }
    
    /**
     * Load extension settings
     */
    async function loadSettings() {
        try {
            const context = SillyTavern.getContext();
            if (context?.extensionSettings?.[MODULE_NAME]) {
                settings = { ...settings, ...context.extensionSettings[MODULE_NAME] };
            }
        } catch (e) {
            console.warn('StoryTimelines: Could not load settings', e);
        }
    }
    
    /**
     * Save extension settings
     */
    async function saveSettings() {
        try {
            const context = SillyTavern.getContext();
            if (context?.extensionSettings) {
                context.extensionSettings[MODULE_NAME] = settings;
                context.saveSettingsDebounced?.();
            }
        } catch (e) {
            console.warn('StoryTimelines: Could not save settings', e);
        }
    }
    
    /**
     * Add View Timeline button to World Info interface
     */
    function addTimelineButton() {
        // Wait for World Info UI to load
        const checkInterval = setInterval(() => {
            const buttonContainer = document.querySelector('#world_info_buttons, .world_info_buttons');
            
            if (buttonContainer && !document.getElementById('storytimeline-view-btn')) {
                const btn = document.createElement('div');
                btn.id = 'storytimeline-view-btn';
                btn.className = 'menu_button';
                btn.title = 'View Timeline';
                btn.innerHTML = '<i class="fa-solid fa-clock"></i> Timeline';
                btn.style.marginLeft = '5px';
                
                btn.addEventListener('click', showTimelineViewer);
                buttonContainer.appendChild(btn);
                
                console.log('StoryTimelines: Timeline button added');
                clearInterval(checkInterval);
            }
        }, 500);
        
        // Stop checking after 10 seconds
        setTimeout(() => clearInterval(checkInterval), 10000);
    }
    
    /**
     * Observe lorebook editor for when entries are opened
     */
    function observeLorebookEditor() {
        if (observerInitialized) return;
        
        // Use a more targeted approach - wait for the specific world info popup
        const checkForEntries = setInterval(() => {
            // Look for world entry forms that don't have our button yet
            const entryForms = document.querySelectorAll('.world_entry_form_horizontal:not(.storytimeline-processed), .world_entry_form:not(.storytimeline-processed)');
            
            if (entryForms.length === 0) return;
            
            entryForms.forEach(form => {
                // Only process visible forms in actual world info editors
                if (form.offsetParent === null) return;
                
                // Check if this is in a world info context
                const isInWorldInfo = form.closest('#world_popup, .world_entry, #rm_print_characters_block');
                if (!isInWorldInfo) return;
                
                // Check if button already exists
                if (form.querySelector('.storytimeline-toggle-btn')) {
                    form.classList.add('storytimeline-processed');
                    return;
                }
                
                // Add button
                console.log('StoryTimelines: Found new entry form, adding button');
                addTimelineButtonToEntry(form);
                form.classList.add('storytimeline-processed');
            });
        }, 1000); // Check every second
        
        // Store the interval so we can clear it if needed
        window.storytimelinesCheckInterval = checkForEntries;
        
        observerInitialized = true;
        console.log('StoryTimelines: Polling for lorebook entries');
    }
    
    /**
     * Add timeline button to entry editor (instead of auto-injecting fields)
     */
    function addTimelineButtonToEntry(entryForm) {
        // entryForm is now passed directly, should be the form element
        if (!entryForm || entryForm.querySelector('.storytimeline-toggle-btn')) {
            return; // Not found or already added
        }
        
        console.log('StoryTimelines: Adding toggle button to entry editor');
        
        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'menu_button storytimeline-toggle-btn';
        toggleBtn.type = 'button';
        toggleBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Add Story Timeline';
        toggleBtn.title = 'Add/Edit Story Timeline';
        toggleBtn.style.cssText = 'margin: 10px 5px;';
        
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('StoryTimelines: Button clicked');
            
            // Check if fields already exist
            const existingFields = entryForm.querySelector('.storytimeline-fields');
            if (existingFields) {
                // Toggle visibility
                if (existingFields.style.display === 'none') {
                    existingFields.style.display = 'block';
                    toggleBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Hide Timeline';
                } else {
                    existingFields.style.display = 'none';
                    toggleBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Add Story Timeline';
                }
            } else {
                // Inject fields for the first time
                console.log('StoryTimelines: Injecting fields');
                injectDateTimeFields(entryForm);
                toggleBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Hide Timeline';
            }
        });
        
        // Find the best place to add the button - at the bottom of the form
        entryForm.appendChild(toggleBtn);
    }
    
    /**
     * Inject date/time fields into lorebook entry editor
     */
    function injectDateTimeFields(entryForm) {
        // entryForm is now passed directly
        if (!entryForm) {
            console.warn('StoryTimelines: No entry form provided');
            return;
        }
        
        // Check if fields already exist
        if (entryForm.querySelector('.storytimeline-fields')) {
            console.log('StoryTimelines: Fields already exist');
            return;
        }
        
        console.log('StoryTimelines: Creating fields');
        
        // Find the toggle button to insert after it
        const toggleBtn = entryForm.querySelector('.storytimeline-toggle-btn');
        if (!toggleBtn) {
            console.warn('StoryTimelines: Toggle button not found');
            return;
        }
        
        // Get entry UID before creating fields
        const entryUid = getCurrentEntryUid(entryForm);
        console.log('StoryTimelines: Entry UID:', entryUid);
        
        // Create container for our fields
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'storytimeline-fields';
        fieldContainer.style.cssText = `
            display: block;
            padding: 15px;
            margin: 10px 0;
            background: var(--black30a);
            border-radius: 5px;
            border-left: 3px solid var(--SmartThemeQuoteColor);
        `;
        
        fieldContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <i class="fa-solid fa-clock" style="color: var(--SmartThemeQuoteColor);"></i>
                <strong style="color: var(--SmartThemeQuoteColor);">Story Timeline</strong>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9em;">Story Date:</label>
                    <input type="date" class="text_pole storytimeline-date" style="width: 100%;">
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9em;">Story Time:</label>
                    <input type="time" class="text_pole storytimeline-time" style="width: 100%;">
                </div>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9em;">
                <input type="checkbox" class="storytimeline-dateonly">
                <span>Date Only (no specific time)</span>
            </label>
            <div style="display: flex; gap: 5px;">
                <button type="button" class="menu_button storytimeline-clear" style="flex: 1;">
                    <i class="fa-solid fa-times"></i> Clear Timeline Data
                </button>
            </div>
        `;
        
        // Insert after the toggle button
        toggleBtn.after(fieldContainer);
        
        // Load existing data if available
        if (entryUid) {
            loadEntryTimelineData(fieldContainer, entryUid);
        }
        
        // Add event listeners
        const dateInput = fieldContainer.querySelector('.storytimeline-date');
        const timeInput = fieldContainer.querySelector('.storytimeline-time');
        const dateOnlyCheck = fieldContainer.querySelector('.storytimeline-dateonly');
        const clearBtn = fieldContainer.querySelector('.storytimeline-clear');
        
        // Toggle time input based on date-only checkbox
        dateOnlyCheck.addEventListener('change', () => {
            timeInput.disabled = dateOnlyCheck.checked;
            if (dateOnlyCheck.checked) {
                timeInput.value = '12:00'; // Default to noon for date-only
            }
        });
        
        // Auto-save when fields change
        [dateInput, timeInput, dateOnlyCheck].forEach(input => {
            input.addEventListener('change', () => {
                if (entryUid) {
                    saveEntryTimelineData(entryUid, dateInput.value, timeInput.value, dateOnlyCheck.checked);
                }
            });
        });
        
        // Clear button
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dateInput.value = '';
            timeInput.value = '';
            dateOnlyCheck.checked = false;
            timeInput.disabled = false;
            if (entryUid) {
                clearEntryTimelineData(entryUid);
            }
        });
    }
    
    /**
     * Get current entry UID from the editor
     */
    function getCurrentEntryUid(entryForm) {
        // Try multiple ways to get the entry UID
        const uidInput = entryForm.querySelector('input[name="uid"], [data-uid]');
        if (uidInput) {
            return uidInput.value || uidInput.dataset.uid;
        }
        
        // Check if form itself has data-uid
        if (entryForm.dataset?.uid) {
            return entryForm.dataset.uid;
        }
        
        // Try to find it in parent world_entry
        const worldEntry = entryForm.closest('.world_entry');
        if (worldEntry?.dataset?.uid) {
            return worldEntry.dataset.uid;
        }
        
        console.warn('StoryTimelines: Could not find entry UID');
        return null;
    }
    
    /**
     * Load timeline data for an entry
     */
    async function loadEntryTimelineData(fieldContainer, entryUid) {
        try {
            const entry = await getWorldInfoEntry(entryUid);
            if (!entry) return;
            
            const timelineData = entry.extensions?.storytimelines;
            if (!timelineData?.storyTime) return;
            
            const dateInput = fieldContainer.querySelector('.storytimeline-date');
            const timeInput = fieldContainer.querySelector('.storytimeline-time');
            const dateOnlyCheck = fieldContainer.querySelector('.storytimeline-dateonly');
            
            const date = new Date(timelineData.storyTime);
            dateInput.value = date.toISOString().split('T')[0];
            timeInput.value = date.toTimeString().substring(0, 5);
            dateOnlyCheck.checked = timelineData.dateOnly || false;
            timeInput.disabled = dateOnlyCheck.checked;
            
        } catch (e) {
            console.error('StoryTimelines: Error loading entry data', e);
        }
    }
    
    /**
     * Save timeline data for an entry
     */
    async function saveEntryTimelineData(entryUid, dateValue, timeValue, dateOnly) {
        if (!dateValue) return;
        
        try {
            const entry = await getWorldInfoEntry(entryUid);
            if (!entry) return;
            
            const timeToUse = dateOnly ? '12:00' : (timeValue || '12:00');
            const storyTime = new Date(`${dateValue}T${timeToUse}`);
            
            if (!entry.extensions) {
                entry.extensions = {};
            }
            if (!entry.extensions.storytimelines) {
                entry.extensions.storytimelines = {};
            }
            
            entry.extensions.storytimelines.storyTime = storyTime.toISOString();
            entry.extensions.storytimelines.dateOnly = dateOnly;
            
            await saveWorldInfoEntry(entry);
            
            console.log('StoryTimelines: Saved timeline data for entry', entryUid);
        } catch (e) {
            console.error('StoryTimelines: Error saving entry data', e);
        }
    }
    
    /**
     * Clear timeline data for an entry
     */
    async function clearEntryTimelineData(entryUid) {
        try {
            const entry = await getWorldInfoEntry(entryUid);
            if (!entry) return;
            
            if (entry.extensions?.storytimelines) {
                delete entry.extensions.storytimelines;
            }
            
            await saveWorldInfoEntry(entry);
            
            console.log('StoryTimelines: Cleared timeline data for entry', entryUid);
        } catch (e) {
            console.error('StoryTimelines: Error clearing entry data', e);
        }
    }
    
    /**
     * Get world info entry by UID
     */
    async function getWorldInfoEntry(uid) {
        try {
            const worldInfoName = $('#world_info').val();
            if (!worldInfoName) return null;
            
            const response = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: worldInfoName })
            });
            
            const worldInfo = await response.json();
            return worldInfo.entries?.find(e => e.uid == uid);
        } catch (e) {
            console.error('StoryTimelines: Error getting entry', e);
            return null;
        }
    }
    
    /**
     * Save world info entry
     */
    async function saveWorldInfoEntry(entry) {
        try {
            const worldInfoName = $('#world_info').val();
            if (!worldInfoName) return;
            
            // Get full world info
            const response = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: worldInfoName })
            });
            
            const worldInfo = await response.json();
            
            // Update the entry
            const entryIndex = worldInfo.entries.findIndex(e => e.uid == entry.uid);
            if (entryIndex >= 0) {
                worldInfo.entries[entryIndex] = entry;
            }
            
            // Save back
            await fetch('/api/worldinfo/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(worldInfo)
            });
            
        } catch (e) {
            console.error('StoryTimelines: Error saving entry', e);
        }
    }
    
    /**
     * Create settings UI
     */
    function createSettingsUI() {
        const settingsHTML = `
            <div class="storytimeline-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>Story Timeline Settings</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div style="padding: 10px;">
                            <h4 style="margin-bottom: 10px;">Display Options</h4>
                            
                            <label class="checkbox_label" style="display: flex; align-items: center; margin-bottom: 10px;">
                                <input type="checkbox" id="storytimeline-setting-12hour" ${settings.dateTimeFormat === '12hour' ? 'checked' : ''}>
                                <span>Use 12-hour time format (AM/PM)</span>
                            </label>
                            
                            <div style="margin-bottom: 15px;">
                                <label for="storytimeline-setting-default-view" style="display: block; margin-bottom: 5px;">
                                    <b>Default Timeline View:</b>
                                </label>
                                <select id="storytimeline-setting-default-view" class="text_pole" style="width: 100%;">
                                    <option value="all" ${settings.defaultView === 'all' ? 'selected' : ''}>All Events</option>
                                    <option value="year" ${settings.defaultView === 'year' ? 'selected' : ''}>By Year</option>
                                    <option value="month" ${settings.defaultView === 'month' ? 'selected' : ''}>By Month</option>
                                    <option value="week" ${settings.defaultView === 'week' ? 'selected' : ''}>By Week</option>
                                    <option value="day" ${settings.defaultView === 'day' ? 'selected' : ''}>By Day</option>
                                </select>
                            </div>
                            
                            <h4 style="margin: 20px 0 10px 0;">Quick Access</h4>
                            <p style="font-size: 0.9em; color: var(--grey70); margin-bottom: 10px;">
                                Access the timeline viewer from:
                            </p>
                            <ul style="font-size: 0.9em; color: var(--grey70); margin-left: 20px; margin-bottom: 10px;">
                                <li>Extensions menu (left sidebar)</li>
                                <li>World Info "Timeline" button</li>
                                <li>Slash command: <code>/timeline</code></li>
                            </ul>
                            
                            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--SmartThemeBorderColor);">
                                <button id="storytimeline-open-viewer" class="menu_button">
                                    <i class="fa-solid fa-clock"></i> Open Timeline Viewer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Wait for extension settings panel to be available
        const waitForSettings = setInterval(() => {
            const extensionSettings = document.getElementById('extensions_settings');
            if (extensionSettings && !document.querySelector('.storytimeline-settings')) {
                extensionSettings.insertAdjacentHTML('beforeend', settingsHTML);
                
                // Add event listeners
                document.getElementById('storytimeline-setting-12hour').addEventListener('change', (e) => {
                    settings.dateTimeFormat = e.target.checked ? '12hour' : '24hour';
                    saveSettings();
                });
                
                document.getElementById('storytimeline-setting-default-view').addEventListener('change', (e) => {
                    settings.defaultView = e.target.value;
                    saveSettings();
                });
                
                document.getElementById('storytimeline-open-viewer').addEventListener('click', () => {
                    showTimelineViewer();
                });
                
                // Make the drawer collapsible
                const drawerToggle = extensionSettings.querySelector('.storytimeline-settings .inline-drawer-toggle');
                const drawerContent = extensionSettings.querySelector('.storytimeline-settings .inline-drawer-content');
                const drawerIcon = extensionSettings.querySelector('.storytimeline-settings .inline-drawer-icon');
                
                drawerToggle.addEventListener('click', () => {
                    const isOpen = drawerContent.style.display !== 'none';
                    drawerContent.style.display = isOpen ? 'none' : 'block';
                    drawerIcon.classList.toggle('up', !isOpen);
                    drawerIcon.classList.toggle('down', isOpen);
                });
                
                console.log('StoryTimelines: Settings UI added');
                clearInterval(waitForSettings);
            }
        }, 500);
        
        setTimeout(() => clearInterval(waitForSettings), 10000);
    }
    function createTimelineViewer() {
        const viewerHtml = `
            <div id="storytimeline-viewer" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                 width: 85%; max-width: 1100px; max-height: 85vh; background: var(--SmartThemeBodyColor); 
                 border: 2px solid var(--SmartThemeBorderColor); border-radius: 10px; z-index: 10000; 
                 box-shadow: 0 4px 20px rgba(0,0,0,0.5); display: flex; flex-direction: column;">
                <div style="padding: 15px; border-bottom: 1px solid var(--SmartThemeBorderColor); display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: var(--SmartThemeQuoteColor);">
                        <i class="fa-solid fa-clock"></i> Story Timeline
                    </h3>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <select id="storytimeline-view-select" class="text_pole" style="min-width: 150px;">
                            <option value="all">All Events</option>
                            <option value="year">By Year</option>
                            <option value="month">By Month</option>
                            <option value="week">By Week</option>
                            <option value="day">By Day</option>
                        </select>
                        <button id="storytimeline-export-btn" class="menu_button" title="Export Timeline">
                            <i class="fa-solid fa-download"></i>
                        </button>
                        <button id="storytimeline-close-btn" class="menu_button" title="Close">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                </div>
                <div id="storytimeline-viewer-content" style="flex: 1; overflow-y: auto; padding: 20px;"></div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', viewerHtml);
        
        document.getElementById('storytimeline-close-btn').addEventListener('click', hideTimelineViewer);
        document.getElementById('storytimeline-export-btn').addEventListener('click', exportTimeline);
        document.getElementById('storytimeline-view-select').addEventListener('change', (e) => {
            settings.defaultView = e.target.value;
            saveSettings();
            refreshTimelineViewer();
        });
    }
    
    /**
     * Show timeline viewer
     */
    async function showTimelineViewer() {
        console.log('StoryTimelines: Opening timeline viewer');
        const viewer = document.getElementById('storytimeline-viewer');
        if (!viewer) {
            console.error('StoryTimelines: Viewer element not found');
            return;
        }
        
        viewer.classList.remove('storytimeline-viewer-hidden');
        viewer.classList.add('storytimeline-viewer-visible');
        
        document.getElementById('storytimeline-view-select').value = settings.defaultView;
        
        await refreshTimelineViewer();
    }
    
    /**
     * Hide timeline viewer
     */
    function hideTimelineViewer() {
        console.log('StoryTimelines: *** HIDE FUNCTION CALLED ***');
        const viewer = document.getElementById('storytimeline-viewer');
        if (viewer) {
            console.log('StoryTimelines: Viewer element found, hiding...');
            viewer.classList.add('storytimeline-viewer-hidden');
            viewer.classList.remove('storytimeline-viewer-visible');
            viewer.style.display = 'none'; // Force it
            console.log('StoryTimelines: Viewer should now be hidden');
        } else {
            console.error('StoryTimelines: Viewer element NOT FOUND');
        }
    }
    
    /**
     * Refresh timeline viewer
     */
    async function refreshTimelineViewer() {
        console.log('StoryTimelines: *** REFRESH TIMELINE VIEWER CALLED ***');
        console.trace('StoryTimelines: Refresh called from:');
        
        const content = document.getElementById('storytimeline-viewer-content');
        content.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
        
        try {
            const worldInfoName = $('#world_info').val();
            if (!worldInfoName) {
                content.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--grey70);">No lorebook selected</div>';
                return;
            }
            
            const response = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: worldInfoName })
            });
            
            const worldInfo = await response.json();
            const taggedEntries = worldInfo.entries.filter(e => e.extensions?.storytimelines?.storyTime);
            
            if (taggedEntries.length === 0) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px;">
                        <i class="fa-solid fa-clock" style="font-size: 4em; opacity: 0.3; color: var(--SmartThemeQuoteColor); margin-bottom: 20px;"></i>
                        <h3 style="color: var(--SmartThemeEmColor);">No Timeline Events</h3>
                        <p style="color: var(--grey70); max-width: 500px; margin: 15px auto;">
                            Add story dates to your lorebook entries to see them here in chronological order.
                        </p>
                        <p style="color: var(--SmartThemeQuoteColor); margin-top: 20px;">
                            Open any lorebook entry and fill in the "Story Timeline" fields!
                        </p>
                    </div>
                `;
                return;
            }
            
            // Sort by story time
            taggedEntries.sort((a, b) => {
                return new Date(a.extensions.storytimelines.storyTime) - new Date(b.extensions.storytimelines.storyTime);
            });
            
            // Display based on view mode
            if (settings.defaultView === 'all') {
                displayFlatTimeline(content, taggedEntries);
            } else {
                displayGroupedTimeline(content, taggedEntries);
            }
            
        } catch (e) {
            console.error('StoryTimelines: Error loading timeline', e);
            content.innerHTML = '<div style="text-align: center; padding: 40px; color: #f44;">Error loading timeline</div>';
        }
    }
    
    /**
     * Display flat timeline
     */
    function displayFlatTimeline(container, entries) {
        container.innerHTML = '';
        
        entries.forEach(entry => {
            container.appendChild(createTimelineEntry(entry));
        });
    }
    
    /**
     * Display grouped timeline
     */
    function displayGroupedTimeline(container, entries) {
        container.innerHTML = '';
        
        const groups = {};
        
        entries.forEach(entry => {
            const date = new Date(entry.extensions.storytimelines.storyTime);
            let groupKey;
            
            switch(settings.defaultView) {
                case 'year':
                    groupKey = date.getFullYear().toString();
                    break;
                case 'month':
                    groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'week':
                    const weekNum = getWeekNumber(date);
                    groupKey = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
                    break;
                case 'day':
                    groupKey = date.toISOString().split('T')[0];
                    break;
            }
            
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(entry);
        });
        
        Object.keys(groups).sort().forEach(groupKey => {
            const groupDiv = document.createElement('div');
            groupDiv.style.marginBottom = '25px';
            
            const header = document.createElement('div');
            header.style.cssText = `
                background: var(--SmartThemeQuoteColor);
                color: var(--SmartThemeBodyColor);
                padding: 12px 20px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 1.1em;
                margin-bottom: 15px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            header.innerHTML = `
                <span>${formatGroupHeader(groupKey)}</span>
                <span style="font-size: 0.9em; opacity: 0.8;">${groups[groupKey].length} event${groups[groupKey].length !== 1 ? 's' : ''}</span>
            `;
            
            const content = document.createElement('div');
            content.style.marginLeft = '15px';
            
            groups[groupKey].forEach(entry => {
                content.appendChild(createTimelineEntry(entry));
            });
            
            header.addEventListener('click', () => {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            });
            
            groupDiv.appendChild(header);
            groupDiv.appendChild(content);
            container.appendChild(groupDiv);
        });
    }
    
    /**
     * Create timeline entry element
     */
    function createTimelineEntry(entry) {
        const div = document.createElement('div');
        div.style.cssText = `
            margin-bottom: 15px;
            padding: 15px;
            background: var(--SmartThemeBlurTintColor);
            border-left: 4px solid var(--SmartThemeQuoteColor);
            border-radius: 8px;
            transition: all 0.2s ease;
        `;
        
        const timelineData = entry.extensions.storytimelines;
        const date = new Date(timelineData.storyTime);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: settings.dateTimeFormat === '12hour'
        });
        
        const displayTime = timelineData.dateOnly ? dateStr : `${dateStr} ${timeStr}`;
        const title = entry.comment || 'Untitled Entry';
        const keywords = (entry.key || []).slice(0, 5).join(', ');
        const preview = (entry.content || '').substring(0, 250) + (entry.content.length > 250 ? '...' : '');
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <div>
                    <div style="color: var(--SmartThemeQuoteColor); font-weight: 600; font-size: 1.1em; margin-bottom: 5px;">
                        ${title}
                    </div>
                    <div style="color: var(--grey70); font-size: 0.9em;">
                        <i class="fa-solid fa-clock"></i> ${displayTime}
                    </div>
                </div>
            </div>
            ${keywords ? `<div style="font-size: 0.85em; color: var(--SmartThemeQuoteColor); margin-bottom: 10px;">
                <i class="fa-solid fa-key"></i> ${keywords}
            </div>` : ''}
            <div style="color: var(--SmartThemeEmColor); line-height: 1.5;">${preview}</div>
        `;
        
        div.addEventListener('mouseenter', () => {
            div.style.background = 'var(--SmartThemeShadowColor)';
            div.style.transform = 'translateX(5px)';
        });
        
        div.addEventListener('mouseleave', () => {
            div.style.background = 'var(--SmartThemeBlurTintColor)';
            div.style.transform = 'translateX(0)';
        });
        
        return div;
    }
    
    /**
     * Format group header
     */
    function formatGroupHeader(groupKey) {
        switch(settings.defaultView) {
            case 'year':
                return `Year ${groupKey}`;
            case 'month':
                const [year, month] = groupKey.split('-');
                return new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            case 'week':
                return `Week ${groupKey}`;
            case 'day':
                return new Date(groupKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            default:
                return groupKey;
        }
    }
    
    /**
     * Get week number
     */
    function getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    
    /**
     * Export timeline
     */
    async function exportTimeline() {
        try {
            const worldInfoName = $('#world_info').val();
            if (!worldInfoName) return;
            
            const response = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: worldInfoName })
            });
            
            const worldInfo = await response.json();
            const taggedEntries = worldInfo.entries.filter(e => e.extensions?.storytimelines?.storyTime);
            
            taggedEntries.sort((a, b) => {
                return new Date(a.extensions.storytimelines.storyTime) - new Date(b.extensions.storytimelines.storyTime);
            });
            
            let markdown = `# ${worldInfoName} - Story Timeline\n\n`;
            markdown += `Generated: ${new Date().toLocaleString()}\n`;
            markdown += `Total Events: ${taggedEntries.length}\n\n`;
            markdown += `---\n\n`;
            
            taggedEntries.forEach(entry => {
                const timelineData = entry.extensions.storytimelines;
                const date = new Date(timelineData.storyTime);
                const dateStr = date.toLocaleDateString();
                const timeStr = date.toLocaleTimeString();
                const displayTime = timelineData.dateOnly ? dateStr : `${dateStr} ${timeStr}`;
                
                markdown += `## ${entry.comment || 'Untitled'}\n\n`;
                markdown += `**Date:** ${displayTime}\n\n`;
                if (entry.key?.length) markdown += `**Keywords:** ${entry.key.join(', ')}\n\n`;
                markdown += `${entry.content || ''}\n\n`;
                markdown += `---\n\n`;
            });
            
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${worldInfoName}_timeline.md`;
            a.click();
            URL.revokeObjectURL(url);
            
        } catch (e) {
            console.error('StoryTimelines: Error exporting timeline', e);
        }
    }
    
    /**
     * Register slash command
     */
    function registerSlashCommand() {
        try {
            if (typeof window.registerSlashCommand === 'function') {
                window.registerSlashCommand('timeline', () => {
                    showTimelineViewer();
                    return '';
                }, [], '<span class="monospace">/timeline</span> – view story timeline', true, true);
            }
        } catch (e) {
            console.warn('StoryTimelines: Could not register slash command', e);
        }
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
