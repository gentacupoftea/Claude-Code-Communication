# Firebase Realtime Database Setup

## Issue
The chat messages are not being displayed because the Firebase Realtime Database is not properly configured.

## Solution Steps

1. **Enable Firebase Realtime Database**
   - Go to the [Firebase Console](https://console.firebase.google.com)
   - Select your project: `multillm-demo-2025`
   - Navigate to "Realtime Database" in the left sidebar
   - Click "Create Database"
   - Choose a location (e.g., United States)
   - Start in "test mode" for development

2. **Set Database Rules**
   After the database is created, update the rules:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true,
       "chats": {
         "$roomId": {
           "messages": {
             ".indexOn": ["timestamp"]
           }
         }
       }
     }
   }
   ```

3. **Verify Database URL**
   The database URL should be: `https://multillm-demo-2025-default-rtdb.firebaseio.com`

## Code Changes Made

1. **Fixed Firebase Service** (`firebaseChatService.ts`)
   - Updated `subscribeToMessages` to handle initial load and new messages separately
   - Fixed `simulateAIResponse` to use `set()` instead of multiple `push()` calls
   - Added error handling for empty database

2. **Updated Chat Component** (`RealtimeChatFirebase.tsx`)
   - Removed redundant `getChatHistory` call
   - Added `onInitialLoad` callback to handle initial messages

## Testing

Once the Realtime Database is enabled:
1. Navigate to the chat page
2. Send a message
3. You should see your message and an AI response

## Security Note

The current rules allow anyone to read/write. For production:
- Implement proper authentication
- Update rules to restrict access based on user authentication
- Add data validation rules