# Zoom Meeting SDK Integration Setup

This guide will help you set up Zoom Meeting SDK integration for TalentForge to enable embedded video interviews.

## Overview

TalentForge uses two types of Zoom apps:
1. **Meeting SDK App** - For embedding video calls in the browser
2. **Server-to-Server OAuth App** - For creating meetings programmatically via API

## Step 1: Create a Meeting SDK App

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/develop/create)
2. Click **"Create"** and select **"Meeting SDK"** app type
3. Fill in app information:
   - **App Name**: TalentForge Interview SDK
   - **Company Name**: Your company name
   - **Developer Name**: Your name
   - **Developer Email**: Your email
4. Click **"Create"**
5. Go to **"App Credentials"** tab
6. Copy:
   - **SDK Key** → Add to `.env.local` as `ZOOM_SDK_KEY` and `NEXT_PUBLIC_ZOOM_SDK_KEY`
   - **SDK Secret** → Add to `.env.local` as `ZOOM_SDK_SECRET`

## Step 2: Create a Server-to-Server OAuth App

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/develop/create)
2. Click **"Create"** and select **"Server-to-Server OAuth"** app type
3. Fill in app information:
   - **App Name**: TalentForge Meeting API
   - **Company Name**: Your company name
   - **Developer Name**: Your name
   - **Developer Email**: Your email
4. Click **"Create"**
5. Go to **"App Credentials"** tab
6. Copy:
   - **Account ID** → Add to `.env.local` as `ZOOM_ACCOUNT_ID`
   - **Client ID** → Add to `.env.local` as `ZOOM_CLIENT_ID`
   - **Client Secret** → Add to `.env.local` as `ZOOM_CLIENT_SECRET`
7. Go to **"Scopes"** tab and add these scopes:
   - `meeting:write:admin` - Create meetings
   - `meeting:read:admin` - Read meeting details
   - `recording:read:admin` - Read cloud recordings
8. Click **"Continue"** and **"Activate"**

## Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```env
# Zoom Meeting SDK & API
ZOOM_SDK_KEY=your_actual_sdk_key
ZOOM_SDK_SECRET=your_actual_sdk_secret
NEXT_PUBLIC_ZOOM_SDK_KEY=your_actual_sdk_key
ZOOM_ACCOUNT_ID=your_actual_account_id
ZOOM_CLIENT_ID=your_actual_client_id
ZOOM_CLIENT_SECRET=your_actual_client_secret
```

## Step 4: Configure for Production (Vercel)

Add the same environment variables to your Vercel project:

```bash
vercel env add ZOOM_SDK_KEY
vercel env add ZOOM_SDK_SECRET
vercel env add NEXT_PUBLIC_ZOOM_SDK_KEY
vercel env add ZOOM_ACCOUNT_ID
vercel env add ZOOM_CLIENT_ID
vercel env add ZOOM_CLIENT_SECRET
```

Or add them via the Vercel dashboard:
1. Go to your project settings
2. Navigate to **"Environment Variables"**
3. Add each variable for **"Production"**, **"Preview"**, and **"Development"**

## Step 5: Test the Integration

1. Restart your development server: `npm run dev`
2. Create a new interview with a candidate
3. Set interview type to **"Video"**
4. A Zoom meeting should automatically be created
5. Navigate to the interview details page
6. Click "Start Video Call" to test the embedded Zoom meeting

## Features

Once configured, TalentForge will:

✅ Automatically create Zoom meetings when scheduling video interviews
✅ Embed video calls directly in the interview page (no external Zoom client needed)
✅ Include Zoom meeting links in interview invitation emails
✅ Support both host and participant roles
✅ Auto-record meetings to Zoom cloud (configurable in code)
✅ Handle meeting end events and cleanup

## Troubleshooting

### "Failed to generate Zoom signature"
- Verify `ZOOM_SDK_KEY` and `ZOOM_SDK_SECRET` are correctly set
- Check that the SDK app is activated in Zoom Marketplace

### "Failed to create Zoom meeting"
- Verify `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, and `ZOOM_CLIENT_SECRET` are correctly set
- Ensure the Server-to-Server OAuth app has the required scopes
- Check that the app is activated

### Meeting embed not loading
- Verify `NEXT_PUBLIC_ZOOM_SDK_KEY` is set (must have NEXT_PUBLIC_ prefix)
- Clear browser cache and reload
- Check browser console for errors

### "Meeting not found"
- Ensure the interview has a `zoomMeetingId` in the database
- Check that the meeting was successfully created via the API

## Support

For Zoom SDK documentation:
- [Meeting SDK Web Reference](https://developers.zoom.us/docs/meeting-sdk/web/)
- [Server-to-Server OAuth Guide](https://developers.zoom.us/docs/internal-apps/s2s-oauth/)

For TalentForge support:
- Check the codebase documentation
- Review the implementation in `/src/lib/integrations/zoom.ts`
