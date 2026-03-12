# Incident Filtering System

## Overview
Users can filter which incident types they want to see on the map through their profile settings. Preferences are stored locally using AsyncStorage.

## How It Works

### Storage
- Preferences are stored in AsyncStorage under the key `@traffic_app_incident_filters`
- Format: `{ enabledTypes: string[] }`
- Empty array `[]` means all incident types are enabled (default)
- Non-empty array contains only the enabled incident type names

### API Integration
When fetching incidents, the enabled filters are passed as query parameters:
```
GET /api/incidents?filter=ACCIDENT&filter=RADAR
```

If no filters or all types are enabled, no filter parameter is sent (returns all incidents).

### User Flow
1. User opens Profile screen
2. User sees all incident types with toggle buttons
3. User taps to enable/disable specific types
4. Preferences are saved to AsyncStorage immediately
5. User returns to map
6. Map automatically refetches incidents with new filters (via useFocusEffect)

### Components

#### Services
- `preferences.service.ts` - Manages AsyncStorage operations for filters
- `incident.service.ts` - Updated to accept filter parameters

#### Hooks
- `useIncidentFilters.ts` - Hook for managing filter state and operations
- `useIncidents.ts` - Updated to load filters and pass to API

#### Context
- `IncidentFiltersContext.tsx` - Provides filter state throughout the app

#### UI
- Profile screen has the filter UI with toggle buttons for each incident type

## Future Enhancements
- Add backend sync to save preferences to user account
- Add "Select All" / "Deselect All" buttons
- Show count of enabled filters
- Add filter quick access from map screen
