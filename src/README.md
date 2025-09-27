# Clothes Tracker Web App

A minimal, mobile-first web application for tracking your clothes wearing and washing habits. Built with React, TypeScript, and Tailwind CSS.

## 🌟 Features

### Core Functionality
- **Add Clothes**: Register clothes with name, type, color, and optional photo
- **Daily Outfit Selection**: Quick checkbox interface to mark clothes as worn today
- **Batch Washing**: Multi-select clothes to mark as washed, resetting wear counts
- **Activity Timeline**: View chronological history of wearing and washing activities

### Smart Tracking
- **Wear Count Badges**: Color-coded badges showing wears since last wash
  - 🟢 Green (0-1 wears): Fresh/clean
  - 🟡 Yellow (2-3 wears): Needs attention
  - 🔴 Red (4+ wears): Needs washing urgently
- **Intelligent Sorting**: Clothes sorted by wear count in wash view
- **Quick Actions**: One-tap outfit confirmation and batch washing

### User Experience
- **Mobile-First Design**: Optimized for smartphone daily use
- **Tab Navigation**: Clean 4-tab interface (Home, Add, Wash, Timeline)
- **Visual Feedback**: Color-coded cards, selection states, and activity indicators
- **Offline Storage**: All data stored locally in browser localStorage

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Modern web browser with localStorage support

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd clothes-tracker

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 How to Use

### 1. Adding Clothes
- Tap the **➕ Add** tab
- Fill in clothing name (required) and type (required)
- Optionally select a color from the palette
- Upload a photo if desired
- Tap "Add Clothes"

### 2. Daily Outfit Selection
- On the **🏠 Home** tab, browse your clothes grid
- Check the boxes for items you're wearing today
- Tap "Confirm Today's Outfit" to log the wear records
- Wear count badges update automatically

### 3. Washing Clothes
- Go to **🧼 Wash** tab to see all clothes sorted by wear count
- Use "Select Needs Wash (2+)" for quick selection of frequently worn items
- Check individual items or use batch selection
- Tap "Mark as Washed" to reset wear counts and log wash records

### 4. Viewing History
- **📜 Timeline** shows your daily wearing and washing activity
- Filter by clothing type or color
- See "Today", "Yesterday", and dated entries
- Each entry shows wear/wash actions with clothing lists

## 🏗️ Technical Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Icons**: Lucide React
- **Storage**: Browser localStorage
- **Build**: Vite (assumed based on modern React setup)

### Data Structure
```typescript
// Core clothing item
ClothesItem {
  id: string
  name: string
  type: string
  color: string
  image?: string
  wearsSinceWash: number
  lastWashDate?: string
}

// Activity tracking
WearRecord {
  id: string
  clothesId: string
  date: string (YYYY-MM-DD)
}

WashRecord {
  id: string
  clothesId: string
  date: string (YYYY-MM-DD)
}
```

### Component Structure
```
App.tsx                 # Main app with tab navigation and state management
├── ClothesCard.tsx     # Individual clothing item display card
├── AddClothesModal.tsx # Form modal for adding new clothes
├── WashClothes.tsx     # Batch selection interface for washing
└── Timeline.tsx        # Activity history with filtering
```

## 📁 Project Structure

```
├── App.tsx                    # Main application component
├── components/
│   ├── ClothesCard.tsx        # Clothing item display card
│   ├── AddClothesModal.tsx    # Add clothes form modal
│   ├── WashClothes.tsx        # Wash selection interface
│   ├── Timeline.tsx           # Activity timeline view
│   ├── figma/
│   │   └── ImageWithFallback.tsx  # Image component with fallback
│   └── ui/                    # shadcn/ui component library
│       ├── button.tsx
│       ├── checkbox.tsx
│       ├── input.tsx
│       ├── select.tsx
│       └── ...
└── styles/
    └── globals.css            # Tailwind v4 configuration and base styles
```

## 🎨 Design System

### Color Coding
- **Wear Count Badges**:
  - Green (`bg-green-500`): 0-1 wears since wash
  - Yellow (`bg-yellow-500`): 2-3 wears since wash
  - Red (`bg-red-500`): 4+ wears since wash

### Layout
- **Mobile-first**: 2-3 column grid on small screens, responsive scaling
- **Card Design**: Rounded corners (`rounded-2xl`), shadows, white backgrounds
- **Typography**: System defaults via Tailwind v4 base layer
- **Icons**: Lucide React icons for navigation and actions

## 🔄 Data Persistence

All application data is stored in browser localStorage:
- `clothes`: Array of ClothesItem objects
- `wearRecords`: Array of WearRecord objects  
- `washRecords`: Array of WashRecord objects

Data persists between browser sessions but is device-specific.

## 🚀 Future Enhancements

### Smart Features
- **Under-used Alert**: Highlight clothes not worn in 2+ weeks
- **Seasonal Organization**: Group clothes by season/weather
- **Wear Pattern Analytics**: Charts showing wearing frequency
- **Smart Suggestions**: Recommend outfits based on weather/occasion

### Technical Improvements
- **Data Export/Import**: Backup and restore functionality
- **Photo Management**: Better image compression and organization
- **Offline PWA**: Service worker for offline functionality
- **Cloud Sync**: Optional cloud storage for cross-device sync

### UX Enhancements
- **Swipe Gestures**: Swipe right to wear, left for details
- **Quick Stats Dashboard**: Overview of wardrobe usage
- **Clothing Categories**: Organize by formal/casual/workout etc.
- **Maintenance Reminders**: Alerts for dry cleaning, repairs

## 📄 License

[Add your license here]

## 🤝 Contributing

[Add contribution guidelines here]

---

Built with ❤️ for effortless daily outfit tracking and wardrobe management.