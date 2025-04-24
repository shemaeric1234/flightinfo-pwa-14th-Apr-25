## Flight Schedule App
Flight Schedule App is a Progressive Web App (PWA) built using React and Material-UI. It allows users to view flight schedules, mark flights as favorites, submit flight information requests, and receive notifications about flight updates or delays. The app also supports offline functionality by leveraging IndexedDB and service workers.

### Features
1. Flight Schedules
Displays flight schedules fetched from an external API.
Shows saved favorite flights when offline.
2. Favorites
Users can mark flights as favorites.
Favorites are stored locally in IndexedDB for offline access.
3. Flight Information Requests
Users can submit flight information requests.
If offline, requests are saved in IndexedDB and synced with the server when the user comes back online.
4. Notifications
Users can trigger notifications manually.
Automatically notifies users about delayed flights after a short delay.
5. Offline Support
Detects whether the user is online or offline.
Displays a warning message when offline and shows only saved favorites.
6. PWA Installation
Prompts users to install the app as a PWA on their device.

### Installation

#### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

