# Story Timeline Viewer (Extension for SillyTavern)

**Version:** 0.1.0  
**Author:** YourName

## What it does  
This extension adds a “Story Timeline” view to SillyTavern, which allows you to sort chat messages by *story time* (rather than post time).  
You can tag messages with metadata `storyTime` (numeric or string) and the extension builds a sidebar timeline of those events.

## Installation  
1. Clone or download this repository.  
2. Copy the folder into your SillyTavern extensions directory (e.g., `/scripts/extensions/`).  
3. In SillyTavern → Extensions panel → “Install extension” → select this folder.  
4. Enable the extension.  
5. Relaunch SillyTavern if necessary.

## Usage  
- For a message, add metadata:
  ```json
  {
    "storyTime": 10.5
  }
